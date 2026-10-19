import type { ReactNode } from 'react'

/** One entry in a BulletList, in the doc pages' body size and secondary colour. */
export function BulletItem({ children }: { children: ReactNode }) {
  return <li style={{ fontSize: 'var(--fs-body)', lineHeight: 1.5, color: 'var(--text-secondary)' }}>{children}</li>
}
