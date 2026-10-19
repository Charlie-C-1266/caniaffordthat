interface PresetChipProps {
  label: string
  active: boolean
  accentColor: string
  title: string
  onClick: () => void
}

/** A one-tap suggested-amount pill for people with no idea what a car costs to maintain. */
export function PresetChip({ label, active, accentColor, title, onClick }: PresetChipProps) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      onClick={onClick}
      style={{
        padding: '7px 13px',
        borderRadius: 99,
        border: `1px solid ${active ? accentColor : 'var(--input-underline)'}`,
        background: active ? 'var(--surface-selected)' : 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontSize: 12.5,
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  )
}
