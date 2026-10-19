/** The landing pill: a reassurance line that this is quick and free, carrying the old title card's value prop onto the carousel. */
export function LandingPill() {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 15px',
        borderRadius: 99,
        border: '1px solid var(--accent-save-border-soft)',
        background: 'var(--accent-save-bg-pill)',
        marginBottom: 20,
      }}
    >
      <span
        style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-save)', boxShadow: '0 0 10px var(--accent-save)' }}
      />
      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--brand-mint)' }}>Free · no sign-up · takes 2 minutes</span>
    </div>
  )
}
