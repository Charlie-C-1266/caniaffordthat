/** Small persistent status badge — this is an early build, not a finished product. */
export function AlphaBadge() {
  return (
    <span
      title="Early alpha — expect bugs, missing polish, and frequent changes while this is actively being built."
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: '#f5a623',
        border: '1px solid rgba(245, 166, 35, 0.5)',
        borderRadius: 999,
        padding: '2px 7px',
        cursor: 'default',
      }}
    >
      Alpha
    </span>
  )
}
