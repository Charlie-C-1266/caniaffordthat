import type { ReactNode } from 'react'

/**
 * The mono breakdown box on a result card. The optional heading distinguishes
 * boxes when a card has more than one (the vehicle card's "Monthly costs" and
 * "The deal"); the standard card's single box goes without.
 */
export function BreakdownBox({ heading, children }: { heading?: string; children: ReactNode }) {
  return (
    <div
      className="mono"
      style={{
        background: 'var(--tile-bg)',
        borderRadius: 'var(--radius-glass-sm)',
        padding: '14px 15px',
        marginBottom: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        fontSize: 'var(--fs-label-sm)',
        fontWeight: 600,
      }}
    >
      {heading && (
        <div
          style={{
            fontSize: 'var(--fs-rail-label)',
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--text-tertiary)',
            marginBottom: 2,
          }}
        >
          {heading}
        </div>
      )}
      {children}
    </div>
  )
}
