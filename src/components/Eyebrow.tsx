import type { ReactNode } from 'react'

interface EyebrowProps {
  children: ReactNode
  color?: string
  marginBottom?: number
}

/** Small uppercase label used at the top of every step's tile. */
export function Eyebrow({ children, color = 'var(--text-tertiary)', marginBottom = 18 }: EyebrowProps) {
  return (
    <div
      style={{
        fontSize: 'var(--fs-helper)',
        fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color,
        marginBottom,
      }}
    >
      {children}
    </div>
  )
}
