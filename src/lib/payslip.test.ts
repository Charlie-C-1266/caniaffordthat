import { describe, it, expect } from 'vitest'
import { PAYSLIP_DEDUCTIONS, monthlyPayslipLines, type MonthlyPayslip } from './payslip'
import { monthlyTakeHomeFromGross, takeHomeBreakdown, type TakeHomeBreakdown } from './salary'
import { NO_DEDUCTIONS, type PayProfile, type PensionInput } from './deductions'
import { CURRENT_TAX_YEAR } from './taxYears'
import type { PensionArrangement, StudentLoanPlan } from '../state/types'

// The Budget step's payslip has to add up: salary less every line shown is
// the take-home shown, to the penny, and that take-home is the one the Budget
// step stores. These tests sweep the salary engine across salaries and pay
// profiles and check every payslip it makes, then pin the rounding rules
// down on hand-worked cases.

/** The Budget step's rounding of a monthly take-home (BudgetStep.tsx), which the payslip's take-home must match. */
const roundPence = (n: number): number => Math.round(n * 100) / 100

const PLANS: readonly StudentLoanPlan[] = ['plan1', 'plan2', 'plan4', 'plan5']
const ARRANGEMENTS: readonly PensionArrangement[] = ['sacrifice', 'netpay', 'ras']

const percentPension = (arrangement: PensionArrangement, percent: number): PensionInput => ({
  arrangement,
  mode: 'percent',
  percent,
  monthlyAmount: 0,
})
const monthlyPension = (arrangement: PensionArrangement, monthlyAmount: number): PensionInput => ({
  arrangement,
  mode: 'amount',
  percent: 0,
  monthlyAmount,
})

/** A pension of £20,000 a month: more than any salary swept here pays, so take-home bottoms out at £0. */
const BIGGER_THAN_SALARY = 20000

/** Every profile the sweep checks, by name. */
const PROFILES: readonly [name: string, profile: PayProfile][] = [
  ['no deductions', NO_DEDUCTIONS],
  ['Postgraduate Loan alone', { studentPlan: 'none', postgradLoan: true, pension: null }],
  ...PLANS.flatMap((plan): [string, PayProfile][] => [
    [plan, { studentPlan: plan, postgradLoan: false, pension: null }],
    [`${plan} + Postgraduate Loan`, { studentPlan: plan, postgradLoan: true, pension: null }],
  ]),
  ...ARRANGEMENTS.flatMap((arrangement): [string, PayProfile][] => [
    [`5% ${arrangement}`, { studentPlan: 'none', postgradLoan: false, pension: percentPension(arrangement, 5) }],
    [`£150 a month ${arrangement}`, { studentPlan: 'none', postgradLoan: false, pension: monthlyPension(arrangement, 150) }],
    [
      `plan2 + Postgraduate Loan + 8% ${arrangement}`,
      { studentPlan: 'plan2', postgradLoan: true, pension: percentPension(arrangement, 8) },
    ],
    [
      `plan2 + Postgraduate Loan + £400 a month ${arrangement}`,
      { studentPlan: 'plan2', postgradLoan: true, pension: monthlyPension(arrangement, 400) },
    ],
  ]),
]

/**
 * Profiles whose pension asks for more than the salary, so the pension takes
 * all of it. Salary sacrifice then leaves nothing for tax, NI or the loans to
 * fall on, and the payslip is the salary and the pension alone. Under net pay
 * and relief at source they still fall on the full salary, and take-home is
 * floored at £0 wherever the lines together take more than the salary:
 * everywhere under net pay, and under relief at source once tax, NI and the
 * loans take more than the 20% of salary it leaves.
 */
const FLOORED_PROFILES: readonly [name: string, profile: PayProfile][] = ARRANGEMENTS.map((arrangement) => [
  `£${BIGGER_THAN_SALARY} a month ${arrangement}, plan5 + Postgraduate Loan`,
  { studentPlan: 'plan5', postgradLoan: true, pension: monthlyPension(arrangement, BIGGER_THAN_SALARY) },
])

/**
 * Salaries where a line starts, stops or changes rate: tax and NI starting at
 * £12,570, the higher rate at £50,270, the taper from £100,000 to £125,140,
 * and every loan threshold.
 */
const EDGES = [
  12570,
  50270,
  100000,
  125140,
  ...PLANS.map((plan) => CURRENT_TAX_YEAR.studentLoanPlans[plan].threshold),
  CURRENT_TAX_YEAR.postgraduateLoan.threshold,
]

