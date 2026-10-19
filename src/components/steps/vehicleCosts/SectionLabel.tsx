import type { ReactNode } from 'react'

/** Uppercase section label within the costs tile, matching the budget grid's heading style. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 'var(--fs-label)',
        fontWeight: 700,
        color: 'var(--text-tertiary)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  )
}
