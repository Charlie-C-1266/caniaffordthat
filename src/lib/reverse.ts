import {
  grossFromNet,
  marginalNetRate,
  inAllowanceTaper,
  netFromGross,
  salariesForTakeHome,
  takeHomePlateauBelow,
  type TakeHomePlateau,
} from './salary'
import { CURRENT_TAX_YEAR, type TaxYear } from './taxYears'
import { NO_DEDUCTIONS, type PayProfile } from './deductions'
import { num } from './calculations'
import type { CalculatorState } from '../state/types'

// The "flip it" story: given the monthly take-home a plan needs to be
// affordable (computed per-mode in derive.ts / vehicle.ts), work out the gross
// salary behind it and how it compares to what the user earns now. Pure glue
// over the salary engine so it's unit-testable and shared by both result cards.
//
// Two rules keep the comparison honest wherever one take-home can come from
// more than one salary, which today's tables never produce but a large
// relief-at-source pension in the £100k taper band would:
//   - A salary the user typed is used as typed, never worked back out of the
//     take-home it produces.
//   - "Already enough" compares take-home, which is what the plan is judged
//     on and is known even when the salary isn't. A lower salary needed does
//     not mean the user's own salary already covers it.

/**
 * What the flip knows about the user's pay now, as the Budget step captured
 * it: the annual salary they typed in salary mode, or the monthly take-home
 * they typed otherwise.
 */
export type CurrentPay = { kind: 'salary'; grossAnnual: number } | { kind: 'takehome'; takeHomeMonthly: number }

/**
 * The user's current pay from state. Salary mode only counts once a salary is
 * typed; until then the result runs on whatever take-home is in state, and so
 * does the flip.
 */
export function currentPayOf(state: Pick<CalculatorState, 'takeHomeMode' | 'grossSalary' | 'takeHome'>): CurrentPay {
  const grossAnnual = num(state.grossSalary)
  if (state.takeHomeMode === 'salary' && grossAnnual > 0) return { kind: 'salary', grossAnnual }
  return { kind: 'takehome', takeHomeMonthly: num(state.takeHome) }
}

interface SalaryFlip {
  /** Annual take-home the plan needs. */
  requiredTakeHomeAnnual: number
  /** The lowest gross salary that yields that take-home. */
  requiredGross: number
  /**
   * The user's gross now: the salary they typed, or in take-home mode the
   * salary their take-home comes from. `null` when more than one salary gives
   * that take-home, so there is no telling which one is theirs.
   */
  currentGross: number | null
  /**
   * How far the user's salary would have to move to land on the take-home the
   * plan needs: a pay rise (> 0) when they fall short, or how far their pay
   * could drop and still cover it (≤ 0) when they don't. `null` whenever
   * `currentGross` is.
   */
  grossGap: number | null
  /** Required minus current monthly take-home. */
  takeHomeMonthlyGap: number
  /** True when the user's take-home already covers the plan. Compares take-home, so it's known even when their salary isn't. */
  alreadyEnough: boolean
  /** Where the required gross sits against the ONS median full-time salary. */
  vsMedian: 'above' | 'below' | 'about'
  medianFullTimeSalary: number
  /** True when the required gross lands in the £100k personal-allowance taper band. */
  inTaperBand: boolean
  /**
   * £ of extra salary each extra £1 of take-home costs at the required gross —
   * the taper-band "delight" figure. `null` when an extra £1 of salary keeps
   * less than `MIN_KEPT_TO_QUOTE` of it, or nothing at all.
   */
  salaryPerTakeHome: number | null
  /**
   * A stretch of pay below the salary needed that takes home no more than its
   * start does on the payslip, which is why the salary needed sits past it.
   * `null` while take-home rises all the way up, as it always does under
   * today's tables.
   */
  payslipPlateau: TakeHomePlateau | null
}

/** Slack for comparing a salary the search found with one it was asked about: a penny, well under anything shown. */
const PENNY = 0.01

