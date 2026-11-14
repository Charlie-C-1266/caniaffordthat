import { describe, it, expect } from 'vitest'
import {
  OFFERED_PENSION_ARRANGEMENTS,
  PENSION_ARRANGEMENT_BLURBS,
  PENSION_ARRANGEMENT_LABELS,
  STUDENT_LOAN_PLANS,
  STUDENT_PLAN_LABELS,
  describePayProfile,
  hasDeductions,
  payProfileOf,
  type PayProfileState,
} from './payProfile'
import { NO_DEDUCTIONS, type PayProfile } from './deductions'
import { DEFAULT_STATE } from '../state/defaults'
import { CURRENT_TAX_YEAR } from './taxYears'

/** The default pay-profile state with some fields changed. */
const stateWith = (patch: Partial<PayProfileState>): PayProfileState => ({ ...DEFAULT_STATE, ...patch })

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
