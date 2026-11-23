import { num, fmt } from './calculations'
import { monthlyTakeHomeFromGross } from './salary'
import { CURRENT_TAX_YEAR } from './taxYears'
import type { PayProfile } from './deductions'
import type { CalculatorState, PensionArrangement, StudentLoanPlan } from '../state/types'

// The pay profile as the site presents it: which choices the Budget step
// offers, how its state becomes the `PayProfile` the salary engine takes, and
// the words every caption uses to say what was applied. One module, so the
// Budget step, the flip panel and shared links can't disagree about any of
// it.

/** The undergraduate plans, in the order the Budget step offers them. */
export const STUDENT_LOAN_PLANS: readonly StudentLoanPlan[] = ['plan1', 'plan2', 'plan4', 'plan5']

/** How each plan is named on screen. */
export const STUDENT_PLAN_LABELS: Readonly<Record<StudentLoanPlan, string>> = {
  plan1: 'Plan 1',
  plan2: 'Plan 2',
  plan4: 'Plan 4',
  plan5: 'Plan 5',
}

/**
 * The pension arrangements the Budget step offers, in order. Relief at source
 * isn't offered yet: it is the one arrangement that can make take-home fall as
 * pay rises on the payslip, or leave some plans out of reach of any salary,
 * and the site has to explain both before it asks for one. A shared link
 * naming it falls back to no pension.
 */
export const OFFERED_PENSION_ARRANGEMENTS: readonly PensionArrangement[] = ['sacrifice', 'netpay']

/** How each arrangement is named on screen. */
export const PENSION_ARRANGEMENT_LABELS: Readonly<Record<PensionArrangement, string>> = {
  sacrifice: 'Salary sacrifice',
  netpay: 'Net pay',
  ras: 'Relief at source',
}

/** One line on what each arrangement does to pay, shown once one is chosen. */
export const PENSION_ARRANGEMENT_BLURBS: Readonly<Record<PensionArrangement, string>> = {
  sacrifice: 'Your salary itself is lowered, so less income tax, National Insurance and student loan comes off it.',
  netpay: 'Taken from your pay before income tax, so it lowers your tax, but not your National Insurance or student loan.',
  ras: 'Taken from your pay after tax, and your pension provider adds 20% on top.',
}

/** The state fields a pay profile is made from. */
export type PayProfileState = Pick<
  CalculatorState,
  'studentPlan' | 'postgradLoan' | 'pensionArrangement' | 'pensionMode' | 'pensionPercent' | 'pensionMonthlyAmount'
>

/**
 * The pay profile the Budget step's "About your pay" section describes. A
 * pension given as a monthly amount counts only once an amount is typed:
 * until then there is nothing to take.
 */
export function payProfileOf(state: PayProfileState): PayProfile {
  const monthlyAmount = num(state.pensionMonthlyAmount)
  const noAmountYet = state.pensionMode === 'amount' && monthlyAmount <= 0
  return {
    studentPlan: state.studentPlan,
    postgradLoan: state.postgradLoan,
    pension:
      state.pensionArrangement === 'none' || noAmountYet
        ? null
        : { arrangement: state.pensionArrangement, mode: state.pensionMode, percent: state.pensionPercent, monthlyAmount },
  }
}

/** The state fields that decide whether a salary leaves any take-home: the pay profile, plus the income mode and salary it applies to. */
export type TakeHomeState = PayProfileState & Pick<CalculatorState, 'takeHomeMode' | 'grossSalary'>

/**
 * True when "About your pay" leaves nothing of the salary to plan with:
 * salary mode, a salary typed, and a payslip whose take-home comes to £0.00.
 *
 * `monthlyPayslipLines` caps the PENSION line at whatever the payslip has
 * left, so a £-a-month pension can take everything. The Budget step then
 * won't advance and both result engines return `null` — and without knowing
 * why, the page blames a missing price and take-home the user has already
 * given (#317). A percentage pension can't get here: its slider stops at 50%,
 * and the loans are a share of pay above a threshold, so neither can take
 * everything on its own.
 *
 * The take-home is worked out from the salary and profile rather than read
 * from `state.takeHome`. That field is only written when the salary or the
 * profile changes, so a hand-made link that sets `grossSalary` and omits
 * `takeHome` leaves it empty — and reading it would blame the pension for a
 * take-home the link simply never carried. For such a link the generic "fill
 * in a price and take-home pay" wording is the right answer, so this stays
 * false and that is what shows.
 *
 * Compared as whole pence, which is what the payslip shows and what the
 * Budget step stores, so this is true exactly when the step really stalls.
 */
export function deductionsTakeAllPay(state: TakeHomeState): boolean {
  if (state.takeHomeMode !== 'salary') return false
  const grossAnnual = num(state.grossSalary)
  if (grossAnnual <= 0) return false
  return Math.round(monthlyTakeHomeFromGross(grossAnnual, CURRENT_TAX_YEAR, payProfileOf(state)) * 100) <= 0
}

/** True when a profile takes anything at all besides income tax and NI. */
export function hasDeductions(profile: PayProfile): boolean {
  return profile.studentPlan !== 'none' || profile.postgradLoan || profile.pension !== null
}

/**
 * What a profile applies, in the words the captions use: "no student loan
 * or pension", or e.g. "Plan 2 student loan, 5% net pay pension". Every
 * clause says what *was* applied, so the caption is never vaguer than the
 * figure it sits under.
 */
export function describePayProfile(profile: PayProfile): string {
  if (!hasDeductions(profile)) return 'no student loan or pension'

  const plan = profile.studentPlan === 'none' ? null : STUDENT_PLAN_LABELS[profile.studentPlan]
  const loans =
    plan && profile.postgradLoan
      ? `${plan} and Postgraduate Loan`
      : plan
        ? `${plan} student loan`
        : profile.postgradLoan
          ? 'Postgraduate Loan'
          : 'no student loan'

  const { pension } = profile
  if (pension === null) return `${loans}, no pension`
  const size = pension.mode === 'percent' ? `${pension.percent}%` : `${fmt(pension.monthlyAmount)}/month`
  return `${loans}, ${size} ${PENSION_ARRANGEMENT_LABELS[pension.arrangement].toLowerCase()} pension`
}
