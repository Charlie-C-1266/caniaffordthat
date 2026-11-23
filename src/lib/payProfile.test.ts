import { describe, it, expect } from 'vitest'
import {
  OFFERED_PENSION_ARRANGEMENTS,
  PENSION_ARRANGEMENT_BLURBS,
  PENSION_ARRANGEMENT_LABELS,
  STUDENT_LOAN_PLANS,
  STUDENT_PLAN_LABELS,
  describePayProfile,
  deductionsTakeAllPay,
  hasDeductions,
  payProfileOf,
  type PayProfileState,
} from './payProfile'
import { NO_DEDUCTIONS, type PayProfile } from './deductions'
import { DEFAULT_STATE } from '../state/defaults'
import type { CalculatorState } from '../state/types'
import { CURRENT_TAX_YEAR } from './taxYears'
import { monthlyTakeHomeFromGross } from './salary'

/** The default pay-profile state with some fields changed. */
const stateWith = (patch: Partial<PayProfileState>): PayProfileState => ({ ...DEFAULT_STATE, ...patch })

/** The default state with some fields changed — the whole state, as the app hands it over. */
const fullState = (patch: Partial<CalculatorState> = {}): CalculatorState => ({ ...DEFAULT_STATE, ...patch })

/** Salary mode on a given salary, with some other fields changed. */
const onSalary = (grossSalary: string, patch: Partial<CalculatorState> = {}): CalculatorState =>
  fullState({ takeHomeMode: 'salary', grossSalary, ...patch })

/** £20,000 in salary mode with a net pay pension of `pence` a month, for walking up to the amount that empties the payslip. */
const pensionOf = (pence: number): CalculatorState =>
  onSalary('20000', { pensionArrangement: 'netpay', pensionMode: 'amount', pensionMonthlyAmount: (pence / 100).toFixed(2) })

/** Every combination of undergraduate plan (or none) and postgraduate loan, so each clause shape is covered. */
const LOAN_COMBINATIONS: readonly Partial<CalculatorState>[] = [
  { studentPlan: 'none', postgradLoan: false },
  { studentPlan: 'none', postgradLoan: true },
  ...STUDENT_LOAN_PLANS.flatMap((studentPlan) => [
    { studentPlan, postgradLoan: false },
    { studentPlan, postgradLoan: true },
  ]),
]

describe('the choices offered', () => {
  it('offers every undergraduate plan the tax-year table has, each with a label', () => {
    expect(STUDENT_LOAN_PLANS.toSorted()).toEqual(Object.keys(CURRENT_TAX_YEAR.studentLoanPlans).toSorted())
    for (const plan of STUDENT_LOAN_PLANS) expect(STUDENT_PLAN_LABELS[plan]).toMatch(/^Plan \d$/)
  })

  it('offers salary sacrifice and net pay, but not relief at source yet', () => {
    expect(OFFERED_PENSION_ARRANGEMENTS).toEqual(['sacrifice', 'netpay'])
  })

  it('names and describes every arrangement', () => {
    for (const arrangement of ['sacrifice', 'netpay', 'ras'] as const) {
      expect(PENSION_ARRANGEMENT_LABELS[arrangement]).not.toBe('')
      expect(PENSION_ARRANGEMENT_BLURBS[arrangement]).not.toBe('')
    }
  })
})

