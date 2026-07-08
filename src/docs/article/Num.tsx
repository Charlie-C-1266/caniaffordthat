import type { ReactNode } from 'react'

/** Mono-set numeric value inside a DataTable cell or prose. */
export function Num({ children }: { children: ReactNode }) {
  return (
    <span className="mono" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
      {children}
    </span>
  )
}
