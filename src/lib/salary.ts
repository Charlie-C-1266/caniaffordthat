import { CURRENT_TAX_YEAR, type TaxYear } from './taxYears'

// Gross salary ⇄ take-home pay for the reverse "what would I need to earn?"
// mode. `netFromGross` is the forward PAYE calc (income tax + employee NI);
// `grossFromNet` inverts it by bisection rather than closed-form algebra — the
// personal-allowance taper makes the piecewise inverse fiddly and easy to get
// subtly wrong, whereas bisection over the monotonic forward function is
// impossible to get wrong if the forward function is right. All figures are
// annual, rest-of-UK, employment income (see taxYears.ts for the assumptions).
//
// That "monotonic" is a precondition, not a given. It holds for the deductions
// modelled here, but a relief-at-source pension above ~28.75% in the £100k
// allowance-taper band would make take-home *fall* as gross rises, and bisection
// cannot be trusted on a curve that turns over. Read
// docs/salary-engine-monotonicity.md before adding student loan or pension
// deductions — the inversion has to change in the same commit.

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

/**
 * The gross salary that yields a given annual take-home, found by bisection on
 * the monotonic `netFromGross`. Accurate to well under £1. Returns 0 for a
 * non-positive target.
 */
export function grossFromNet(net: number, year: TaxYear = CURRENT_TAX_YEAR): number {
  if (net <= 0) return 0
  let lo = 0
  // Gross is never more than ~1.9x net even at the top marginal rate, but grow
  // the ceiling defensively until it brackets the target.
  let hi = net * 2 + 200000
  for (let guard = 0; guard < 64 && netFromGross(hi, year) < net; guard++) hi *= 2
  // ~60 halvings takes the bracket to sub-penny precision.
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (netFromGross(mid, year) < net) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
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
