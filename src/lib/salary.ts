import { CURRENT_TAX_YEAR, type TaxYear } from './taxYears'

// Gross salary ⇄ take-home pay for the reverse "what would I need to earn?"
// mode. `netFromGross` is the forward PAYE calc (income tax + employee NI).
// The reverse direction never untangles the algebra, which the personal-
// allowance taper makes fiddly and easy to get subtly wrong: it searches the
// forward function instead, so it is right whenever the forward function is.
// All figures are annual, rest-of-UK, employment income (see taxYears.ts for
// the assumptions).
//
// The search does not assume take-home keeps rising as gross rises. Under
// today's tables it does, but a relief-at-source pension above ~28.75% in the
// £100k taper band would make it fall for a stretch, and then one take-home
// comes from more than one salary. Take-home is a straight line between the
// points where some figure crosses a threshold in the table, so
// `salariesForTakeHome` lists those points, and bisects inside each straight
// stretch whose ends sit either side of the target. A straight stretch can
// cross the target at most once, so this finds every salary, not just one.
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

/** Annual income tax due on a gross salary. */
export function incomeTaxOn(gross: number, year: TaxYear = CURRENT_TAX_YEAR): number {
  const taxable = Math.max(0, gross - allowanceFor(gross, year))
  return chargeOver(taxable, year.incomeTaxBands)
}

/** Annual employee National Insurance due on a gross salary. */
export function nationalInsuranceOn(gross: number, year: TaxYear = CURRENT_TAX_YEAR): number {
  return chargeOver(Math.max(0, gross), year.niBands)
}

/** Annual take-home pay for a gross salary: gross less income tax and employee NI. */
export function netFromGross(gross: number, year: TaxYear = CURRENT_TAX_YEAR): number {
  const g = Math.max(0, gross)
  return g - incomeTaxOn(g, year) - nationalInsuranceOn(g, year)
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
 * Every gross salary at which take-home changes slope, ascending from £0:
 * where tax starts, each income-tax band edge, the taper's start and end, and
 * each NI band edge. Between two neighbours take-home is a straight line.
 */
function slopeChangesOf(year: TaxYear): number[] {
  const points = [
    0,
    year.taperThreshold,
    taperEndOf(year),
    grossForTaxable(0, year),
    ...year.incomeTaxBands.map((band) => grossForTaxable(band.upTo, year)),
    ...year.niBands.map((band) => band.upTo),
  ]
  return [...new Set(points.filter((point) => Number.isFinite(point) && point >= 0))].toSorted((a, b) => a - b)
}

/** Halvings per bisection: enough to take any bracket the search uses to well under a penny. */
const BISECTION_STEPS = 60

/** How many times the open-ended last stretch's ceiling may double before the search gives up. */
const CEILING_DOUBLINGS = 64

/**
 * The gross between `lo` and `hi` whose take-home is `net`. The caller
 * guarantees take-home is a straight line between them with `net` strictly
 * inside, whether it rises or falls across the stretch.
 */
function bisect(lo: number, hi: number, net: number, year: TaxYear): number {
  const rising = netFromGross(lo, year) < net
  for (let i = 0; i < BISECTION_STEPS; i++) {
    const mid = (lo + hi) / 2
    // Short of the target on a rising stretch, or still above it on a falling
    // one, means the crossing is further on.
    if (netFromGross(mid, year) < net === rising) lo = mid
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

/** Walks every straight stretch of take-home looking for a positive annual target. */
function crossingsOf(net: number, year: TaxYear): Crossings {
  const kinks = slopeChangesOf(year)
  const salaries: number[] = []

  // A target hit exactly at a slope change is recorded there, once. Neither
  // stretch either side of it counts it again, because a stretch is only
  // searched when its ends are *strictly* either side of the target.
  for (const [i, lo] of kinks.entries()) {
    const atLo = netFromGross(lo, year)
    if (atLo === net) salaries.push(lo)
    const hi = kinks[i + 1]
    if (hi !== undefined && (atLo - net) * (netFromGross(hi, year) - net) < 0) salaries.push(bisect(lo, hi, net, year))
  }

  // Past the last threshold take-home runs on as one straight line, so it can
  // reach the target at most once more: rising towards it from below, or
  // falling to it from above. Grow a ceiling until it is past the target, then
  // bisect. Under a table whose rates take every extra pound the ceiling never
  // gets there, and the guard ends the search with a finite answer rather
  // than looping or returning Infinity.
  // Never empty: slopeChangesOf always starts at £0.
  const last = kinks[kinks.length - 1]
  const atLast = netFromGross(last, year)
  const falling = netFromGross(last + 1, year) < atLast
  let hi = last + net * 2 + 200000
  if (atLast < net || (atLast > net && falling)) {
    const stillShort = (gross: number) => netFromGross(gross, year) < net === atLast < net
    for (let guard = 0; guard < CEILING_DOUBLINGS && stillShort(hi); guard++) hi = last + (hi - last) * 2
    if (!stillShort(hi)) salaries.push(bisect(last, hi, net, year))
  }

  return { salaries, searchedTo: hi }
}

/**
 * Every gross salary whose annual take-home is `net`, lowest first.
 *
 * Under today's tables that is always exactly one, because take-home rises
 * with gross. More than one means take-home falls somewhere in between, and
 * then a take-home figure on its own can't say which salary someone earns.
 * Empty only under a table whose rates take every extra pound, where the
 * target can't be reached at all. A non-positive target is reached at £0.
 */
export function salariesForTakeHome(net: number, year: TaxYear = CURRENT_TAX_YEAR): number[] {
  if (net <= 0) return [0]
  return crossingsOf(net, year).salaries
}

/**
 * The lowest gross salary that yields a given annual take-home: the answer to
 * "what would I need to earn?", since every salary below it takes home less.
 * Accurate to well under £1. Returns 0 for a non-positive target.
 *
 * If no salary reaches the target, which only a table that takes every extra
 * pound can cause, this returns the finite ceiling where the search stopped.
 */
export function grossFromNet(net: number, year: TaxYear = CURRENT_TAX_YEAR): number {
  if (net <= 0) return 0
  const { salaries, searchedTo } = crossingsOf(net, year)
  return salaries[0] ?? searchedTo
}

/** Monthly take-home pay for an annual gross salary — the forward direction the Budget step's "enter my salary" option uses. 0 for a non-positive salary. */
export function monthlyTakeHomeFromGross(grossAnnual: number, year: TaxYear = CURRENT_TAX_YEAR): number {
  if (grossAnnual <= 0) return 0
  return netFromGross(grossAnnual, year) / 12
}

/** The fraction of the next £1 of gross salary kept after tax and NI at a given income — 0.72 in the basic-rate band, ~0.38 in the £100k allowance-taper band. */
export function marginalNetRate(gross: number, year: TaxYear = CURRENT_TAX_YEAR): number {
  return netFromGross(gross + 1, year) - netFromGross(gross, year)
}

/** True when a gross salary sits in the £100k–£125,140 allowance-taper band, where the effective marginal rate spikes. */
export function inAllowanceTaper(gross: number, year: TaxYear = CURRENT_TAX_YEAR): boolean {
  return gross > year.taperThreshold && gross < year.taperThreshold + year.personalAllowance / year.taperRate
}
