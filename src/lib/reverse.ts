import { grossFromNet, marginalNetRate, inAllowanceTaper } from './salary'
import { CURRENT_TAX_YEAR } from './taxYears'
import type { TaxYear } from './taxYears'

// The "flip it" story: given the monthly take-home a plan needs to be
// affordable (computed per-mode in derive.ts / vehicle.ts), work out the gross
// salary behind it and how it compares to what the user earns now. Pure glue
// over the salary engine so it's unit-testable and shared by both result cards.

export interface SalaryFlip {
  /** Annual take-home the plan needs. */
  requiredTakeHomeAnnual: number
  /** Gross salary that yields that take-home. */
  requiredGross: number
  /** The user's current gross, inverted from the take-home they entered. */
  currentGross: number
  /** requiredGross − currentGross: the pay rise needed (≤ 0 when they already earn enough). */
  grossGap: number
  /** Required minus current monthly take-home. */
  takeHomeMonthlyGap: number
  /** True when the user already earns enough for the plan. */
  alreadyEnough: boolean
  /** Where the required gross sits against the ONS median full-time salary. */
  vsMedian: 'above' | 'below' | 'about'
  medianFullTimeSalary: number
  /** True when the required gross lands in the £100k personal-allowance taper band. */
  inTaperBand: boolean
  /** £ of extra salary each extra £1 of take-home costs at the required gross — the taper-band "delight" figure. */
  salaryPerTakeHome: number
}

/**
 * Builds the salary-flip story from the plan's required monthly take-home and
 * the take-home the user entered.
 *
 * `year` defaults to the current table, matching every function in ./salary —
 * it is a parameter so a test can drive the engine with a synthetic table,
 * which is the only way to reach the defensive branch below.
 */
export function salaryFlip(requiredTakeHomeMonthly: number, currentTakeHomeMonthly: number, year: TaxYear = CURRENT_TAX_YEAR): SalaryFlip {
  const requiredTakeHomeAnnual = requiredTakeHomeMonthly * 12
  const requiredGross = grossFromNet(requiredTakeHomeAnnual, year)
  const currentGross = grossFromNet(Math.max(0, currentTakeHomeMonthly) * 12, year)
  const grossGap = requiredGross - currentGross
  const median = year.medianFullTimeSalary
  const ratio = requiredGross / median
  const marginal = marginalNetRate(requiredGross, year)

  return {
    requiredTakeHomeAnnual,
    requiredGross,
    currentGross,
    grossGap,
    takeHomeMonthlyGap: requiredTakeHomeMonthly - currentTakeHomeMonthly,
    alreadyEnough: grossGap <= 0,
    vsMedian: ratio > 1.05 ? 'above' : ratio < 0.95 ? 'below' : 'about',
    medianFullTimeSalary: median,
    inTaperBand: inAllowanceTaper(requiredGross, year),
    // Defensive: with the current tax tables the kept fraction never falls
    // below ~0.38, so this can't divide by zero today — reverse.test.ts sweeps
    // every band boundary to pin that claim down. A table with a 100% marginal
    // band would reach the fallback, and the same test covers it through the
    // `year` parameter rather than leaving the branch unexercised.
    salaryPerTakeHome: marginal > 0 ? 1 / marginal : 0,
  }
}
