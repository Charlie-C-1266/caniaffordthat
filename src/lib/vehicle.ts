import { fmt, num, paymentForFinance } from './calculations'
import { spareCashOf, spareCashFitSub, withinReachVerdict } from './derive'
import { financeProjection, type Projection } from './projection'
import { budgetBreakdown, type BudgetBreakdown } from './budgetSplit'
import type { CalculatorState, VehicleFinanceMethod } from '../state/types'

// Pure maths and reference figures for the vehicle flow. Everything here is
// UK-specific: fuel in pence per litre and miles per imperial gallon, road
// tax (VED) per GOV.UK's rate tables, and finance shapes as sold here (PCP
// with a GMFV balloon, HP, unsecured personal loan). The in-app "Our sources"
// panel links the pages each figure comes from.

/** UK average annual car mileage, used to seed the mileage field and to judge "average for its age" — a widely used round figure (DfT's National Travel Survey puts the average a little under this). */
export const UK_AVERAGE_ANNUAL_MILES = 8000

/** Litres per imperial gallon — converts the mpg figure to litres bought at the pump. */
export const LITRES_PER_GALLON = 4.54609

/** Default pump price in pence per litre — a static, editable default in the spirit of the RAC fuel-cost tool; users should check today's price. */
export const DEFAULT_FUEL_PENCE_PER_LITRE = 140

/** Standard annual VED ("road tax") rate for cars first registered after April 2017 (2026-27 rate per GOV.UK; editable in the costs step). */
export const STANDARD_VED_ANNUAL = 200

/** The "expensive car" VED supplement: cars with a list price over £40,000 pay this extra per year, in years 2-6 (2026-27 rate per GOV.UK). */
export const EXPENSIVE_CAR_SUPPLEMENT_ANNUAL = 440

/** List-price threshold above which the VED supplement applies. */
export const EXPENSIVE_CAR_PRICE_THRESHOLD = 40000

/** A suggested monthly maintenance budget the costs step offers as a one-tap preset. */
export interface MaintenancePreset {
  id: 'budget' | 'average' | 'premium'
  label: string
  /** Suggested £/month for servicing, MOT, tyres and repairs. */
  monthly: number
  /** What kind of car the figure suits. */
  blurb: string
}

// Rough UK monthly budgets for servicing + MOT + tyres + wear-and-tear
// repairs. Deliberately round, editable figures — a prompt for people who
// (reasonably) have no idea what to type, not a quote.
export const MAINTENANCE_PRESETS: readonly MaintenancePreset[] = [
  { id: 'budget', label: 'Budget', monthly: 35, blurb: 'Small or older car, basic servicing' },
  { id: 'average', label: 'Average', monthly: 60, blurb: 'Typical hatchback or family car' },
  { id: 'premium', label: 'Premium', monthly: 130, blurb: 'Large, performance or luxury car' },
]

/**
 * Term-slider bounds per finance method, reflecting how each is actually
 * sold: PCP agreements run 2-4 years, HP up to 5, and unsecured personal
 * loans up to 7. The purchase step clamps `term` into the active method's
 * range when switching.
 */
export const TERM_RANGES: Record<Exclude<VehicleFinanceMethod, 'cash'>, { min: number; max: number }> = {
  pcp: { min: 12, max: 48 },
  hp: { min: 12, max: 60 },
  loan: { min: 12, max: 84 },
}

// --- Depreciation model (the generic curve behind the balloon estimate) ---
//
// UK motoring guidance (AA/RAC) puts a typical car's losses at around 15-35%
// of its value in year one and 50-60% of it by year three. The curve below
// sits in the middle of those bands: 25% off in year one, then a steady 18%
// of the remaining value each later year (75% x 0.82^2 ≈ 50% retained at
// three years). It's deliberately generic — model-level accuracy isn't
// possible without a valuation service — and every estimate derived from it
// is flagged as such in the result.

const FIRST_YEAR_RETENTION = 0.75
const LATER_YEAR_RETENTION = 0.82

// These four tuning values are exported so the methodology page quotes the
// figures actually in force rather than a copy that could drift.

/** Value the mileage adjustment moves per 1,000 miles away from average-for-age (0.4% of value). */
export const MILEAGE_VALUE_PER_1000_MILES = 0.004

// A high-mileage car is worth less, but never a *lot* less purely on miles —
// clamp the adjustment so extreme odometer readings can't drive the estimate
// to silly values in either direction.
export const MILEAGE_FACTOR_MIN = 0.75
export const MILEAGE_FACTOR_MAX = 1.15

