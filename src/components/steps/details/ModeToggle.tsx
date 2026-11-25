import { useId } from 'react'
import { SegmentedControl, type SegmentedOption } from '../../SegmentedControl'
import { accentColorFor } from '../../../lib/mode'
import type { Mode } from '../../../state/types'

/** Each pay mode's segment carries its own accent so the pill lights up green for saving and violet for finance. */
const MODE_OPTIONS: readonly SegmentedOption<Mode>[] = [
  { value: 'save', label: 'Save up for it', activeBackground: accentColorFor('save'), activeColor: 'var(--on-accent-save)' },
  { value: 'monthly', label: 'Pay monthly', activeBackground: accentColorFor('monthly'), activeColor: 'var(--on-accent-finance)' },
]

interface ModeToggleProps {
  mode: Mode
  onChange: (mode: Mode) => void
}

/** The "How do you plan to pay?" segmented control shown for every goal except the emergency fund. */
export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  // The question is already on screen, so the group is named from that text
  // rather than a duplicated string that could drift from it (#282).
  const questionId = useId()
  return (
    <div style={{ marginBottom: 30 }}>
      <div id={questionId} style={{ fontSize: 'var(--fs-helper)', fontWeight: 600, color: 'var(--text-secondary-dim)', marginBottom: 10 }}>
        How do you plan to pay?
      </div>
      <SegmentedControl options={MODE_OPTIONS} value={mode} onChange={onChange} ariaLabelledBy={questionId} />
    </div>
  )
}
