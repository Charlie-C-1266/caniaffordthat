interface SliderFieldProps {
  label: string
  /** The current value rendered on the right, already formatted (e.g. "25%", "6 months"). */
  valueLabel: string
  min: number
  max: number
  step: number
  value: number
  accentColor: string
  onChange: (value: number) => void
}

/** A labelled range slider with a live value read-out. Shared by the timeframe/finance and emergency-cover steps. */
export function SliderField({ label, valueLabel, min, max, step, value, accentColor, onChange }: SliderFieldProps) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-body)', marginBottom: 10 }}>
        <span style={{ color: 'var(--text-secondary-dim)' }}>{label}</span>
        <span className="mono" style={{ fontWeight: 700 }}>
          {valueLabel}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        // Without these a screen reader announces just the bare number ("3");
        // aria-label names the control and aria-valuetext reads the formatted
        // value ("3 months", "25% · £500/mo") instead of the raw number.
        aria-label={label}
        aria-valuetext={valueLabel}
        style={{ width: '100%', accentColor }}
      />
    </div>
  )
}
