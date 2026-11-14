import { describe, it, expect } from 'vitest'
import {
  NO_DEDUCTIONS,
  baseAt,
  basesFor,
  grossWhereBaseIs,
  loanThresholdsFor,
  pensionAt,
  pensionSlopeChangesFor,
  studentLoansOn,
  type PayProfile,
  type PensionInput,
} from './deductions'
import { CURRENT_TAX_YEAR } from './taxYears'
import type { PensionArrangement } from '../state/types'

// The rules for what each deduction is charged on and how much it takes.
// Figures are 2026/27 and checked against the GOV.UK pages cited in
// taxYears.ts and deductions.ts. salary.test.ts checks them end to end.

const YEAR = CURRENT_TAX_YEAR

/** A pension given as a percentage of salary. */
const percentOf = (arrangement: PensionArrangement, percent: number): PensionInput => ({
  arrangement,
  mode: 'percent',
  percent,
  monthlyAmount: 0,
})

/** A pension given as a fixed amount from pay each month. */
const monthly = (arrangement: PensionArrangement, monthlyAmount: number): PensionInput => ({
  arrangement,
  mode: 'amount',
  percent: 0,
  monthlyAmount,
})

const withLoans = (studentPlan: PayProfile['studentPlan'], postgradLoan: boolean): PayProfile => ({
  studentPlan,
  postgradLoan,
  pension: null,
})

describe('NO_DEDUCTIONS', () => {
  it('has no loan and no pension', () => {
    expect(NO_DEDUCTIONS).toEqual({ studentPlan: 'none', postgradLoan: false, pension: null })
  })
})

describe('basesFor', () => {
  it('leaves both bases at the whole salary with no pension, or with relief at source', () => {
    for (const pension of [null, percentOf('ras', 5), monthly('ras', 100)]) {
      const { tax, ni } = basesFor(pension)
      expect(baseAt(tax, 35000)).toBe(35000)
      expect(baseAt(ni, 35000)).toBe(35000)
    }
  })

  it('lowers both bases under salary sacrifice, and only the tax base under net pay', () => {
    const sacrifice = basesFor(percentOf('sacrifice', 5))
    expect(baseAt(sacrifice.tax, 35000)).toBeCloseTo(33250, 6)
    expect(baseAt(sacrifice.ni, 35000)).toBeCloseTo(33250, 6)

    const netPay = basesFor(percentOf('netpay', 5))
    expect(baseAt(netPay.tax, 35000)).toBeCloseTo(33250, 6)
    expect(baseAt(netPay.ni, 35000)).toBe(35000)
  })

  it('takes a fixed amount off as a year of it, and never below nothing', () => {
    const { tax } = basesFor(monthly('netpay', 100))
    expect(baseAt(tax, 35000)).toBe(33800)
    expect(baseAt(tax, 1000)).toBe(0)
  })

  it('lowers a base to nothing for a percentage of 100 or more', () => {
    expect(baseAt(basesFor(percentOf('sacrifice', 120)).tax, 35000)).toBe(0)
  })
})

describe('grossWhereBaseIs', () => {
  it('undoes baseAt', () => {
    const lowered = basesFor(percentOf('sacrifice', 20)).tax
    expect(grossWhereBaseIs(40000, lowered)).toBeCloseTo(50000, 6)
    expect(baseAt(lowered, grossWhereBaseIs(40000, lowered))).toBeCloseTo(40000, 6)

    const fixed = basesFor(monthly('sacrifice', 100)).tax
    expect(grossWhereBaseIs(0, fixed)).toBe(1200)
  })

  it('is NaN for a base that never moves', () => {
    expect(grossWhereBaseIs(12570, basesFor(percentOf('sacrifice', 100)).tax)).toBeNaN()
  })
})

