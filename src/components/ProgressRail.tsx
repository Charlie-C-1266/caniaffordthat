interface ProgressRailProps {
  activeIndex: number
  /** One label per step; content is the caller's concern, not this component's. */
  labels: string[]
  accentColor: string
  onSelect: (index: number) => void
}

/**
 * Fixed, vertically-centered rail of step dots on the right edge. The active
 * dot is larger, filled with the accent color; inactive dots are hollow
 * (transparent fill, dim border). Dots only — the step name is exposed to
 * assistive tech via each button's aria-label rather than rendered, so the
 * rail never overlaps the tiles. Clicking any dot jumps straight to that step.
 */
export function ProgressRail({ activeIndex, labels, accentColor, onSelect }: ProgressRailProps) {
  return (
    <nav
      aria-label="Step progress"
      style={{
        position: 'fixed',
        right: 26,
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        alignItems: 'flex-end',
        zIndex: 60,
      }}
    >
      {labels.map((label, index) => {
        const isActive = index === activeIndex
        return (
          <button
            key={label}
            type="button"
            onClick={() => onSelect(index)}
            aria-current={isActive ? 'step' : undefined}
            aria-label={label}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: 'block',
                width: isActive ? 'var(--dot-size-active)' : 'var(--dot-size-inactive)',
                height: isActive ? 'var(--dot-size-active)' : 'var(--dot-size-inactive)',
                borderRadius: '50%',
                background: isActive ? accentColor : 'transparent',
                border: `var(--border-width-dot) solid ${isActive ? accentColor : 'var(--text-tertiary-dim)'}`,
              }}
            />
          </button>
        )
      })}
    </nav>
  )
}
