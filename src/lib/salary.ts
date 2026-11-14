import { CURRENT_TAX_YEAR, type TaxYear } from './taxYears'
import {
  NO_DEDUCTIONS,
  baseAt,
  basesFor,
  grossWhereBaseIs,
  loanThresholdsFor,
  pensionAt,
  pensionSlopeChangesFor,
  studentLoansOn,
  type PayProfile,
} from './deductions'

// Gross salary ⇄ take-home pay. `takeHomeBreakdown` is the forward PAYE calc:
// income tax, employee NI, and any student loan and workplace pension in the
// pay profile (see deductions.ts for how those are charged). The reverse
// direction never untangles the algebra, which the personal-allowance taper
// makes fiddly and easy to get subtly wrong: it searches the forward function
// instead, so it is right whenever the forward function is. All figures are
// annual, rest-of-UK, employment income (see taxYears.ts for the
// assumptions), and every function takes the pay profile last, defaulting to
// no deductions.
//
// The search does not assume take-home keeps rising as gross rises. Under
// today's tables it does with no deductions, but a relief-at-source pension
// above ~28.75% in the £100k taper band, with both loans, makes it fall for a
// stretch, and then one take-home comes from more than one salary. Take-home
// never changes direction between the points where some base crosses a
// threshold, so `salariesForTakeHome` lists those points and bisects inside
// each stretch whose ends sit either side of the target. Such a stretch
// crosses the target at most once, so this finds every salary, not just one.
// The catch: a new deduction must add its own thresholds to `slopeChangesOf`,
// or a crossing between two of them could be missed. Read
// docs/salary-engine-monotonicity.md before adding one.

/** Sum a progressive charge over its bands (cumulative `upTo` bounds) for a given base amount. */
function chargeOver(base: number, bands: readonly TaxYear['incomeTaxBands'][number][]): number {
  let charge = 0
  let lower = 0
  for (const band of bands) {
    if (base <= lower) break
    charge += (Math.min(base, band.upTo) - lower) * band.rate
    lower = band.upTo
  }
  return charge
}

/** The tapered personal allowance at a given gross income. */
function allowanceFor(gross: number, year: TaxYear): number {
  const over = Math.max(0, gross - year.taperThreshold)
  return Math.max(0, year.personalAllowance - over * year.taperRate)
}

/**
 * Annual income tax due on a gross salary. With a pension that comes off
 * before tax, pass the pay left after it: the allowance tapers on that too.
 */
export function incomeTaxOn(gross: number, year: TaxYear = CURRENT_TAX_YEAR): number {
  const taxable = Math.max(0, gross - allowanceFor(gross, year))
  return chargeOver(taxable, year.incomeTaxBands)
}

/** Annual employee National Insurance due on a gross salary. With salary sacrifice, pass the salary after it. */
export function nationalInsuranceOn(gross: number, year: TaxYear = CURRENT_TAX_YEAR): number {
  return chargeOver(Math.max(0, gross), year.niBands)
}

/** Every line between a gross salary and take-home, annually. */
export interface TakeHomeBreakdown {
  gross: number
  incomeTax: number
  nationalInsurance: number
  /** The undergraduate plan's repayment. */
  studentLoan: number
  postgraduateLoan: number
  /**
   * What the pension costs take-home: the salary given up under salary
   * sacrifice, or what comes out of pay under net pay and relief at source.
   * Under relief at source that is 80p for each £1 in the pot.
   */
  pension: number
  /** What lands in the pension pot, relief at source's 20% included. Employer contributions aren't counted. */
  intoPension: number
  takeHome: number
}

/**
 * The forward calculation: everything taken from a gross salary on the way
 * to take-home, under a pay profile. Take-home never goes below nothing, even
 * for a pension that would take more than the payslip has left.
 */
export function takeHomeBreakdown(gross: number, year: TaxYear = CURRENT_TAX_YEAR, profile: PayProfile = NO_DEDUCTIONS): TakeHomeBreakdown {
  const g = Math.max(0, gross)
  const bases = basesFor(profile.pension)
  const loanBase = baseAt(bases.ni, g)
  const incomeTax = incomeTaxOn(baseAt(bases.tax, g), year)
  const nationalInsurance = nationalInsuranceOn(loanBase, year)
  const { studentLoan, postgraduateLoan } = studentLoansOn(loanBase, profile, year)
  const { intoPension, fromPay } = pensionAt(g, profile.pension, year)
  return {
    gross: g,
    incomeTax,
    nationalInsurance,
    studentLoan,
    postgraduateLoan,
    pension: fromPay,
    intoPension,
    takeHome: Math.max(0, g - incomeTax - nationalInsurance - studentLoan - postgraduateLoan - fromPay),
  }
}

/** Annual take-home pay for a gross salary under a pay profile. */
export function netFromGross(gross: number, year: TaxYear = CURRENT_TAX_YEAR, profile: PayProfile = NO_DEDUCTIONS): number {
  return takeHomeBreakdown(gross, year, profile).takeHome
}

