import type { CSSProperties, ReactNode } from 'react'

interface RevealTileProps {
  /** Whether this step has been centered in the viewport at least once. */
  revealed: boolean
  children: ReactNode
  style?: CSSProperties
}

const HIDDEN_TRANSFORM = 'translateY(56px)'
const REVEAL_TRANSITION =
  'transform var(--duration-reveal) var(--ease-reveal-transform), opacity var(--duration-reveal) var(--ease-reveal-opacity)'

/**
 * The foreground "tile" card that slides up and fades in the first time its
 * step is revealed, then stays visible even if the user scrolls back past it
 * — per the design doc, reveal is one-way, driven entirely by the `revealed`
 * flag in shared state (see `useStepObserver`).
 */
export function RevealTile({ revealed, children, style }: RevealTileProps) {
  return (
    <div
      style={{
        opacity: revealed ? 1 : 0,
        transform: revealed ? 'translateY(0)' : HIDDEN_TRANSFORM,
        transition: REVEAL_TRANSITION,
        ...style,
      }}
    >
      {children}
    </div>
  )
}