/** £0 to £200,000 in £97 steps (so the steps land on every pence pattern), plus a penny and a pound either side of every edge. */
const SALARIES = [
  ...Array.from({ length: Math.floor(200000 / 97) + 1 }, (_, i) => i * 97),
  200000,
  ...EDGES.flatMap((edge) => [edge - 1, edge - 0.01, edge, edge + 0.01, edge + 1]),
]

/** An annual line as one month's pence, unrounded. */
const exactPence = (annual: number): number => (annual / 12) * 100

/** True when a breakdown's lines take more than its salary, so its take-home is floored at £0. */
const isFloored = (breakdown: TakeHomeBreakdown): boolean =>
  PAYSLIP_DEDUCTIONS.reduce((sum, key) => sum + breakdown[key], 0) > breakdown.gross

/** Everything wrong with one payslip; empty when it is right. */
function problemsWith(gross: number, profile: PayProfile): string[] {
  const breakdown = takeHomeBreakdown(gross, CURRENT_TAX_YEAR, profile)
  const payslip = monthlyPayslipLines(breakdown)
  const floored = isFloored(breakdown)
  const problems: string[] = []
  const deducted = PAYSLIP_DEDUCTIONS.reduce((sum, key) => sum + payslip[key], 0)
  if (payslip.gross - deducted !== payslip.takeHome)
    problems.push(`lines come to ${payslip.gross - deducted}p, take-home is ${payslip.takeHome}p`)
  if (payslip.gross !== Math.round(exactPence(gross))) problems.push(`salary ${payslip.gross}p`)
  if (payslip.takeHome / 100 !== roundPence(monthlyTakeHomeFromGross(gross, CURRENT_TAX_YEAR, profile))) {
    problems.push(`take-home ${payslip.takeHome}p isn't what the Budget step stores`)
  }
  for (const key of PAYSLIP_DEDUCTIONS) {
    const line = payslip[key]
    const own = Math.round(exactPence(breakdown[key]))
    if (!Number.isInteger(line) || line < 0) problems.push(`${key} is ${line}p`)
    // The one line allowed to move further: the pension, cut to what the
    // payslip has left when it asks for more than that.
    if (floored && key === 'pension') {
      if (line > own) problems.push(`pension ${line}p is more than its own ${own}p`)
    } else {
      if (Math.abs(line - own) > 1) problems.push(`${key} moved ${line - own}p from ${own}p`)
      if (Math.abs(line - exactPence(breakdown[key])) > 1) problems.push(`${key} ${line}p is more than a penny from exact`)
    }
    if (breakdown[key] === 0 && line !== 0) problems.push(`${key} shows ${line}p for a line the engine leaves at £0`)
  }
  return problems.map((problem) => `£${gross}: ${problem}`)
}

