import { describe, it, expect } from 'vitest'
import { fmtPence } from './calculations'
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
  takeHomeFor,
  type PayProfileState,
} from './payProfile'
import { monthlyTakeHomeFromGross } from './salary'
import { NO_DEDUCTIONS, type PayProfile } from './deductions'
import { DEFAULT_STATE } from '../state/defaults'
import type { CalculatorState } from '../state/types'
import { CURRENT_TAX_YEAR } from './taxYears'

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
