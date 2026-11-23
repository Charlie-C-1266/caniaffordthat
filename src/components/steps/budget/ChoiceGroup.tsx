import { useId } from 'react'
import { InfoHint } from '../../InfoHint'
import { SegmentedControl, type SegmentedOption } from '../../SegmentedControl'

interface ChoiceGroupProps<T extends string> {
  label: string
  /** Explanatory text for a "?" beside the label. */
  hint?: string
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  /** Lets the control take a second row when its options won't fit — for the five-option plan row (#313). */
  wrap?: boolean
}

/**
 * A labelled choice in "About your pay": the label, an optional "?" hint
 * beside it, and a segmented control. The buttons sit in a group named by
 * the label, so a screen reader announces "Student loan plan, group" before
 * a bare "None".
 */
export function ChoiceGroup<T extends string>({ label, hint, options, value, onChange, wrap }: ChoiceGroupProps<T>) {
  const labelId = useId()
  return (
    <div role="group" aria-labelledby={labelId}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 8,
          fontSize: 'var(--fs-helper)',
          fontWeight: 700,
          color: 'var(--text-secondary)',
        }}
      >
        <span id={labelId}>{label}</span>
        {hint && <InfoHint text={hint} size={14} />}
      </div>
      <SegmentedControl size="sm" wrap={wrap} options={options} value={value} onChange={onChange} />
    </div>
  )
}
