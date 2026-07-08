import type { ReactNode } from 'react'

/** One titled section of a doc page. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 46 }}>
      <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.01em', margin: '0 0 14px', color: 'var(--text-primary)' }}>
        {title}
      </h2>
      {children}
    </section>
  )
}
