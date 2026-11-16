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
  takeHomeFor,
  type PayProfileState,
} from './payProfile'
import { monthlyTakeHomeFromGross } from './salary'
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

// The one derivation of salary-mode take-home, shared by BudgetStep and
// hydrateStateFromUrl so the two can't disagree (#292). Before it moved here,
// a shared link copied `takeHome` verbatim while the Budget step recomputed
// it, so the same link could show one figure on the payslip and work the
// result out on another.
describe('takeHomeFor', () => {
  it('derives the monthly take-home for a typed salary under a profile', () => {
    // Computed with the same engine rather than hard-coded, so a tax-table
    // change updates both sides together.
    const plan2NetPay = payProfileOf(
      stateWith({ studentPlan: 'plan2', pensionArrangement: 'netpay', pensionMode: 'percent', pensionPercent: 5 }),
    )
    const expected = monthlyTakeHomeFromGross(35000, CURRENT_TAX_YEAR, plan2NetPay)

    expect(takeHomeFor('35000', plan2NetPay)).toBe(String(Math.round(expected * 100) / 100))
    // And it is the figure the issue quotes, to the penny.
    expect(takeHomeFor('35000', plan2NetPay)).toBe('2234.52')
  })

  it.each([
    ['missing', ''],
    ['zero', '0'],
    ['a zero with pence', '0.00'],
    ['negative', '-5000'],
    ['junk', 'abc'],
  ])('returns an empty string for %s pay, as the UI does with no salary typed', (_case, grossSalary) => {
    expect(takeHomeFor(grossSalary, NO_DEDUCTIONS)).toBe('')
  })

  it('rounds to whole pence, including a figure ending in half a penny', () => {
    // Math.round takes a half-penny upward; what matters is that the stored
    // string is pence, never a long float.
    const stored = takeHomeFor('35000', NO_DEDUCTIONS)
    expect(stored).toMatch(/^\d+(\.\d{1,2})?$/)

    // A salary chosen so the unrounded monthly figure carries more than two
    // decimal places: the stored value must be the rounded one.
    const raw = monthlyTakeHomeFromGross(35000, CURRENT_TAX_YEAR, NO_DEDUCTIONS)
    expect(raw).not.toBe(Math.round(raw * 100) / 100)
    expect(stored).toBe(String(Math.round(raw * 100) / 100))
  })

  it('floors at zero when the pension takes more than the pay', () => {
    // No field in the UI can produce a negative take-home, so neither may
    // this: a £5,000-a-month pension on a £12,000 salary.
    const bigPension = payProfileOf(stateWith({ pensionArrangement: 'netpay', pensionMode: 'amount', pensionMonthlyAmount: '5000' }))
    const stored = takeHomeFor('12000', bigPension)

    expect(Number(stored)).toBeGreaterThanOrEqual(0)
    expect(stored).toBe('0')
  })

  it('gives a bigger take-home for salary sacrifice than for net pay, at the same percentage', () => {
    // The engine's own ordering, pinned through the helper so a wiring mistake
    // (passing the profile through wrong, say) shows up here.
    const base = { pensionMode: 'percent', pensionPercent: 5 } as const
    const sacrifice = takeHomeFor('35000', payProfileOf(stateWith({ ...base, pensionArrangement: 'sacrifice' })))
    const netpay = takeHomeFor('35000', payProfileOf(stateWith({ ...base, pensionArrangement: 'netpay' })))

    expect(Number(sacrifice)).toBeGreaterThan(Number(netpay))
  })
})
