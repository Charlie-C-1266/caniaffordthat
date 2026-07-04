import type { CSSProperties, ReactNode } from 'react'

interface TileProps {
  children: ReactNode
  maxWidth: number
  padding: string
  style?: CSSProperties
}

/**
 * The bordered "glass" card shared by steps 0-3 (the mode-select, item+price,
 * budget, and timeframe/finance screens). The result step doesn't use this —
 * it has no card chrome of its own, just its glass sub-panels.
 */
export function Tile({ children, maxWidth, padding, style }: TileProps) {
  return (
    <div
      style={{
        width: '100%',
        maxWidth,
        boxSizing: 'border-box',
        border: 'var(--border-width-card) solid var(--tile-border)',
        borderRadius: 'var(--radius-tile)',
        background: 'var(--tile-bg-neutral)',
        boxShadow: 'var(--shadow-tile)',
        padding,
        ...style,
      }}
    >
      {children}
    </div>
  )
}