/** Lenders set the guaranteed future value a little under the expected market value to protect themselves — mirror that. */
export const GMFV_MARGIN = 0.9

/** Fraction of its as-new value a typical car retains at `ageYears` (mileage-neutral). 1 at age 0, decaying along the generic curve above. */
export function retentionAt(ageYears: number): number {
  if (ageYears <= 0) return 1
  if (ageYears <= 1) return 1 - (1 - FIRST_YEAR_RETENTION) * ageYears
  return FIRST_YEAR_RETENTION * Math.pow(LATER_YEAR_RETENTION, ageYears - 1)
}

/** Multiplier on value for being `excessMiles` above (positive) or below (negative) the average odometer for the car's age. */
export function mileageFactor(excessMiles: number): number {
  const factor = 1 - (excessMiles / 1000) * MILEAGE_VALUE_PER_1000_MILES
  return Math.min(MILEAGE_FACTOR_MAX, Math.max(MILEAGE_FACTOR_MIN, factor))
}

export interface BalloonEstimateInput {
  /** What the car costs today — the anchor the future value is projected from. */
  price: number
  /** The car's age today, in years (0 = brand new). */
  ageYears: number
  /** Current odometer miles. Pass 0 for "unknown" — treated as average for its age. */
  currentMileage: number
  /** Length of the PCP agreement in months. */
  termMonths: number
  /** Miles the user expects to drive per year. Pass 0 for "unknown" — treated as the UK average. */
  annualMiles: number
}

/**
 * Estimates a PCP balloon (GMFV) for when the user doesn't have a quote: the
 * car's value at the end of the term, projected along the generic
 * depreciation curve and adjusted for mileage, with a lender-style safety
 * margin under it. The price paid today already reflects the car's current
 * age and mileage, so the projection is a *ratio* of the curve at the end of
 * the term to the curve now — not an absolute read off the curve.
 */
export function estimateBalloon({ price, ageYears, currentMileage, termMonths, annualMiles }: BalloonEstimateInput): number {
  if (price <= 0 || termMonths <= 0) return 0
  const termYears = termMonths / 12
  const milesPerYear = annualMiles > 0 ? annualMiles : UK_AVERAGE_ANNUAL_MILES
  const mileageNow = currentMileage > 0 ? currentMileage : ageYears * UK_AVERAGE_ANNUAL_MILES
  const mileageAtEnd = mileageNow + milesPerYear * termYears
  const ageAtEnd = ageYears + termYears

  const factorNow = retentionAt(ageYears) * mileageFactor(mileageNow - ageYears * UK_AVERAGE_ANNUAL_MILES)
  const factorAtEnd = retentionAt(ageAtEnd) * mileageFactor(mileageAtEnd - ageAtEnd * UK_AVERAGE_ANNUAL_MILES)

  const estimate = price * (factorAtEnd / factorNow) * GMFV_MARGIN
  return Math.round(Math.min(price, Math.max(0, estimate)))
}

/**
 * Monthly PCP payment: amortizes `principal` down to the `balloon` (rather
 * than to zero) over `n` months at `annualRatePct` APR — interest accrues on
 * the full outstanding balance including the balloon, which is why PCP
 * payments are lower than HP but the interest cost isn't. With a zero
 * balloon this is exactly the standard loan payment.
 */
export function pcpPayment(principal: number, balloon: number, n: number, annualRatePct: number): number {
  if (principal <= 0) return 0
  n = Math.max(1, n)
  const b = Math.min(principal, Math.max(0, balloon))
  const i = annualRatePct / 100 / 12
  if (i === 0) return (principal - b) / n
  const discount = Math.pow(1 + i, -n)
  return ((principal - b * discount) * i) / (1 - discount)
}

/** Fuel cost per month from annual mileage, mpg (imperial) and pump price in pence per litre. 0 if any input is missing. */
export function fuelCostPerMonth(annualMiles: number, mpg: number, pencePerLitre: number): number {
  if (annualMiles <= 0 || mpg <= 0 || pencePerLitre <= 0) return 0
  const gallonsPerMonth = annualMiles / 12 / mpg
  return (gallonsPerMonth * LITRES_PER_GALLON * pencePerLitre) / 100
}

/** Whether the over-£40k VED supplement applies: a brand-new car priced above the list-price threshold. (It also attaches to nearly-new cars for their first six years; first iteration only auto-applies it for brand-new ones.) */
export function expensiveCarSupplementApplies(price: number, ageYears: number): boolean {
  return ageYears === 0 && price > EXPENSIVE_CAR_PRICE_THRESHOLD
}