/** Where the personal allowance has tapered to nothing, or Infinity for a table without a taper. */
function taperEndOf(year: TaxYear): number {
  return year.taperRate > 0 ? year.taperThreshold + year.personalAllowance / year.taperRate : Infinity
}

/**
 * The gross salary whose taxable income (gross less the tapered allowance) is
 * `taxable`. Taxable income rises £1 for £1 of gross, then faster inside the
 * taper, where each £1 also withdraws `taperRate` of allowance, then £1 for £1
 * again. Each of the three stretches inverts directly.
 */
function grossForTaxable(taxable: number, year: TaxYear): number {
  const { personalAllowance, taperThreshold, taperRate } = year
  const taxableAtTaperStart = taperThreshold - personalAllowance
  if (taxable <= taxableAtTaperStart) return taxable + personalAllowance
  // The allowance is all gone by the taper's end, so taxable income there is the gross itself.
  if (taxable <= taperEndOf(year)) return taperThreshold + (taxable - taxableAtTaperStart) / (1 + taperRate)
  return taxable
}

/**
 * Every gross salary at which take-home can change direction, ascending from
 * £0. Income tax changes slope where its base reaches tax, each band edge,
 * and the taper's start and end; NI at each band edge of its base; student
 * loans at each repayment threshold on that same base. A pension adds where
 * each base leaves zero and where a fixed contribution stops growing. Between
 * two neighbours take-home is a straight line, or one that bottoms out at £0.
 */
function slopeChangesOf(year: TaxYear, profile: PayProfile): number[] {
  const bases = basesFor(profile.pension)
  const onTaxBase = [
    0,
    year.taperThreshold,
    taperEndOf(year),
    grossForTaxable(0, year),
    ...year.incomeTaxBands.map((band) => grossForTaxable(band.upTo, year)),
  ]
  const onNiBase = [0, ...year.niBands.map((band) => band.upTo), ...loanThresholdsFor(profile, year)]
  const points = [
    0,
    ...onTaxBase.map((point) => grossWhereBaseIs(point, bases.tax)),
    ...onNiBase.map((point) => grossWhereBaseIs(point, bases.ni)),
    ...pensionSlopeChangesFor(profile.pension, year),
  ]
  return [...new Set(points.filter((point) => Number.isFinite(point) && point >= 0))].toSorted((a, b) => a - b)
}

/** Halvings per bisection: enough to take any bracket the search uses to well under a penny. */
const BISECTION_STEPS = 60

/** How many times the open-ended last stretch's ceiling may double before the search gives up. */
const CEILING_DOUBLINGS = 64

/** A take-home target to search for, under a table and a pay profile. */
interface Search {
  net: number
  year: TaxYear
  profile: PayProfile
}

/**
 * The gross between `lo` and `hi` whose take-home is the target. The caller
 * guarantees take-home doesn't change direction between them and the target
 * is strictly inside, whether take-home rises or falls across the stretch.
 */