/**
 * The least of each extra £1 of salary that must be kept on the payslip for
 * the taper note to quote "£X of salary per £1 of take-home". Below 10p the
 * figure balloons (£33.33 at 3p kept, £166.67 at 0.6p) and stops meaning
 * much, so the note says how little is kept instead.
 */
export const MIN_KEPT_TO_QUOTE = 0.1

/**
 * The salary behind a take-home the user typed, or `null` when more than one
 * salary gives it. A take-home no salary reaches, possible only under a table
 * that takes every extra pound, falls back to `grossFromNet`'s finite ceiling.
 */
function salaryBehind(takeHomeAnnual: number, year: TaxYear, profile: PayProfile): number | null {
  const salaries = salariesForTakeHome(takeHomeAnnual, year, profile)
  if (salaries.length > 1) return null
  return salaries[0] ?? grossFromNet(takeHomeAnnual, year, profile)
}

/**
 * How far salary has to move from `currentGross` to land on the target
 * take-home, given every salary that yields it. Short of it, that is up to
 * the first such salary above; covering it, down to the last one below,
 * which is where take-home would drop under the target. While take-home rises
 * with gross both are simply the required salary minus the current one.
 */
function salaryGap(currentGross: number, targetSalaries: readonly number[], alreadyEnough: boolean, requiredGross: number): number {
  const landing = alreadyEnough
    ? targetSalaries.findLast((gross) => gross <= currentGross + PENNY)
    : targetSalaries.find((gross) => gross >= currentGross - PENNY)
  return (landing ?? requiredGross) - currentGross
}

/**
 * Builds the salary-flip story from the plan's required take-home and the
 * user's current pay, under a pay profile (no deductions by default).
 *
 * `year` defaults to the current table, matching every function in ./salary —
 * it is a parameter so a test can drive the engine with a synthetic table,
 * which is the only way to reach the defensive branch below, or a take-home
 * that more than one salary gives.
 */
export function salaryFlip(
  requiredTakeHomeMonthly: number,
  current: CurrentPay,
  year: TaxYear = CURRENT_TAX_YEAR,
  profile: PayProfile = NO_DEDUCTIONS,
): SalaryFlip {
  const requiredTakeHomeAnnual = requiredTakeHomeMonthly * 12
  const requiredGross = grossFromNet(requiredTakeHomeAnnual, year, profile)
  const currentTakeHomeMonthly =
    current.kind === 'salary' ? netFromGross(current.grossAnnual, year, profile) / 12 : Math.max(0, current.takeHomeMonthly)
  const currentGross =
    current.kind === 'salary' ? Math.max(0, current.grossAnnual) : salaryBehind(currentTakeHomeMonthly * 12, year, profile)
  const alreadyEnough = currentTakeHomeMonthly >= requiredTakeHomeMonthly
  const median = year.medianFullTimeSalary
  const ratio = requiredGross / median
  const marginal = marginalNetRate(requiredGross, year, profile)

  return {
    requiredTakeHomeAnnual,
    requiredGross,
    currentGross,
    grossGap:
      currentGross === null
        ? null
        : salaryGap(currentGross, salariesForTakeHome(requiredTakeHomeAnnual, year, profile), alreadyEnough, requiredGross),
    takeHomeMonthlyGap: requiredTakeHomeMonthly - currentTakeHomeMonthly,
    alreadyEnough,
    vsMedian: ratio > 1.05 ? 'above' : ratio < 0.95 ? 'below' : 'about',
    medianFullTimeSalary: median,
    inTaperBand: inAllowanceTaper(requiredGross, year, profile),
    // With the current tax tables the kept fraction never falls below ~0.38,
    // so this is always a figure today — reverse.test.ts sweeps every band
    // boundary to pin that claim down. Tables that keep 5p or nothing reach
    // the null, and the same tests cover them through the `year` parameter.
    salaryPerTakeHome: marginal >= MIN_KEPT_TO_QUOTE ? 1 / marginal : null,
    payslipPlateau: takeHomePlateauBelow(requiredGross, year, profile),
  }
}
