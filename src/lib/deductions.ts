import type { PensionArrangement, RateMode, StudentLoanPlan } from '../state/types'
import type { LoanTerms, TaxYear } from './taxYears'

// Student loans and workplace pensions: what comes between gross pay and
// take-home besides income tax and NI. salary.ts applies these rules; this
// module only says what each deduction is charged on and how much it takes.
//
// Two facts decide how the two interact, so they can't be built apart:
//   - Student loan repayments are worked out on the same gross pay as
//     employer NI (GOV.UK, student loan guidance for employers). Salary
//     sacrifice lowers that pay. A pension taken under net pay or relief at
//     source doesn't, because NI is charged on pay before pension
//     contributions (HMRC National Insurance Manual, NIM02365).
//   - Relief at source comes out of taxed pay, and the provider adds 20%, so
//     each £1 in the pot costs 80p of take-home (GOV.UK, pension tax relief).
//     A higher-rate taxpayer can claim more back after the year ends. That is
//     not shown: the engine models the payslip, because the calculator answers
//     a monthly question and a refund next year can't be spent this month.

/** A workplace pension contribution as the user describes it. */
export interface PensionInput {
  arrangement: PensionArrangement
  /** A percentage of salary, or a fixed amount each month. */
  mode: RateMode
  /** `percent` mode: the scheme's rate as a percentage of the whole salary (5 = 5%), meaning what lands in the pot. */
  percent: number
  /**
   * `amount` mode: what leaves pay each month, as it shows on the payslip.
   * Under salary sacrifice that is how far the salary drops; under net pay,
   * what comes off before tax; under relief at source, what comes off after
   * it, with the pot receiving this ÷ 0.8.
   */
  monthlyAmount: number
}

/** Everything between gross pay and take-home besides income tax and NI. */
export interface PayProfile {
  /** The undergraduate plan being repaid, if any. Someone on two plans picks the one with the lower threshold: GOV.UK takes a single repayment over the lowest. */
  studentPlan: StudentLoanPlan | 'none'
  /** True when repaying a Postgraduate Loan, which is taken on top of any undergraduate plan. */
  postgradLoan: boolean
  pension: PensionInput | null
}

/** No student loan and no pension: take-home after income tax and NI alone. */
export const NO_DEDUCTIONS: PayProfile = { studentPlan: 'none', postgradLoan: false, pension: null }

/**
 * A pay base as a straight line in gross salary: `max(0, scale × gross − offset)`.
 * Income tax is worked out on one base, and NI and student loans on another.
 * Because both are straight lines, salary.ts can tell exactly where take-home
 * changes slope.
 */
export interface LinearBase {
  scale: number
  offset: number
}

/** The base a pay base takes at a given gross salary. */
export function baseAt(base: LinearBase, gross: number): number {
  return Math.max(0, base.scale * gross - base.offset)
}

/** The gross salary at which a base reaches `value`, or NaN for a base that never moves. */
export function grossWhereBaseIs(value: number, base: LinearBase): number {
  return base.scale > 0 ? (value + base.offset) / base.scale : Number.NaN
}

/** Gross pay itself, as a base. */
const WHOLE_SALARY: LinearBase = { scale: 1, offset: 0 }

/**
 * The bases a pension sets: one for income tax, one for NI and student
 * loans. Salary sacrifice lowers both, net pay only the first, and relief at
 * source neither. A contribution beyond the salary itself lowers a base to
 * nothing, not below.
 */
export function basesFor(pension: PensionInput | null): { tax: LinearBase; ni: LinearBase } {
  if (pension === null || pension.arrangement === 'ras') return { tax: WHOLE_SALARY, ni: WHOLE_SALARY }
  const lowered: LinearBase =
    pension.mode === 'percent'
      ? { scale: Math.max(0, 1 - pension.percent / 100), offset: 0 }
      : { scale: 1, offset: Math.max(0, pension.monthlyAmount) * 12 }
  return { tax: lowered, ni: pension.arrangement === 'sacrifice' ? lowered : WHOLE_SALARY }
}

/** An `amount`-mode pension's annual contribution into the pot, before it is capped at the salary. */
function fixedContribution(pension: PensionInput, year: TaxYear): number {
  const fromPay = Math.max(0, pension.monthlyAmount) * 12
  return pension.arrangement === 'ras' ? fromPay / (1 - year.reliefAtSourceRate) : fromPay
}

/**
 * What a pension takes at a gross salary, annually: what lands in the pot,
 * and what it costs take-home. The pot gets no more than the salary itself,
 * since tax relief only covers contributions up to 100% of earnings.
 *
 * Under salary sacrifice and net pay the two are the same. Under relief at
 * source each £1 in the pot costs 80p, the provider adding the rest.
 */
export function pensionAt(gross: number, pension: PensionInput | null, year: TaxYear): { intoPension: number; fromPay: number } {
  if (pension === null) return { intoPension: 0, fromPay: 0 }
  const uncapped = pension.mode === 'percent' ? (Math.max(0, pension.percent) / 100) * gross : fixedContribution(pension, year)
  const intoPension = Math.min(gross, uncapped)
  return { intoPension, fromPay: pension.arrangement === 'ras' ? intoPension * (1 - year.reliefAtSourceRate) : intoPension }
}

/**
 * Where a pension's own cost changes slope: an `amount`-mode contribution
 * grows with salary until it reaches its fixed size, then stays there. A
 * percentage never stops growing, so it adds nothing.
 */
export function pensionSlopeChangesFor(pension: PensionInput | null, year: TaxYear): number[] {
  return pension?.mode === 'amount' ? [fixedContribution(pension, year)] : []
}

/** The repayment thresholds a profile's loans add, on the NI base. */
export function loanThresholdsFor(profile: PayProfile, year: TaxYear): number[] {
  return [
    ...(profile.studentPlan === 'none' ? [] : [year.studentLoanPlans[profile.studentPlan].threshold]),
    ...(profile.postgradLoan ? [year.postgraduateLoan.threshold] : []),
  ]
}

/** Annual student and postgraduate loan repayments on a loan base: the same pay employer NI is worked out on. */
export function studentLoansOn(loanBase: number, profile: PayProfile, year: TaxYear): { studentLoan: number; postgraduateLoan: number } {
  const repaid = (terms: LoanTerms) => terms.rate * Math.max(0, loanBase - terms.threshold)
  return {
    studentLoan: profile.studentPlan === 'none' ? 0 : repaid(year.studentLoanPlans[profile.studentPlan]),
    postgraduateLoan: profile.postgradLoan ? repaid(year.postgraduateLoan) : 0,
  }
}
