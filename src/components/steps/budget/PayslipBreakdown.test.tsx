// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import { PayslipBreakdown } from './PayslipBreakdown'
import { NO_DEDUCTIONS, type PayProfile } from '../../../lib/deductions'
import { fmtPence } from '../../../lib/calculations'
import { takeHomeBreakdown } from '../../../lib/salary'
import { CURRENT_TAX_YEAR } from '../../../lib/taxYears'

// Salary mode's month-by-month payslip. Expected figures come from the same
// engine call the component makes, so a tax-table change moves both; the
// tests are about which lines show, how they read, and the caption.

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
