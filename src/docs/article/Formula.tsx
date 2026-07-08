import type { ReactNode } from 'react'

/** A formula, set in the mono face on its own soft card. Scrolls horizontally rather than wrapping. */
export function Formula({ children }: { children: ReactNode }) {
  return (
    <pre
      className="mono"
      style={{
        background: 'var(--tile-bg)',
        borderRadius: 'var(--radius-glass-sm)',
        padding: '13px 16px',
        margin: '0 0 14px',
        fontSize: 14,
        fontWeight: 600,
        color: 'var(--text-primary)',
        overflowX: 'auto',
        whiteSpace: 'pre',
      }}
    >
      {children}
    </pre>
  )
}
