import type { ReactNode } from 'react'

/**
 * The soft-background summary box used for live "here's what that means"
 * readouts: the emergency fund's target line in Details, the vehicle
 * purchase step's cash figure and balloon-estimate preview, and the costs
 * step's running-costs total. One component so the box can't drift between
 * steps.
 */
export function SummaryBox({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        padding: '15px 17px',
        borderRadius: 14,
        background: 'rgba(255,255,255,0.04)',
        fontSize: 'var(--fs-body)',
        color: 'var(--text-secondary)',
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  )
}
