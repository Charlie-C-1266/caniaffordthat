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
      {/*
        The unit sits in the flow beside the input rather than absolutely over
        a fixed padding reservation: a flat gutter can't know how wide the
        field ends up, and in a narrow grid track it could consume the whole
        cell, leaving the typed value with zero px to render in. As a flex
        row the gutter is exactly the unit's own width, and `minWidth: 0` lets
        the input shrink without ever being squeezed out of existence.
      */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
          paddingBottom: 7,
          borderBottom: `var(--border-width-underline) solid ${focused ? accentColor : 'var(--input-underline)'}`,
        }}
      >
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
            flex: 1,
            minWidth: 0,
            boxSizing: 'border-box',
            padding: 0,
            fontSize: 'var(--fs-body-lg)',
            fontWeight: 700,
            border: 'none',
            background: 'transparent',
            color: 'var(--text-primary)',
            fontFamily: 'inherit',
            outline: 'none',
          }}
        />
        <span
          style={{
            flexShrink: 0,
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