describe('payProfileOf', () => {
  it('has no deductions in the default state', () => {
    expect(payProfileOf(DEFAULT_STATE)).toEqual(NO_DEDUCTIONS)
    expect(hasDeductions(payProfileOf(DEFAULT_STATE))).toBe(false)
  })

  it('carries the loans across as they are', () => {
    const profile = payProfileOf(stateWith({ studentPlan: 'plan4', postgradLoan: true }))
    expect(profile).toEqual({ studentPlan: 'plan4', postgradLoan: true, pension: null })
    expect(hasDeductions(profile)).toBe(true)
  })

  it('builds a percentage pension from the slider', () => {
    expect(payProfileOf(stateWith({ pensionArrangement: 'sacrifice', pensionPercent: 7.5 })).pension).toEqual({
      arrangement: 'sacrifice',
      mode: 'percent',
      percent: 7.5,
      monthlyAmount: 0,
    })
  })

  it('builds a monthly pension once an amount is typed, and none before', () => {
    const typed = stateWith({ pensionArrangement: 'netpay', pensionMode: 'amount', pensionMonthlyAmount: '150' })
    expect(payProfileOf(typed).pension).toEqual({ arrangement: 'netpay', mode: 'amount', percent: 5, monthlyAmount: 150 })
    expect(payProfileOf({ ...typed, pensionMonthlyAmount: '' }).pension).toBeNull()
    expect(payProfileOf({ ...typed, pensionMonthlyAmount: '0' }).pension).toBeNull()
  })

  it('has no pension while no arrangement is chosen, whatever the other fields say', () => {
    expect(payProfileOf(stateWith({ pensionPercent: 12, pensionMonthlyAmount: '300' })).pension).toBeNull()
  })
})

/** No deductions, with some fields changed. */
const profile = (patch: Partial<PayProfile>): PayProfile => ({ ...NO_DEDUCTIONS, ...patch })

