/** One choice in a SegmentedControl. */
export interface SegmentedOption<T extends string> {
  value: T
  label: string
  /** Button background while this option is selected. */
  activeBackground: string
  /** Label color while selected (must contrast with `activeBackground`). */
  activeColor: string
}

interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[]
  /** The currently selected option's value. */
  value: T
  onChange: (value: T) => void
  /** `'md'`: full-width with equal-width segments (the pay-mode toggle). `'sm'`: compact, content-sized (the rate-mode toggle). */
  size?: 'md' | 'sm'
}

/**
 * The pill-shaped segmented toggle used for either/or choices — "Save up /
 * Pay monthly" in Details and "% of spare cash / Fixed amount" in Plan. One
 * component so the two toggles share their structure and interaction styling
 * rather than each rebuilding the pill from scratch.
 */
export function SegmentedControl<T extends string>({ options, value, onChange, size = 'md' }: SegmentedControlProps<T>) {
  const md = size === 'md'
  return (
    <div
      style={{
        display: 'flex',
        gap: 5,
        padding: md ? 5 : 4,
        borderRadius: md ? 14 : 12,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(245,243,255,0.08)',
        width: md ? undefined : 'fit-content',
      }}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            style={{
              flex: md ? 1 : undefined,
              padding: md ? '11px 14px' : '8px 14px',
              borderRadius: md ? 10 : 9,
              border: 'none',
              fontSize: md ? 14 : 13,
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: 'pointer',
              background: active ? option.activeBackground : 'transparent',
              color: active ? option.activeColor : 'var(--text-secondary)',
              transition: 'background 0.2s ease, color 0.2s ease',
            }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