/**
 * Whether the purchase step asks for the car's age (the PCP balloon-estimate
 * branch needs it there). The costs step asks it on every *other* path — this
 * is the single source of truth both steps read, so the question is always
 * asked exactly once and the two conditions can't drift apart.
 */
export function vehicleAgeAskedOnPurchase(state: Pick<CalculatorState, 'vehicleMethod' | 'balloonMode'>): boolean {
  return state.vehicleMethod === 'pcp' && state.balloonMode === 'estimate'
}

/** The monthly running costs, itemised. `tax` already includes any over-£40k supplement (broken out in `supplementMonthly`). */
export interface VehicleRunningCosts {
  fuel: number
  maintenance: number
  insurance: number
  tax: number
  supplementMonthly: number
  total: number
}

/** Itemises the car's monthly running costs from the costs-step fields. Pure and state-shaped so the costs tile can show the same live numbers the result uses. */
export function vehicleRunningCosts(state: CalculatorState): VehicleRunningCosts {
  const fuel = fuelCostPerMonth(num(state.annualMiles), num(state.mpg), num(state.fuelPencePerLitre))
  const maintenance = num(state.maintenanceMonthly)
  const insurance = num(state.insuranceAnnual) / 12
  const supplementMonthly = expensiveCarSupplementApplies(num(state.itemPrice), state.vehicleAge)
    ? EXPENSIVE_CAR_SUPPLEMENT_ANNUAL / 12
    : 0
  const tax = num(state.taxAnnual) / 12 + supplementMonthly
  return { fuel, maintenance, insurance, tax, supplementMonthly, total: fuel + maintenance + insurance + tax }
}

/** Everything the vehicle result tile renders, derived in one pass. */
export interface VehicleResult {
  method: VehicleFinanceMethod
  price: number
  /** Deposit / part-exchange, clamped to the price. */
  deposit: number
  /** Amount financed (cash: the amount handed over on the day). */
  principal: number
  /** £/month on the finance agreement; 0 for cash. */
  financeMonthly: number
  /** PCP only: the balloon used in the maths (clamped to the principal). */
  balloon: number | null
  /** True when the balloon came from the depreciation estimate rather than a quote. */
  balloonIsEstimate: boolean
  /** Finance methods: agreement length in months. */
  termMonths: number
  aprPct: number
  running: VehicleRunningCosts
  /** financeMonthly + running costs — the figure judged against spare cash. */
  totalMonthly: number
  spareCash: number
  /** Due on day one: the full price less part-exchange for cash, the deposit for finance. */
  upfront: number
  /** Deposit + all payments (+ balloon, for PCP — i.e. the keep-the-car figure). Cash: the price. */
  totalPayable: number
  /** totalPayable less the price — the cost of the borrowing. */
  interestPaid: number
  supplementApplies: boolean
  isAffordable: boolean
  verdictText: string
  verdictSub: string
  resultEyebrow: string
  headline: string
  subheadline: string
  /** Finance methods: the balance-repaid series behind the chart and table (a PCP tops out below 100% — the balloon is still owed). `null` for cash. */
  projection: Projection | null
  /** How the car's total monthly cost sits within the budget — the data behind the budget donut. */
  budget: BudgetBreakdown
  /** Caveats worth the user's attention, rendered under the breakdown. */
  notes: string[]
}

/** Copy fragments per finance method, so the result reads like the agreement the user actually picked. */
const METHOD_LABELS: Record<VehicleFinanceMethod, string> = {
  cash: 'Cash',
  pcp: 'PCP',
  hp: 'Hire purchase',
  loan: 'Personal loan',
}

/** Short label for the breakdown's finance row, e.g. "PCP payment". */
export function financeRowLabel(method: VehicleFinanceMethod): string {
  return method === 'cash' ? 'Finance' : `${METHOD_LABELS[method]} payment`
}

/**
 * Computes the vehicle flow's full affordability result, or `null` until the
 * required fields (price and take-home pay) are filled in. The verdict
 * judges the *total* monthly cost — finance payment plus fuel, maintenance,
 * insurance and tax — against spare cash, using the same comfortable/tight
 * bands as the other flows.
 */
