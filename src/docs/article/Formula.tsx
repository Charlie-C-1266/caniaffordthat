import type { ReactNode } from 'react'
import { useOverflowX } from '../../hooks/useOverflowX'
import { scrollerRegionProps } from './scrollerRegion'

interface FormulaProps {
  children: ReactNode
  /** What this formula works out, e.g. "take-home" — read as "Formula: take-home" once it is wide enough to scroll. */
  label?: string
}

/** A formula, set in the mono face on its own soft card. Scrolls horizontally rather than wrapping. */
export function Formula({ children, label }: FormulaProps) {
  const [scrollerRef, overflowing] = useOverflowX<HTMLPreElement>()

  return (
    <pre
      ref={scrollerRef}
      className="mono doc-scroller"
      {...scrollerRegionProps(overflowing, label === undefined ? 'Formula' : `Formula: ${label}`)}
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
