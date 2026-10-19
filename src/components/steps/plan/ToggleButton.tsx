interface ToggleButtonProps {
  label: string
  active: boolean
  accentColor: string
  onClick: () => void
}

/** One of the Plan step's two timeframe choices — "How long will it take?" or "I have a goal date" — as a full-width button that takes the mode's accent when active. */
export function ToggleButton({ label, active, accentColor, onClick }: ToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: 14,
        borderRadius: 'var(--radius-button)',
        border: `var(--border-width-card) solid ${active ? accentColor : 'var(--input-underline)'}`,
        background: active ? 'var(--surface-selected)' : 'transparent',
        color: 'var(--text-primary)',
        fontSize: 14,
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  )
}
