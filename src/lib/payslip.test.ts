import { describe, it, expect } from 'vitest'
import {
  PAYSLIP_DEDUCTIONS,
  monthlyPayslipLines,
  payslipIntoPension,
  pensionWasCapped,
  pensionWasCutShort,
  type MonthlyPayslip,
} from './payslip'
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

// #315: the two lines of text under the payslip still worked from the
// engine's unrounded, uncapped annual figures. "Going into your pension" was
// a penny off the PENSION line for about 17% of salaries, and overstated the
// pension outright whenever the payslip cut it short — on the one panel whose
// job is to be checked against a real payslip.
/** The pension pot and the PENSION line, in pence, for a salary under a profile. */
function potAndLine(gross: number, profile: PayProfile): { pot: number; line: number } {
  const breakdown = takeHomeBreakdown(gross, CURRENT_TAX_YEAR, profile)
  const payslip = monthlyPayslipLines(breakdown)
  return { pot: payslipIntoPension(breakdown, payslip), line: payslip.pension }
}

/** Whether the payslip had less left than the pension asked for, at a salary under a profile. */
const cutShort = (gross: number, profile: PayProfile) => pensionWasCutShort(takeHomeBreakdown(gross, CURRENT_TAX_YEAR, profile))

/** Whether less of an amount-mode pension reached the payslip than was typed, at a salary under a profile. */
const capped = (gross: number, profile: PayProfile) =>
  pensionWasCapped(takeHomeBreakdown(gross, CURRENT_TAX_YEAR, profile), profile.pension)

/** £35,000 in salary mode with a net pay pension of `pence` a month, for walking up to the amount that empties the payslip. */
const netPayProfileAt = (pence: number): PayProfile => ({
  studentPlan: 'none',
  postgradLoan: false,
  pension: monthlyPension('netpay', pence / 100),
})

