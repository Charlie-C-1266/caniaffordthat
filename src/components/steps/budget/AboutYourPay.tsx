import { useId, useState } from 'react'
import { PensionFields } from './PensionFields'
import { StudentLoanFields } from './StudentLoanFields'
import { Icon } from '../../Icon'
import { useCalculator } from '../../../state/calculatorContext'
import type { PayProfileState } from '../../../lib/payProfile'

interface AboutYourPayProps {
  /** True in salary mode, where these change the take-home shown; otherwise they only feed "what salary would this take?". */
  salaryMode: boolean
  accentColor: string
  /** Applies a change to the pay profile. The Budget step re-works take-home from it in salary mode. */
  onChange: (patch: Partial<PayProfileState>) => void
}

/**
 * The optional "About your pay" section under the income field: student loan
 * and workplace pension. Collapsed until opened, so the step looks as it did
 * for anyone who ignores it, but open whenever something in it is set — from a
 * shared link, say — so nothing that changes the figures is ever hidden.
 */
export function AboutYourPay({ salaryMode, accentColor, onChange }: AboutYourPayProps) {
  const { state } = useCalculator()
  const bodyId = useId()
  const anythingSet = state.studentPlan !== 'none' || state.postgradLoan || state.pensionArrangement !== 'none'
  // `null` until the user opens or closes it themselves; until then it
  // follows whether anything is set.
  const [chosen, setChosen] = useState<boolean | null>(null)
  const open = chosen ?? anythingSet

  return (
    <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--divider)' }}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setChosen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: 0,
          border: 'none',
          background: 'transparent',
          color: 'var(--text-primary)',
          fontFamily: 'inherit',
          fontSize: 'var(--fs-body)',
          fontWeight: 700,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ display: 'inline-flex', transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s ease' }}>
          <Icon name="chevron-down" size={16} color="var(--text-tertiary)" />
        </span>
        <span>
          About your pay: student loan &amp; pension <span style={{ color: 'var(--text-tertiary-dim)', fontWeight: 600 }}>(optional)</span>
        </span>
      </button>
      <div id={bodyId} hidden={!open} style={{ marginTop: 14 }}>
        <p style={{ margin: '0 0 16px', fontSize: 'var(--fs-helper)', color: 'var(--text-tertiary)', fontWeight: 600, lineHeight: 1.45 }}>
          {salaryMode
            ? 'These come off your salary before it reaches you, so they change the take-home above.'
            : 'Your take-home already has these taken off. We use them to work out what salary a plan would take.'}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <StudentLoanFields onChange={onChange} />
          <PensionFields accentColor={accentColor} onChange={onChange} />
        </div>
      </div>
    </div>
  )
}
