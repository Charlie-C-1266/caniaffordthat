import { describe, it, expect } from 'vitest'
import { fmtPence } from './calculations'
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

/** The caption for an amount-mode pension of `amount` a month, under `arrangement`, with an optional loan. */
const caption = (amount: number, arrangement: 'sacrifice' | 'netpay' = 'netpay', patch: Partial<PayProfile> = {}) =>
  describePayProfile(profile({ ...patch, pension: { arrangement, mode: 'amount', percent: 5, monthlyAmount: amount } }))

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

  // #318: the amount was formatted with `fmt`, which rounds to whole pounds,
  // so the caption could name a figure the PENSION line above it contradicts:
  // £150.50 read "£151/month", and 40p read "£0/month" — a £0 pension beside
  // a line taking 40p. Every clause is meant to say what *was* applied.
  describe('a pension given as a monthly amount', () => {
    it('shows the pence when the amount has any', () => {
      expect(caption(150.5)).toBe('no student loan, £150.50/month net pay pension')
      expect(caption(99.5)).toBe('no student loan, £99.50/month net pay pension')
    })

    it('keeps one trailing zero rather than reading as £150.5', () => {
      expect(caption(150.5)).toContain('£150.50/month')
      expect(caption(150.5)).not.toContain('£150.5/month')
    })

    it('never calls a small amount a £0 pension', () => {
      // payProfileOf treats any amount above 0 as a pension, so this clause
      // has to name it rather than round it away.
      expect(caption(0.4)).toBe('no student loan, £0.40/month net pay pension')
      expect(caption(0.01)).toBe('no student loan, £0.01/month net pay pension')
      for (const tiny of [0.01, 0.4, 0.99]) expect(caption(tiny)).not.toContain('£0/month')
    })

    it('keeps the thousands separator', () => {
      expect(caption(1234.56)).toBe('no student loan, £1,234.56/month net pay pension')
    })

    it("keeps today's wording for a whole-pound amount", () => {
      expect(caption(150)).toBe('no student loan, £150/month net pay pension')
      expect(caption(150.0)).toBe('no student loan, £150/month net pay pension')
      expect(caption(1200)).toBe('no student loan, £1,200/month net pay pension')
    })

    it('agrees with the payslip for an amount carrying more decimals than a penny', () => {
      // A share link can carry `pensionMonthlyAmount=150.505`. Whatever the
      // caption shows has to be what the PENSION line shows, so both are
      // formatted by fmtPence — here, £150.51.
      expect(caption(150.505)).toContain(`${fmtPence(150.505)}/month`)
      expect(caption(150.505)).toContain('£150.51/month')
    })

    it('covers every clause shape, under both arrangements and each loan', () => {
      for (const arrangement of ['sacrifice', 'netpay'] as const) {
        const named = arrangement === 'sacrifice' ? 'salary sacrifice' : 'net pay'
        expect(caption(150.5, arrangement)).toBe(`no student loan, £150.50/month ${named} pension`)
        expect(caption(150.5, arrangement, { studentPlan: 'plan2' })).toBe(`Plan 2 student loan, £150.50/month ${named} pension`)
        expect(caption(150.5, arrangement, { postgradLoan: true })).toBe(`Postgraduate Loan, £150.50/month ${named} pension`)
        expect(caption(150.5, arrangement, { studentPlan: 'plan4', postgradLoan: true })).toBe(
          `Plan 4 and Postgraduate Loan, £150.50/month ${named} pension`,
        )
        // And the whole-pound wording is unchanged in every one of them.
        expect(caption(150, arrangement, { studentPlan: 'plan2' })).toBe(`Plan 2 student loan, £150/month ${named} pension`)
      }
    })

    it('leaves percent mode alone, which already shows what was typed', () => {
      expect(describePayProfile(profile({ pension: { arrangement: 'netpay', mode: 'percent', percent: 7.5, monthlyAmount: 0 } }))).toBe(
        'no student loan, 7.5% net pay pension',
      )
    })
  })
})