describe('payslipIntoPension', () => {
  it('equals the PENSION line exactly for salary sacrifice and net pay, across the range', () => {
    // The sweep from the issue: £5,000-£150,000 in £37 steps x {3, 5, 8, 10}%
    // x {sacrifice, net pay}, with and without each loan. Working the note
    // out from `intoPension / 12` instead disagreed on 5,379 of these.
    const loans: Partial<PayProfile>[] = [
      { studentPlan: 'none', postgradLoan: false },
      { studentPlan: 'none', postgradLoan: true },
      ...PLANS.flatMap((studentPlan): Partial<PayProfile>[] => [
        { studentPlan, postgradLoan: false },
        { studentPlan, postgradLoan: true },
      ]),
    ]

    for (const arrangement of ['sacrifice', 'netpay'] as const) {
      for (const percent of [3, 5, 8, 10]) {
        for (const loan of loans) {
          for (let gross = 5000; gross <= 150_000; gross += 37) {
            const profile = { ...loan, pension: percentPension(arrangement, percent) } as PayProfile
            const { pot, line } = potAndLine(gross, profile)
            expect(pot, `£${gross}, ${percent}% ${arrangement}, ${String(loan.studentPlan)}`).toBe(line)
          }
        }
      }
    }
  })

  it('agrees on the cases the old note got wrong', () => {
    // The three the issue names, with the figure the PENSION line shows.
    for (const gross of [25_000, 26_000, 32_000]) {
      const profile: PayProfile = { studentPlan: 'none', postgradLoan: false, pension: percentPension('netpay', 5) }
      const { pot, line } = potAndLine(gross, profile)
      expect(pot, `£${gross}`).toBe(line)
      // And it really is the penny the old note missed.
      const breakdown = takeHomeBreakdown(gross, CURRENT_TAX_YEAR, profile)
      expect(Math.abs(Math.round((breakdown.intoPension / 12) * 100) - line)).toBe(1)
    }
  })

  it('reports the cut-short figure, not the one the pension asked for', () => {
    // £35,000 with Plan 2, a Postgraduate Loan and £2,800 a month under net
    // pay: the payslip has £2,655.02 left for it, and take-home is £0.00.
    const profile: PayProfile = { studentPlan: 'plan2', postgradLoan: true, pension: monthlyPension('netpay', 2800) }
    const { pot, line } = potAndLine(35_000, profile)
    expect(line).toBe(265_502)
    expect(pot).toBe(line)
    // The engine's own figure, which the note used to print.
    expect(takeHomeBreakdown(35_000, CURRENT_TAX_YEAR, profile).intoPension / 12).toBe(2800)
  })

  it('is £0 with no pension at all', () => {
    const { pot, line } = potAndLine(35_000, NO_DEDUCTIONS)
    expect(pot).toBe(0)
    expect(line).toBe(0)
  })

  it('scales the pot above the pay line under relief at source', () => {
    // Not offered in the UI yet, but the engine models it: each £1 in the pot
    // costs 80p of pay, so the pot must not simply be the PENSION line.
    const profile: PayProfile = { studentPlan: 'none', postgradLoan: false, pension: monthlyPension('ras', 150) }
    const { pot, line } = potAndLine(35_000, profile)
    expect(line).toBe(15_000)
    expect(pot).toBe(18_750)
  })

  it('scales a capped relief-at-source pot from what the payslip took, not the uncapped figure', () => {
    const profile: PayProfile = { studentPlan: 'none', postgradLoan: false, pension: monthlyPension('ras', 3000) }
    const breakdown = takeHomeBreakdown(35_000, CURRENT_TAX_YEAR, profile)
    const payslip = monthlyPayslipLines(breakdown)
    const pot = payslipIntoPension(breakdown, payslip)

    // The uncapped pot would be the salary itself, £2,916.67 a month.
    expect(Math.round((breakdown.intoPension / 12) * 100)).toBe(291_667)
    // Scaled from what the payslip actually took, it is less than that.
    expect(payslip.pension).toBeLessThan(291_667)
    expect(pot).toBe(Math.round(payslip.pension / (1 - CURRENT_TAX_YEAR.reliefAtSourceRate)))
    // Still more than the pay line, which is the point of the arrangement.
    expect(pot).toBeGreaterThan(payslip.pension)
  })

  it('is £0 for a pension that rounds away to nothing', () => {
    // A penny a year: real to the engine, £0.00 on a monthly payslip.
    const profile: PayProfile = { studentPlan: 'none', postgradLoan: false, pension: monthlyPension('netpay', 0.0001) }
    const { pot, line } = potAndLine(35_000, profile)
    expect(line).toBe(0)
    expect(pot).toBe(0)
  })

  it('is £0 on a salary of £0', () => {
    const { pot, line } = potAndLine(0, { studentPlan: 'none', postgradLoan: false, pension: monthlyPension('netpay', 150) })
    expect(pot).toBe(0)
    expect(line).toBe(0)
  })
})

/** A net pay pension of `pounds` a month with no student loans. */
const noLoans = (pounds: number): PayProfile => ({ studentPlan: 'none', postgradLoan: false, pension: monthlyPension('netpay', pounds) })

describe('pensionWasCutShort', () => {
  it('is true when the payslip had less left than the pension asked for', () => {
    expect(cutShort(35_000, { studentPlan: 'plan2', postgradLoan: true, pension: monthlyPension('netpay', 2800) })).toBe(true)
  })

  it('is false for a pension the payslip can afford', () => {
    expect(cutShort(35_000, { studentPlan: 'none', postgradLoan: false, pension: monthlyPension('netpay', 150) })).toBe(false)
    expect(cutShort(35_000, { studentPlan: 'none', postgradLoan: false, pension: percentPension('netpay', 50) })).toBe(false)
    expect(cutShort(35_000, NO_DEDUCTIONS)).toBe(false)
  })

  it('counts the student loans in what the payslip had left', () => {
    // The largest whole-pound net pay pension £35,000 covers with no loans,
    // walked up to rather than hard-coded so a tax-table change moves it.
    let fits = 1
    while (!cutShort(35_000, noLoans(fits + 1))) fits += 1
    expect(cutShort(35_000, noLoans(fits))).toBe(false)

    // The same pension on top of Plan 2 and a Postgraduate Loan no longer fits:
    // the loans take their share first, so the payslip has less left for it.
    expect(cutShort(35_000, { ...noLoans(fits), studentPlan: 'plan2', postgradLoan: true })).toBe(true)
  })

  it('is never true of tax, NI and the loans alone, at any salary', () => {
    for (const [name, profile] of PROFILES.filter(([, p]) => p.pension === null)) {
      for (let gross = 5000; gross <= 150_000; gross += 971) {
        expect(cutShort(gross, profile), `£${gross}, ${name}`).toBe(false)
      }
    }
  })
})