function bisect(lo: number, hi: number, { net, year, profile }: Search): number {
  const rising = netFromGross(lo, year, profile) < net
  for (let i = 0; i < BISECTION_STEPS; i++) {
    const mid = (lo + hi) / 2
    // Short of the target on a rising stretch, or still above it on a falling
    // one, means the crossing is further on.
    if (netFromGross(mid, year, profile) < net === rising) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** What a search for a take-home found. */
interface Crossings {
  /** Every gross whose take-home is the target, lowest first. */
  salaries: number[]
  /** The ceiling the search reached on the open-ended last stretch. Only meaningful when `salaries` is empty. */
  searchedTo: number
}

/** Walks every stretch of take-home looking for a positive annual target. */
function crossingsOf(search: Search): Crossings {
  const { net, year, profile } = search
  const takeHome = (gross: number) => netFromGross(gross, year, profile)
  const kinks = slopeChangesOf(year, profile)
  const salaries: number[] = []

  // A target hit exactly at a slope change is recorded there, once. Neither
  // stretch either side of it counts it again, because a stretch is only
  // searched when its ends are *strictly* either side of the target.
  for (const [i, lo] of kinks.entries()) {
    const atLo = takeHome(lo)
    if (atLo === net) salaries.push(lo)
    const hi = kinks[i + 1]
    if (hi !== undefined && (atLo - net) * (takeHome(hi) - net) < 0) salaries.push(bisect(lo, hi, search))
  }

  // Past the last threshold take-home runs on in one direction for good, so
  // it can reach the target at most once more: rising towards it from below,
  // or falling to it from above. Grow a ceiling until it is past the target,
  // then bisect. Under a table whose rates take every extra pound the ceiling
  // never gets there, and the guard ends the search with a finite answer
  // rather than looping or returning Infinity.
  // Never empty: slopeChangesOf always starts at £0.
  const last = kinks[kinks.length - 1]
  const atLast = takeHome(last)
  const falling = takeHome(last + 1) < atLast
  let hi = last + net * 2 + 200000
  if (atLast < net || (atLast > net && falling)) {
    const stillShort = (gross: number) => takeHome(gross) < net === atLast < net
    for (let guard = 0; guard < CEILING_DOUBLINGS && stillShort(hi); guard++) hi = last + (hi - last) * 2
    if (!stillShort(hi)) salaries.push(bisect(last, hi, search))
  }

  return { salaries, searchedTo: hi }
}

/**
 * Every gross salary whose annual take-home is `net`, lowest first.
 *
 * Under today's tables with no deductions that is always exactly one,
 * because take-home rises with gross. More than one means take-home falls
 * somewhere in between, and then a take-home figure on its own can't say
 * which salary someone earns. Empty when no salary reaches the target at all:
 * under a table whose rates take every extra pound, or a profile whose
 * deductions do past some salary. A non-positive target is reached at £0.
 */
export function salariesForTakeHome(net: number, year: TaxYear = CURRENT_TAX_YEAR, profile: PayProfile = NO_DEDUCTIONS): number[] {
  if (net <= 0) return [0]
  return crossingsOf({ net, year, profile }).salaries
}

/**
 * The lowest gross salary that yields a given annual take-home: the answer to
 * "what would I need to earn?", since every salary below it takes home less.
 * Accurate to well under £1. Returns 0 for a non-positive target.
 *
 * If no salary reaches the target, this returns the finite ceiling where the
 * search stopped. Check `salariesForTakeHome` for an empty list first wherever
 * that can happen.
 */
export function grossFromNet(net: number, year: TaxYear = CURRENT_TAX_YEAR, profile: PayProfile = NO_DEDUCTIONS): number {
  if (net <= 0) return 0
  const { salaries, searchedTo } = crossingsOf({ net, year, profile })
  return salaries[0] ?? searchedTo
}

/** A stretch of pay that takes home no more than its own start does. */
export interface TakeHomePlateau {
  /** Where take-home peaks before falling away. */
  from: number
  /** Where take-home has climbed back to that peak, or the salary asked about if that comes first. */
  to: number
}

/**
 * The last stretch of pay below `gross` that takes home no more than its own
 * start does: from a salary where take-home peaks and then falls, to where it
 * has climbed back to that peak. `null` while take-home rises all the way up
 * to `gross`, as it always does under today's tables with no deductions.
 *
 * Take-home doesn't change direction between slope changes, so a peak is
 * always at one of them, and the highest one below `gross` is the peak that
 * matters.
 */
export function takeHomePlateauBelow(
  gross: number,
  year: TaxYear = CURRENT_TAX_YEAR,
  profile: PayProfile = NO_DEDUCTIONS,
): TakeHomePlateau | null {
  const takeHome = (salary: number) => netFromGross(salary, year, profile)
  const kinks = slopeChangesOf(year, profile)
  let peak = 0
  for (const kink of kinks) if (kink < gross && takeHome(kink) > takeHome(peak)) peak = kink
  const atPeak = takeHome(peak)

  // Only a peak if take-home falls straight after it. Probe halfway along the
  // stretch that follows, or halfway to `gross` if that comes first.
  const probe = (peak + Math.min(kinks.find((kink) => kink > peak) ?? Infinity, gross)) / 2
  if (takeHome(probe) >= atPeak) return null

  const climbedBack = salariesForTakeHome(atPeak, year, profile).filter((salary) => salary > peak)
  return { from: peak, to: Math.min(gross, ...climbedBack) }
}

/** Monthly take-home pay for an annual gross salary — the forward direction the Budget step's "enter my salary" option uses. 0 for a non-positive salary. */
export function monthlyTakeHomeFromGross(
  grossAnnual: number,
  year: TaxYear = CURRENT_TAX_YEAR,
  profile: PayProfile = NO_DEDUCTIONS,
): number {
  if (grossAnnual <= 0) return 0
  return netFromGross(grossAnnual, year, profile) / 12
}

/** The fraction of the next £1 of gross salary kept as take-home at a given income — 0.72 in the basic-rate band, ~0.38 in the £100k allowance-taper band, with no deductions. */
export function marginalNetRate(gross: number, year: TaxYear = CURRENT_TAX_YEAR, profile: PayProfile = NO_DEDUCTIONS): number {
  return netFromGross(gross + 1, year, profile) - netFromGross(gross, year, profile)
}

/**
 * True when a gross salary sits in the £100k–£125,140 allowance-taper band,
 * where the effective marginal rate spikes. The taper applies to pay after a
 * pension that comes off before tax, so salary sacrifice or net pay can move
 * a salary out of it; relief at source can't, on the payslip.
 */
export function inAllowanceTaper(gross: number, year: TaxYear = CURRENT_TAX_YEAR, profile: PayProfile = NO_DEDUCTIONS): boolean {
  const taxBase = baseAt(basesFor(profile.pension).tax, gross)
  return taxBase > year.taperThreshold && taxBase < year.taperThreshold + year.personalAllowance / year.taperRate
}
