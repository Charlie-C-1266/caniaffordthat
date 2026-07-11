import { useState, type KeyboardEvent, type ReactNode } from 'react'
import { FieldLabel } from './FieldLabel'

interface LabeledUnitFieldProps {
  label: ReactNode
  /** Unit rendered after the value, e.g. "miles", "mpg", "p/litre". */
  unit: string
  value: string
  onChange: (value: string) => void
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void
  /** Underline color while focused. Defaults to the neutral primary-text color, matching LabeledMoneyField. */
  accentColor?: string
}

/**
 * The non-money counterpart to LabeledMoneyField: a labelled, underlined
 * numeric input with a unit suffix instead of a "£" prefix. Used by the
 * vehicle flow's mileage / mpg / fuel-price fields so they sit visually
 * alongside the money fields.
 */
export function LabeledUnitField({ label, unit, value, onChange, onKeyDown, accentColor = 'var(--text-primary)' }: LabeledUnitFieldProps) {
  const [focused, setFocused] = useState(false)

  return (
    // minWidth:0 lets 1fr grid tracks shrink below the number input's
    // intrinsic width, as on LabeledMoneyField.
    <div style={{ minWidth: 0 }}>
      <FieldLabel size="sm">{label}</FieldLabel>
      <div style={{ position: 'relative' }}>
        <input
          type="number"
          min={0}
          className="no-spinner"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="0"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '0 56px 7px 0',
            fontSize: 'var(--fs-body-lg)',
            fontWeight: 700,
            border: 'none',
            borderBottom: `var(--border-width-underline) solid ${focused ? accentColor : 'var(--input-underline)'}`,
            background: 'transparent',
            color: 'var(--text-primary)',
            fontFamily: 'inherit',
            outline: 'none',
          }}
        />
        <span
          style={{
            position: 'absolute',
            right: 0,
            bottom: 10,
            fontSize: 'var(--fs-prefix-sm)',
            fontWeight: 700,
            color: 'var(--text-tertiary-dim)',
            pointerEvents: 'none',
          }}
        >
          {unit}
        </span>
      </div>
    </div>
  )
}
