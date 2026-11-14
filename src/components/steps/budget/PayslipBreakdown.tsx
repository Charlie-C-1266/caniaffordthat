import { BreakdownBox } from '../../BreakdownBox'
import { BreakdownRow } from '../../BreakdownRow'
import { TotalRow } from '../../TotalRow'
import { TextLink } from '../../TextLink'
import { fmtPence } from '../../../lib/calculations'
import type { PayProfile } from '../../../lib/deductions'
import { describePayProfile } from '../../../lib/payProfile'
import { PAYSLIP_DEDUCTIONS, monthlyPayslipLines, type PayslipDeduction } from '../../../lib/payslip'
import { takeHomeBreakdown } from '../../../lib/salary'
import { CURRENT_TAX_YEAR } from '../../../lib/taxYears'

/** A minus sign joined to the figure after it (U+2060), so a narrow column can't wrap "−" away from "£149.54". */
const MINUS = '−\u2060'

/** Each deduction line's label on the payslip. */
const DEDUCTION_LABELS: Record<PayslipDeduction, string> = {
  incomeTax: 'INCOME TAX',
  nationalInsurance: 'NATIONAL INSURANCE',
  studentLoan: 'STUDENT LOAN',
  postgraduateLoan: 'POSTGRADUATE LOAN',
  pension: 'PENSION',
}

/** Whole pence, shown to the penny. */
const fromPence = (pence: number): string => fmtPence(pence / 100)

interface PayslipBreakdownProps {
  grossAnnual: number
  profile: PayProfile
}

/**
 * Salary mode's read-out: one month's payslip, from salary to take-home, line
 * by line and to the penny, so it can be checked against a real payslip. The
 * lines are rounded together so they add up (see payslip.ts), and take-home
 * is the same figure the Budget step stores. Only lines that take something
 * are shown. A caption says exactly which loan and pension were applied, and
 * links to the full working.
 */
export function PayslipBreakdown({ grossAnnual, profile }: PayslipBreakdownProps) {
  const breakdown = takeHomeBreakdown(grossAnnual, CURRENT_TAX_YEAR, profile)
  const payslip = monthlyPayslipLines(breakdown)
  const helper = { fontSize: 'var(--fs-helper)', fontWeight: 600, lineHeight: 1.45 } as const

  return (
    <div style={{ marginTop: 12 }}>
      <BreakdownBox heading="Each month">
        <BreakdownRow label="SALARY" value={fromPence(payslip.gross)} />
        {PAYSLIP_DEDUCTIONS.filter((key) => payslip[key] > 0).map((key) => (
          <BreakdownRow key={key} label={DEDUCTION_LABELS[key]} value={`${MINUS}${fromPence(payslip[key])}`} />
        ))}
        <TotalRow label="TAKE-HOME" value={fromPence(payslip.takeHome)} />
      </BreakdownBox>
      {breakdown.intoPension > 0 && (
        <div style={{ ...helper, color: 'var(--text-tertiary)', marginBottom: 6 }}>
          Going into your pension: {fmtPence(breakdown.intoPension / 12)} a month, not counting your employer&rsquo;s contribution.
        </div>
      )}
      <div style={{ ...helper, color: 'var(--text-tertiary-dim)' }}>
        England, Wales &amp; NI, {CURRENT_TAX_YEAR.label} — single PAYE salary, {describePayProfile(profile)}.{' '}
        <TextLink href="/methodology/salary/" newTab>
          How this is worked out →
        </TextLink>
      </div>
    </div>
  )
}