describe('deductionsTakeAllPay', () => {
  // #317: a £-a-month pension can take everything the payslip has left, so
  // take-home comes out at £0.00. The Budget step then won't advance and both
  // result engines return `null`, and the page blamed a missing price and
  // take-home the user had already given.

  it('is never true in take-home mode, whatever the pay fields say', () => {
    // The figure typed there is already net of these, so nothing here can zero it.
    expect(deductionsTakeAllPay(DEFAULT_STATE)).toBe(false)
    expect(deductionsTakeAllPay(fullState({ takeHome: '0' }))).toBe(false)
    expect(deductionsTakeAllPay(fullState({ takeHome: '' }))).toBe(false)
    expect(
      deductionsTakeAllPay(
        fullState({ grossSalary: '20000', pensionArrangement: 'netpay', pensionMode: 'amount', pensionMonthlyAmount: '3000' }),
      ),
    ).toBe(false)
  })

  it('is false with no salary to take anything from', () => {
    const takesEverything = { pensionArrangement: 'netpay', pensionMode: 'amount', pensionMonthlyAmount: '3000' } as const
    expect(deductionsTakeAllPay(onSalary('', takesEverything))).toBe(false)
    expect(deductionsTakeAllPay(onSalary('0', takesEverything))).toBe(false)
  })

  it('is true when a £-a-month pension takes the whole payslip', () => {
    expect(
      deductionsTakeAllPay(
        onSalary('20000', { studentPlan: 'plan1', pensionArrangement: 'netpay', pensionMode: 'amount', pensionMonthlyAmount: '3000' }),
      ),
    ).toBe(true)
  })

  it('is true for both arrangements, under every loan combination', () => {
    for (const arrangement of OFFERED_PENSION_ARRANGEMENTS) {
      for (const loans of LOAN_COMBINATIONS) {
        const state = onSalary('20000', {
          ...loans,
          pensionArrangement: arrangement,
          pensionMode: 'amount',
          pensionMonthlyAmount: '3000',
        })
        expect(deductionsTakeAllPay(state), `${arrangement} ${loans.studentPlan}/${String(loans.postgradLoan)}`).toBe(true)
      }
    }
  })

  it('turns false the moment the payslip has a penny left', () => {
    // The exact boundary is found by bisection rather than hard-coded, so a
    // tax-table change moves it rather than breaking this test. It is not
    // simply the no-pension take-home: a net pay pension lowers taxable
    // income, so part of each pound it takes comes back as less tax.
    const takeHomePence = (pence: number) =>
      Math.round(monthlyTakeHomeFromGross(20000, CURRENT_TAX_YEAR, payProfileOf(pensionOf(pence))) * 100)

    // Bracket the boundary: 1p leaves plenty, £3,000 a month takes everything.
    let leavesSomething = 1
    let takesItAll = 300_000
    expect(takeHomePence(leavesSomething)).toBeGreaterThan(0)
    expect(takeHomePence(takesItAll)).toBeLessThanOrEqual(0)

    while (takesItAll - leavesSomething > 1) {
      const mid = Math.floor((leavesSomething + takesItAll) / 2)
      if (takeHomePence(mid) <= 0) takesItAll = mid
      else leavesSomething = mid
    }

    // One penny apart, on either side of the dead end.
    expect(takesItAll - leavesSomething).toBe(1)
    expect(deductionsTakeAllPay(pensionOf(takesItAll))).toBe(true)
    expect(deductionsTakeAllPay(pensionOf(takesItAll + 1))).toBe(true)
    expect(deductionsTakeAllPay(pensionOf(leavesSomething))).toBe(false)
    // And what survives is a real penny, not a rounding artefact.
    expect(takeHomePence(leavesSomething)).toBeGreaterThanOrEqual(1)
  })

  it('is false for a percentage pension, even at the 50% maximum', () => {
    // The slider stops at 50% precisely so a percentage can never take the
    // whole payslip, so this branch is unreachable by hand.
    for (const arrangement of OFFERED_PENSION_ARRANGEMENTS) {
      for (const gross of ['13000', '20000', '35000', '125140', '200000']) {
        const state = onSalary(gross, { pensionArrangement: arrangement, pensionMode: 'percent', pensionPercent: 50 })
        expect(deductionsTakeAllPay(state), `${arrangement} on £${gross}`).toBe(false)
      }
    }
  })

  it('is false for a salary with no deductions at all', () => {
    expect(deductionsTakeAllPay(onSalary('35000'))).toBe(false)
    expect(deductionsTakeAllPay(onSalary('10000'))).toBe(false)
  })

  it('is false for loans alone, which can never take a whole payslip', () => {
    for (const loans of LOAN_COMBINATIONS) {
      for (const gross of ['20000', '35000', '125140']) {
        expect(deductionsTakeAllPay(onSalary(gross, loans)), `£${gross} ${loans.studentPlan}`).toBe(false)
      }
    }
  })

  it('reads the payslip rather than the stored take-home, so a link cannot make it lie', () => {
    // `state.takeHome` is only written when the salary or the profile
    // changes, so a hand-made link that sets grossSalary and omits takeHome
    // leaves it empty. Reading it would blame the pension for a take-home the
    // link never carried: this £150-a-month pension leaves plenty.
    const linkWithoutTakeHome = onSalary('35000', {
      pensionArrangement: 'netpay',
      pensionMode: 'amount',
      pensionMonthlyAmount: '150',
      takeHome: '',
    })
    expect(deductionsTakeAllPay(linkWithoutTakeHome)).toBe(false)

    // And the other way round: a stale takeHome cannot hide a pension that really does take it all.
    const staleTakeHome = onSalary('20000', {
      pensionArrangement: 'netpay',
      pensionMode: 'amount',
      pensionMonthlyAmount: '3000',
      takeHome: '1500',
    })
    expect(deductionsTakeAllPay(staleTakeHome)).toBe(true)
  })
})

describe('describePayProfile', () => {
  it("keeps today's wording with no deductions", () => {
    expect(describePayProfile(NO_DEDUCTIONS)).toBe('no student loan or pension')
  })

  it('names the loans', () => {
    expect(describePayProfile(profile({ studentPlan: 'plan2' }))).toBe('Plan 2 student loan, no pension')
    expect(describePayProfile(profile({ postgradLoan: true }))).toBe('Postgraduate Loan, no pension')
    expect(describePayProfile(profile({ studentPlan: 'plan5', postgradLoan: true }))).toBe('Plan 5 and Postgraduate Loan, no pension')
  })

  it('names the pension, its size and how it is paid', () => {
    expect(describePayProfile(profile({ pension: { arrangement: 'netpay', mode: 'percent', percent: 5, monthlyAmount: 0 } }))).toBe(
      'no student loan, 5% net pay pension',
    )
    expect(
      describePayProfile(
        profile({ studentPlan: 'plan1', pension: { arrangement: 'sacrifice', mode: 'amount', percent: 5, monthlyAmount: 150 } }),
      ),
    ).toBe('Plan 1 student loan, £150/month salary sacrifice pension')
  })
})
