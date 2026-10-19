interface BreakdownRowProps {
  label: string
  value: string
  /** The box's emphasised bottom line, set off by a rule above it. TotalRow sets this. */
  total?: boolean
}

/** One label/value line in a result card's mono breakdown box. */
export function BreakdownRow({ label, value, total = false }: BreakdownRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        ...(total && { paddingTop: 9, borderTop: '1px solid var(--tile-border-neutral)' }),
      }}
    >
      <span style={{ color: 'var(--text-secondary-dim)' }}>{label}</span>
      <span style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  )
}
