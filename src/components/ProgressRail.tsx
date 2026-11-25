interface ProgressRailProps {
  activeIndex: number
  /** One label per step; content is the caller's concern, not this component's. */
  labels: string[]
  accentColor: string
  onSelect: (index: number) => void
}

/**
 * Fixed, vertically-centred rail of step dots on the right edge. The active
 * dot is larger, filled with the accent colour; inactive dots are hollow
 * (transparent fill, dim border). Dots only — the step name is exposed to
 * assistive tech via each button's aria-label rather than rendered, so the
 * rail never overlaps the tiles. Clicking any dot jumps straight to that step.
 *
 * Each button is at least `--target-size-min` (24px) square with its dot
 * centred inside, so the hit area is far bigger than the mark it shows
 * (#286). It used to wrap only the visible dot, which made every inactive
 * step a 7×7px target and the active one 10×10px — well under WCAG 2.2 SC
 * 2.5.8 Target Size (Minimum), AA. The spacing exception didn't rescue it
 * either: with the old `gap: 16`, two inactive dots' centres were 7 + 16 =
 * 23px apart, so 24px circles centred on them would overlap. The dots are the
 * only way to jump between steps, which made them hard to hit with a mouse
 * and very hard on touch.
 *
 * The `gap` and `right` offset are retuned so the rail still looks the same
 * now the buttons are bigger. `gap: 2` puts dot centres 26px apart against
 * the old 23px, and leaves a clear 2px between neighbouring hit areas rather
 * than having them merely touch. `right: 18` centres a 24px button where the
 * old dot sat: dot centres land 30px from the viewport edge, against 29.5px
 * for an inactive dot and 31px for the active one before. (Centring also
 * aligns the two dot sizes concentrically, where the old right-aligned rail
 * left their centres 1.5px apart.)
 */
export function ProgressRail({ activeIndex, labels, accentColor, onSelect }: ProgressRailProps) {
  return (
    <nav
      aria-label="Step progress"
      style={{
        position: 'fixed',
        right: 18,
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
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
              justifyContent: 'center',
              minWidth: 'var(--target-size-min)',
              minHeight: 'var(--target-size-min)',
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
