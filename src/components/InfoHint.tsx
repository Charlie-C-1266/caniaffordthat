import { useEffect, useId, useRef, useState } from 'react'
import { Icon } from './Icon'

interface InfoHintProps {
  /** The explanatory text revealed on hover, focus or tap, and read out as the button's accessible name. */
  text: string
  /** Diameter of the "?" affordance in pixels. */
  size?: number
}

/**
 * A small "?" affordance that reveals a short explanation on hover, keyboard
 * focus, or tap. Used to move supporting copy out of the main layout so a tile
 * stays compact while the detail remains one interaction away.
 */
export function InfoHint({ text, size = 18 }: InfoHintProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)
  // True between a touchstart on the button and the click it resolves to.
  // Mobile browsers synthesize mouseenter/focus events *before* that click, so
  // without this guard a tap would open the tooltip via the synthetic hover
  // and then immediately toggle it shut again via the click. While set, only
  // the click itself may change `open`.
  const touchRef = useRef(false)
  const tooltipId = useId()

  // A tap-opened tooltip has no mouseleave to close it, so while open, any
  // press outside the component dismisses it. (Hover/focus opens still close
  // themselves via mouseleave/blur; this listener is just harmless for those.)
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: Event) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  return (
    <span ref={rootRef} style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle' }}>
      <button
        type="button"
        aria-label={text}
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        onTouchStart={() => {
          touchRef.current = true
        }}
        onMouseEnter={() => {
          if (!touchRef.current) setOpen(true)
        }}
        onMouseLeave={() => {
          if (!touchRef.current) setOpen(false)
        }}
        onFocus={() => {
          if (!touchRef.current) setOpen(true)
        }}
        onBlur={() => {
          if (!touchRef.current) setOpen(false)
        }}
        onClick={() => {
          setOpen((current) => !current)
          touchRef.current = false
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size,
          height: size,
          padding: 0,
          border: 'none',
          borderRadius: '50%',
          background: 'transparent',
          color: 'var(--text-tertiary)',
          cursor: 'help',
          transition: 'color 0.15s ease',
        }}
      >
        <Icon name="help-circle" size={size} strokeWidth={2} />
      </button>
      {open && (
        <span
          id={tooltipId}
          role="tooltip"
          style={{
            position: 'absolute',
            bottom: `calc(100% + 10px)`,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'max-content',
            maxWidth: 260,
            padding: '10px 12px',
            borderRadius: 10,
            background: 'var(--bg-dark-1)',
            border: '1px solid var(--tile-border-neutral)',
            boxShadow: 'var(--shadow-popover)',
            fontSize: 'var(--fs-helper)',
            fontWeight: 500,
            lineHeight: 1.45,
            color: 'var(--text-secondary)',
            textTransform: 'none',
            letterSpacing: 'normal',
            zIndex: 5,
            pointerEvents: 'none',
          }}
        >
          {text}
        </span>
      )}
    </span>
  )
}