describe('pensionWasCapped', () => {
  it('is false with no pension, and for a percentage at its 50% maximum', () => {
    expect(capped(35_000, NO_DEDUCTIONS)).toBe(false)
    for (const arrangement of ARRANGEMENTS) {
      expect(capped(35_000, { studentPlan: 'none', postgradLoan: false, pension: percentPension(arrangement, 50) })).toBe(false)
    }
  })

  it('is false for an amount the payslip pays in full, to the penny', () => {
    for (const amount of [150, 150.5, 0.4, 1234.56]) {
      expect(capped(35_000, { studentPlan: 'none', postgradLoan: false, pension: monthlyPension('netpay', amount) }), `£${amount}`).toBe(
        false,
      )
    }
  })

  it('is true when the pot was capped at the salary itself', () => {
    // £5,000 a month against a £35,000 salary: £2,916.67 is applied.
    expect(capped(35_000, { studentPlan: 'none', postgradLoan: false, pension: monthlyPension('sacrifice', 5000) })).toBe(true)
  })

  it('is true when the payslip cut the pension short', () => {
    expect(capped(35_000, { studentPlan: 'plan2', postgradLoan: true, pension: monthlyPension('netpay', 2800) })).toBe(true)
  })

  it('flips on the exact penny the payslip runs out of room', () => {
    // The boundary is found by bisection rather than hard-coded: it is not
    // the no-pension take-home, because a net pay pension lowers the tax on
    // the pay it comes out of.
    const profileAt = netPayProfileAt

    let affordable = 1
    let tooMuch = 1_000_000
    expect(capped(35_000, profileAt(affordable))).toBe(false)
    expect(capped(35_000, profileAt(tooMuch))).toBe(true)

    while (tooMuch - affordable > 1) {
      const mid = Math.floor((affordable + tooMuch) / 2)
      if (capped(35_000, profileAt(mid))) tooMuch = mid
      else affordable = mid
    }

    expect(tooMuch - affordable).toBe(1)
    // Exactly what's left: paid in full, so no cap. One penny more: capped.
    expect(capped(35_000, profileAt(affordable))).toBe(false)
    expect(capped(35_000, profileAt(tooMuch))).toBe(true)
    // And the payslip really does have nothing left at the boundary.
    const payslip = monthlyPayslipLines(takeHomeBreakdown(35_000, CURRENT_TAX_YEAR, profileAt(affordable)))
    expect(payslip.takeHome).toBe(0)
  })

  it('is true on a salary of £0, where nothing of the amount can be taken', () => {
    expect(capped(0, { studentPlan: 'none', postgradLoan: false, pension: monthlyPension('netpay', 150) })).toBe(true)
  })

  it('is false for an uncapped relief-at-source amount, whose pot is the typed figure over 0.8', () => {
    // The float round-trip (x / 0.8 * 0.8) need not land back on x, which is
    // why the comparison is made in whole pence.
    for (const amount of [150, 150.5, 99.99, 1234.56]) {
      expect(capped(35_000, { studentPlan: 'none', postgradLoan: false, pension: monthlyPension('ras', amount) }), `£${amount}`).toBe(false)
    }
  })
})
