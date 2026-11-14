import { BreakdownBox } from '../../BreakdownBox'
import { BreakdownRow } from '../../BreakdownRow'
import { TotalRow } from '../../TotalRow'
import { TextLink } from '../../TextLink'
import { fmtPence } from '../../../lib/calculations'
import type { PayProfile } from '../../../lib/deductions'
import { describePayProfile } from '../../../lib/payProfile'
import { takeHomeBreakdown } from '../../../lib/salary'
import { CURRENT_TAX_YEAR } from '../../../lib/taxYears'

/** A minus sign joined to the figure after it (U+2060), so a narrow column can't wrap "−" away from "£149.53". */
const MINUS = '−\u2060'

interface PayslipBreakdownProps {
  grossAnnual: number
  profile: PayProfile
}

/**
 * Salary mode's read-out: one month's payslip, from salary to take-home, line
 * by line and to the penny, so it can be checked against a real payslip. Only
 * lines that take something are shown. A caption says exactly which loan and
 * pension were applied, and links to the full working.
 */
export function PayslipBreakdown({ grossAnnual, profile }: PayslipBreakdownProps) {
  const payslip = takeHomeBreakdown(grossAnnual, CURRENT_TAX_YEAR, profile)
  const deductions: readonly [label: string, annual: number][] = [
    ['INCOME TAX', payslip.incomeTax],
    ['NATIONAL INSURANCE', payslip.nationalInsurance],
    ['STUDENT LOAN', payslip.studentLoan],
    ['POSTGRADUATE LOAN', payslip.postgraduateLoan],
    ['PENSION', payslip.pension],
  ]
  const helper = { fontSize: 'var(--fs-helper)', fontWeight: 600, lineHeight: 1.45 } as const

  return (
    <div style={{ marginTop: 12 }}>
      <BreakdownBox heading="Each month">
        <BreakdownRow label="SALARY" value={fmtPence(payslip.gross / 12)} />
        {deductions
          .filter(([, annual]) => annual > 0)
          .map(([label, annual]) => (
            <BreakdownRow key={label} label={label} value={`${MINUS}${fmtPence(annual / 12)}`} />
          ))}
        <TotalRow label="TAKE-HOME" value={fmtPence(payslip.takeHome / 12)} />
      </BreakdownBox>
      {payslip.intoPension > 0 && (
        <div style={{ ...helper, color: 'var(--text-tertiary)', marginBottom: 6 }}>
          Going into your pension: {fmtPence(payslip.intoPension / 12)} a month, not counting your employer&rsquo;s contribution.
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