describe('monthlyPayslipLines', () => {
  it.each(PROFILES)('adds up to the stored take-home at every salary, each line within a penny, with %s', (_, profile) => {
    expect(SALARIES.filter((gross) => isFloored(takeHomeBreakdown(gross, CURRENT_TAX_YEAR, profile)))).toEqual([])
    expect(SALARIES.flatMap((gross) => problemsWith(gross, profile))).toEqual([])
  })

  it.each(FLOORED_PROFILES)('adds up to a take-home of £0 under a pension bigger than the salary: %s', (_, profile) => {
    // Every salary from £60,000 takes home nothing under all three
    // arrangements, so the sweep below reaches take-home's floor.
    for (const gross of [60000, 110000, 200000]) {
      expect(takeHomeBreakdown(gross, CURRENT_TAX_YEAR, profile).takeHome, `£${gross}`).toBe(0)
    }
    expect(SALARIES.flatMap((gross) => problemsWith(gross, profile))).toEqual([])
  })

  it('needed the joint rounding: rounding each line on its own drifts for many salaries', () => {
    // Guards the sweep above against passing because nothing ever needed
    // adjusting. With no deductions, a third of salaries in the sweep drift.
    const drifting = SALARIES.filter((gross) => {
      const breakdown = takeHomeBreakdown(gross)
      const own = PAYSLIP_DEDUCTIONS.reduce((sum, key) => sum + Math.round(exactPence(breakdown[key])), 0)
      return Math.round(exactPence(breakdown.gross)) - own !== Math.round(exactPence(breakdown.takeHome))
    })
    expect(drifting.length).toBeGreaterThan(SALARIES.length / 4)
  })

  it('shows only salary and take-home, the same figure, when nothing is taken', () => {
    const expected: MonthlyPayslip = {
      gross: 83333,
      incomeTax: 0,
      nationalInsurance: 0,
      studentLoan: 0,
      postgraduateLoan: 0,
      pension: 0,
      takeHome: 83333,
    }
    expect(monthlyPayslipLines(takeHomeBreakdown(10000))).toEqual(expected)
    expect(monthlyPayslipLines(takeHomeBreakdown(0))).toEqual({ ...expected, gross: 0, takeHome: 0 })
  })

  it('puts the whole adjustment on a lone deduction', () => {
    // £10,000 with 5% net pay: no tax or NI, just £500 a year of pension.
    // £833.33 less £41.67 would be £791.66, but take-home is £791.67, so the
    // pension line shows £41.66, still within a penny of its exact £41.666….
    const payslip = monthlyPayslipLines(
      takeHomeBreakdown(10000, CURRENT_TAX_YEAR, { studentPlan: 'none', postgradLoan: false, pension: percentPension('netpay', 5) }),
    )
    expect(payslip).toEqual({
      gross: 83333,
      incomeTax: 0,
      nationalInsurance: 0,
      studentLoan: 0,
      postgraduateLoan: 0,
      pension: 4166,
      takeHome: 79167,
    })
  })

  it('gives the penny to the line rounding moved furthest, not the biggest', () => {
    // Exact pence: tax 100.1 and NI 10.45 both round down, but the lines
    // need one more penny to reach take-home. NI was rounded down further.
    const breakdown = syntheticBreakdown({ gross: 120, incomeTax: 12.012, nationalInsurance: 1.254 })
    expect(monthlyPayslipLines(breakdown)).toMatchObject({ gross: 1000, incomeTax: 100, nationalInsurance: 11, takeHome: 889 })
  })

  it('settles a tie on how far rounding moved two lines in favour of the bigger deduction', () => {
    // £13,000 with no deductions, the issue's example: tax £7.166… and NI
    // £2.866… both round up by a third of a penny, and the lines must give
    // one penny back. Tax is the bigger, so it shows £7.16, not £7.17.
    expect(monthlyPayslipLines(takeHomeBreakdown(13000))).toMatchObject({
      gross: 108333,
      incomeTax: 716,
      nationalInsurance: 287,
      takeHome: 107330,
    })
  })

  it('settles deductions tied for largest by their order on the payslip', () => {
    // Tax and NI identical at 10.833…p each, both rounded up to 11p; the
    // lines must give one penny back, and income tax, listed first, gives it.
    const breakdown = syntheticBreakdown({ gross: 100, incomeTax: 1.3, nationalInsurance: 1.3 })
    expect(monthlyPayslipLines(breakdown)).toMatchObject({ gross: 833, incomeTax: 10, nationalInsurance: 11, takeHome: 812 })
  })

  it('cuts a pension bigger than the payslip down to what is left after tax, NI and the loans', () => {
    // £30,000 with £3,000 a month under net pay, Plan 5 and a Postgraduate
    // Loan: no tax, but NI (£116.20), Plan 5 (£37.50) and the Postgraduate
    // Loan (£45.00) still fall on the full £2,500.00, leaving £2,301.30.
    const profile: PayProfile = { studentPlan: 'plan5', postgradLoan: true, pension: monthlyPension('netpay', 3000) }
    expect(monthlyPayslipLines(takeHomeBreakdown(30000, CURRENT_TAX_YEAR, profile))).toEqual({
      gross: 250000,
      incomeTax: 0,
      nationalInsurance: 11620,
      studentLoan: 3750,
      postgraduateLoan: 4500,
      pension: 230130,
      takeHome: 0,
    })
  })
})

/** A breakdown with the given annual lines, no others, and the take-home they leave. */
function syntheticBreakdown(lines: Pick<TakeHomeBreakdown, 'gross' | 'incomeTax' | 'nationalInsurance'>): TakeHomeBreakdown {
  return {
    ...lines,
    studentLoan: 0,
    postgraduateLoan: 0,
    pension: 0,
    intoPension: 0,
    takeHome: lines.gross - lines.incomeTax - lines.nationalInsurance,
  }
}
