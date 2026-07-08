/** The doc pages' shared header: brand mark and a way back to the calculator. */
export function PageHeader({ accentColor = 'var(--accent-save)' }: { accentColor?: string }) {
  return (
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 44 }}>
      <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
        <span style={{ width: 20, height: 20, borderRadius: 5, background: accentColor, display: 'inline-block' }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Can I Afford That?</span>
      </a>
      <a href="/" style={{ color: 'var(--text-secondary)', textDecoration: 'underline', fontSize: 'var(--fs-helper)', fontWeight: 600 }}>
        ← Back to the calculator
      </a>
    </header>
  )
}
