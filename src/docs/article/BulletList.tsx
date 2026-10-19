import type { ReactNode } from 'react'

/** A doc page's spaced bullet list: a calculator's sources, or the per-calculator methodology links. Its items are BulletItems. */
export function BulletList({ children }: { children: ReactNode }) {
  return <ul style={{ margin: '0 0 14px', paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</ul>
}
