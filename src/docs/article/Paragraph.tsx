import type { ReactNode } from 'react'

/** A body paragraph on a doc page. */
export function Paragraph({ children }: { children: ReactNode }) {
  return (
    <p style={{ fontSize: 'var(--fs-body-lg)', lineHeight: 1.65, color: 'var(--text-secondary)', margin: '0 0 14px', fontWeight: 500 }}>
      {children}
    </p>
  )
}