describe('pensionAt', () => {
  it('takes nothing without a pension', () => {
    expect(pensionAt(35000, null, YEAR)).toEqual({ intoPension: 0, fromPay: 0 })
  })

  it('costs take-home the whole contribution under salary sacrifice and net pay', () => {
    expect(pensionAt(35000, percentOf('sacrifice', 5), YEAR)).toEqual({ intoPension: 1750, fromPay: 1750 })
    expect(pensionAt(35000, percentOf('netpay', 5), YEAR)).toEqual({ intoPension: 1750, fromPay: 1750 })
  })

  it('costs 80p per £1 in the pot under relief at source, the provider adding 20%', () => {
    const { intoPension, fromPay } = pensionAt(35000, percentOf('ras', 5), YEAR)
    expect(intoPension).toBe(1750)
    expect(fromPay).toBeCloseTo(1400, 6)
  })

  it('reads a monthly amount as what leaves pay, so relief at source puts ÷ 0.8 in the pot', () => {
    // £100 a month off the payslip: £1,200 a year, which relief at source
    // grosses up to £1,500 in the pot.
    const ras = pensionAt(40000, monthly('ras', 100), YEAR)
    expect(ras.fromPay).toBeCloseTo(1200, 6)
    expect(ras.intoPension).toBeCloseTo(1500, 6)
    expect(pensionAt(40000, monthly('netpay', 100), YEAR)).toEqual({ intoPension: 1200, fromPay: 1200 })
    expect(pensionAt(40000, monthly('sacrifice', 100), YEAR)).toEqual({ intoPension: 1200, fromPay: 1200 })
  })

  it('puts no more in the pot than the salary itself', () => {
    expect(pensionAt(30000, monthly('netpay', 3000), YEAR).intoPension).toBe(30000)
    expect(pensionAt(30000, percentOf('sacrifice', 150), YEAR).intoPension).toBe(30000)
  })

  it('treats a negative percentage or amount as nothing', () => {
    expect(pensionAt(30000, percentOf('netpay', -5), YEAR)).toEqual({ intoPension: 0, fromPay: 0 })
    expect(pensionAt(30000, monthly('netpay', -100), YEAR)).toEqual({ intoPension: 0, fromPay: 0 })
  })
})

describe('pensionSlopeChangesFor', () => {
  it('adds where a fixed contribution stops growing, and nothing for a percentage', () => {
    expect(pensionSlopeChangesFor(null, YEAR)).toEqual([])
    expect(pensionSlopeChangesFor(percentOf('ras', 5), YEAR)).toEqual([])
    expect(pensionSlopeChangesFor(monthly('sacrifice', 100), YEAR)).toEqual([1200])
    expect(pensionSlopeChangesFor(monthly('ras', 100), YEAR)[0]).toBeCloseTo(1500, 6)
  })
})

describe('loanThresholdsFor', () => {
  it('lists the threshold of each loan being repaid', () => {
    expect(loanThresholdsFor(NO_DEDUCTIONS, YEAR)).toEqual([])
    expect(loanThresholdsFor(withLoans('plan4', true), YEAR)).toEqual([33795, 21000])
    expect(loanThresholdsFor(withLoans('none', true), YEAR)).toEqual([21000])
  })
})

describe('studentLoansOn', () => {
  it('repays 9% over each undergraduate plan threshold', () => {
    // £35,000: Plan 1 £729, Plan 2 £505.35, Plan 4 £108.45, Plan 5 £900.
    const expected = { plan1: 729, plan2: 505.35, plan4: 108.45, plan5: 900 } as const
    for (const [plan, repaid] of Object.entries(expected)) {
      expect(studentLoansOn(35000, withLoans(plan as keyof typeof expected, false), YEAR).studentLoan, `${plan} at £35,000`).toBeCloseTo(
        repaid,
        6,
      )
    }
  })

  it('repays nothing at or below the threshold', () => {
    expect(studentLoansOn(29385, withLoans('plan2', true), YEAR).studentLoan).toBe(0)
    expect(studentLoansOn(21000, withLoans('plan2', true), YEAR).postgraduateLoan).toBe(0)
  })

  it('takes the Postgraduate Loan at 6% over £21,000, on top of the plan', () => {
    // GOV.UK's own worked example: Plan 2 and a Postgraduate Loan on £2,500 a
    // month repay £49 a month — £45 + £4.61 here, which GOV.UK rounds down to
    // the whole pound each payday. The calculator doesn't round, so it can be
    // up to £1 a month higher per loan.
    const { studentLoan, postgraduateLoan } = studentLoansOn(30000, withLoans('plan2', true), YEAR)
    expect(postgraduateLoan).toBeCloseTo(540, 6)
    expect(studentLoan).toBeCloseTo(55.35, 6)
    const monthlyRepaid = (studentLoan + postgraduateLoan) / 12
    expect(monthlyRepaid - 49).toBeGreaterThanOrEqual(0)
    expect(monthlyRepaid - 49).toBeLessThan(1)
  })

  it('repays nothing with no loans', () => {
    expect(studentLoansOn(100000, NO_DEDUCTIONS, YEAR)).toEqual({ studentLoan: 0, postgraduateLoan: 0 })
  })
})
