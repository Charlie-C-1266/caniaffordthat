import type { ReactNode } from 'react'

/** Emphasised inline value — a doc page's numbers stand out from the prose. */
export function Strong({ children }: { children: ReactNode }) {
  return <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{children}</strong>
}
