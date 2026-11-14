// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import { PayslipBreakdown } from './PayslipBreakdown'
import { NO_DEDUCTIONS, type PayProfile } from '../../../lib/deductions'
import { fmtPence } from '../../../lib/calculations'
import { monthlyTakeHomeFromGross, takeHomeBreakdown } from '../../../lib/salary'
import { CURRENT_TAX_YEAR } from '../../../lib/taxYears'

// Salary mode's month-by-month payslip. Expected figures come from the same
// engine call the component makes, so a tax-table change moves both; the
// tests are about which lines show, how they read, that they add up, and the
// caption. payslip.test.ts covers the rounding that makes them add up.

const PLAN_2_NET_PAY: PayProfile = {
  studentPlan: 'plan2',
  postgradLoan: false,
  pension: { arrangement: 'netpay', mode: 'percent', percent: 5, monthlyAmount: 0 },
}

/** A deduction's minus sign, joined to its figure so it can't wrap away from it. */
const MINUS = '−\u2060'

/** The value shown beside a row label. */
function rowValue(label: string): string | null {
  return screen.getByText(label).nextElementSibling?.textContent ?? null
}

const DEDUCTION_LABELS = ['INCOME TAX', 'NATIONAL INSURANCE', 'STUDENT LOAN', 'POSTGRADUATE LOAN', 'PENSION'] as const

/** A row's figure as whole pence, read back from what's on screen, as someone checking it would: "£1,073.30" is 107330. */
function shownPence(label: string): number {
  const digits = (rowValue(label) ?? '').replace(/[^\d.]/g, '')
  return Math.round(Number(digits) * 100)
}

/** Salary less every deduction line on screen, in pence, against the take-home on screen. */
function shownSums(): { linesComeTo: number; takeHome: number } {
  const deducted = DEDUCTION_LABELS.filter((label) => screen.queryByText(label) !== null).reduce((sum, label) => sum + shownPence(label), 0)
  return { linesComeTo: shownPence('SALARY') - deducted, takeHome: shownPence('TAKE-HOME') }
}

/** Expects the lines on screen to add up to the take-home on screen, to the penny. */
function expectLinesToAddUp() {
  const { linesComeTo, takeHome } = shownSums()
  expect(linesComeTo).toBe(takeHome)
}

describe('PayslipBreakdown', () => {
  afterEach(cleanup)

  it('shows salary, tax, NI and take-home a month, to the penny, with no deductions', () => {
    render(<PayslipBreakdown grossAnnual={45000} profile={NO_DEDUCTIONS} />)
    const payslip = takeHomeBreakdown(45000)
    expect(rowValue('SALARY')).toBe(fmtPence(3750))
    expect(rowValue('INCOME TAX')).toBe(`${MINUS}${fmtPence(payslip.incomeTax / 12)}`)
    expect(rowValue('NATIONAL INSURANCE')).toBe(`${MINUS}${fmtPence(payslip.nationalInsurance / 12)}`)
    expect(rowValue('TAKE-HOME')).toBe(fmtPence(payslip.takeHome / 12))
    expect(screen.queryByText('STUDENT LOAN')).toBeNull()
    expect(screen.queryByText('PENSION')).toBeNull()
    expect(screen.queryByText(/Going into your pension/)).toBeNull()
  })

  it('adds a line for each deduction in the profile, and what goes into the pension', () => {
    render(<PayslipBreakdown grossAnnual={35000} profile={PLAN_2_NET_PAY} />)
    // £35,000, Plan 2, 5% net pay: £42.11 of loan and £145.83 of pension a
    // month, leaving £2,234.52.
    expect(rowValue('STUDENT LOAN')).toBe(`${MINUS}£42.11`)
    expect(rowValue('PENSION')).toBe(`${MINUS}£145.83`)
    expect(rowValue('TAKE-HOME')).toBe('£2,234.52')
    expect(screen.getByText(/Going into your pension/).textContent).toContain('£145.83 a month, not counting your employer’s contribution')
    expectLinesToAddUp()
  })

  it('shows lines that add up to the take-home, where rounding each on its own would not', () => {
    // £13,000: tax £7.166… and NI £2.866… would each round up, and
    // £1,083.33 − £7.17 − £2.87 is £1,073.29, a penny short of the
    // £1,073.30 take-home. Tax, the bigger, gives the penny back.
    render(<PayslipBreakdown grossAnnual={13000} profile={NO_DEDUCTIONS} />)
    expect(rowValue('SALARY')).toBe('£1,083.33')
    expect(rowValue('INCOME TAX')).toBe(`${MINUS}£7.16`)
    expect(rowValue('NATIONAL INSURANCE')).toBe(`${MINUS}£2.87`)
    expect(rowValue('TAKE-HOME')).toBe('£1,073.30')
    expectLinesToAddUp()
  })

  it('adds up across salaries and profiles, with take-home the figure the Budget step stores', () => {
    const profiles: PayProfile[] = [NO_DEDUCTIONS, PLAN_2_NET_PAY, { studentPlan: 'plan1', postgradLoan: true, pension: null }]
    for (const profile of profiles) {
      for (const gross of [12571, 13000, 27500, 50270, 64321, 100001, 125140, 180000]) {
        render(<PayslipBreakdown grossAnnual={gross} profile={profile} />)
        const { linesComeTo, takeHome } = shownSums()
        expect(linesComeTo, `£${gross}`).toBe(takeHome)
        expect(takeHome / 100, `£${gross}`).toBe(Math.round(monthlyTakeHomeFromGross(gross, CURRENT_TAX_YEAR, profile) * 100) / 100)
        cleanup()
      }
    }
  })

  it('shows a pension bigger than the payslip as what the payslip had left for it', () => {
    // £30,000 with £3,000 a month under net pay, Plan 5 and a Postgraduate
    // Loan: NI and both loans still come off the full £2,500.00, so £2,301.30
    // is left for the pension and take-home is £0.00. What the pension asked
    // for still shows underneath.
    const profile: PayProfile = {
      studentPlan: 'plan5',
      postgradLoan: true,
      pension: { arrangement: 'netpay', mode: 'amount', percent: 0, monthlyAmount: 3000 },
    }
    render(<PayslipBreakdown grossAnnual={30000} profile={profile} />)
    expect(rowValue('PENSION')).toBe(`${MINUS}£2,301.30`)
    expect(rowValue('TAKE-HOME')).toBe('£0.00')
    expect(screen.getByText(/Going into your pension/).textContent).toContain('£2,500.00 a month')
    expectLinesToAddUp()
  })

  it('leaves out lines that take nothing', () => {
    render(<PayslipBreakdown grossAnnual={10000} profile={NO_DEDUCTIONS} />)
    expect(screen.queryByText('INCOME TAX')).toBeNull()
    expect(screen.queryByText('NATIONAL INSURANCE')).toBeNull()
    expect(rowValue('TAKE-HOME')).toBe(fmtPence(10000 / 12))
  })

  it('says exactly what was applied, for which tax year, and links to the working', () => {
    render(<PayslipBreakdown grossAnnual={35000} profile={PLAN_2_NET_PAY} />)
    expect(screen.getByText(/Plan 2 student loan, 5% net pay pension/).textContent).toContain(CURRENT_TAX_YEAR.label)
    expect(screen.getByRole('link', { name: /How this is worked out/ }).getAttribute('href')).toBe('/methodology/salary/')

    cleanup()
    render(<PayslipBreakdown grossAnnual={35000} profile={NO_DEDUCTIONS} />)
    expect(screen.getByText(/single PAYE salary, no student loan or pension\./)).toBeTruthy()
  })
})