export function deriveVehicleResult(state: CalculatorState): VehicleResult | null {
  const price = num(state.itemPrice)
  const takeHome = num(state.takeHome)
  if (!(price > 0 && takeHome > 0)) return null

  const method = state.vehicleMethod
  const deposit = Math.min(num(state.savings), price)
  const principal = price - deposit
  const spareCash = spareCashOf(state)
  const termMonths = Math.max(1, state.term)
  const aprPct = state.growth
  const running = vehicleRunningCosts(state)
  const notes: string[] = []

  // --- The finance side of the monthly cost ---
  let financeMonthly = 0
  let balloon: number | null = null
  let balloonIsEstimate = false
  let totalPayable = price
  if (method === 'pcp') {
    balloonIsEstimate = state.balloonMode === 'estimate'
    const rawBalloon = balloonIsEstimate
      ? estimateBalloon({
          price,
          ageYears: state.vehicleAge,
          currentMileage: num(state.vehicleMileage),
          termMonths,
          annualMiles: num(state.annualMiles),
        })
      : num(state.balloonAmount)
    if (rawBalloon > principal) {
      notes.push(`A final payment can't exceed the amount financed — we've capped it at ${fmt(principal)}.`)
    }
    balloon = Math.min(principal, Math.max(0, rawBalloon))
    financeMonthly = pcpPayment(principal, balloon, termMonths, aprPct)
    totalPayable = deposit + financeMonthly * termMonths + balloon
  } else if (method === 'hp' || method === 'loan') {
    financeMonthly = paymentForFinance(principal, termMonths, aprPct)
    totalPayable = deposit + financeMonthly * termMonths
  }
  const interestPaid = Math.max(0, totalPayable - price)
  const upfront = method === 'cash' ? principal : deposit

  const totalMonthly = financeMonthly + running.total
  const isAffordable = totalMonthly <= spareCash

  // --- The projection: balance repaid over the term ---
  // A PCP payment amortizes only down to its balloon, so the repaid series
  // honestly tops out below 100% — the final payment is still owed. Cash has
  // no finance balance to project.
  const projection = method !== 'cash' && principal > 0 ? financeProjection(principal, financeMonthly, aprPct, termMonths) : null

  // --- Copy ---
  const runningLine = `${fmt(running.total)}/month to run (fuel, maintenance, insurance and tax)`
  let subheadline: string
  switch (method) {
    case 'cash':
      subheadline =
        deposit > 0
          ? `${fmt(upfront)} upfront after your ${fmt(deposit)} deposit / part-exchange, then ${runningLine}.`
          : `${fmt(upfront)} upfront, then ${runningLine}.`
      break
    case 'pcp': {
      // A zero balloon (a "quote" left blank) would read absurdly as
      // "keeping the car means a £0 final payment" — drop the sentence.
      const keepLine =
        balloon !== null && balloon > 0 ? ` Keeping the car at the end means a ${fmt(balloon)} final payment.` : ''
      subheadline = `${fmt(financeMonthly)}/month on PCP over ${termMonths} months at ${aprPct}% APR, plus ${runningLine}.${keepLine}`
      break
    }
    case 'hp':
      subheadline = `${fmt(financeMonthly)}/month on hire purchase over ${termMonths} months at ${aprPct}% APR, plus ${runningLine}. The car's yours after the final payment.`
      break
    case 'loan':
      subheadline = `${fmt(financeMonthly)}/month on a personal loan over ${termMonths} months at ${aprPct}% APR, plus ${runningLine}. You own the car from day one.`
      break
  }

  const supplementApplies = running.supplementMonthly > 0
  if (balloonIsEstimate && balloon !== null) {
    notes.push(
      `The ${fmt(balloon)} final payment is our estimate from a generic depreciation curve (cars typically lose around a quarter of their value in year one, then 15–20% a year), not a quote — your lender's guaranteed figure (GMFV) will differ.`,
    )
  }
  if (supplementApplies) {
    notes.push(
      `Road tax includes the ${fmt(EXPENSIVE_CAR_SUPPLEMENT_ANNUAL)}/year supplement for brand-new cars with a list price over ${fmt(EXPENSIVE_CAR_PRICE_THRESHOLD)}, charged in years 2–6.`,
    )
  }
  if (method === 'cash') {
    notes.push(`Paying ${fmt(upfront)} upfront is the cheapest way to buy — just make sure it still leaves you an emergency cushion.`)
  }

  return {
    method,
    price,
    deposit,
    principal,
    financeMonthly,
    balloon,
    balloonIsEstimate,
    termMonths,
    aprPct,
    running,
    totalMonthly,
    spareCash,
    upfront,
    totalPayable,
    interestPaid,
    supplementApplies,
    isAffordable,
    verdictText: withinReachVerdict(isAffordable),
    verdictSub: spareCashFitSub(totalMonthly, spareCash),
    resultEyebrow: 'Total monthly cost',
    headline: `${fmt(totalMonthly)}/mo`,
    subheadline,
    projection,
    budget: budgetBreakdown(state, totalMonthly),
    notes,
  }
}
