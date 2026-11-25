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
 *
 * However it was opened, the tooltip is dismissible with Escape without moving
 * the pointer or focus (WCAG 2.2 SC 1.4.13). Escape only closes it: focus stays
 * on the button, and a later focus, hover or click reopens it as usual.
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

  // Two while-open dismissals, both on `document`:
  //
  // - A tap-opened tooltip has no mouseleave to close it, so any press outside
  //   the component dismisses it. (Hover/focus opens still close themselves via
  //   mouseleave/blur; this listener is just harmless for those.)
  // - Escape dismisses it from the keyboard without moving the pointer or
  //   focus, which WCAG 2.2 SC 1.4.13 (Content on Hover or Focus) requires.
  //   Before #284 a keyboard or screen-magnifier user who tabbed onto a hint
  //   could only close the popover by tabbing away, leaving up to 260px of it
  //   covering the field above.
  //
  // Escape listens on `document` rather than via onKeyDown on the button for
  // the same reason the press does: a hover-opened tooltip leaves focus
  // wherever it already was, so a handler bound to the button would never see
  // the key. Both listeners only exist while `open`, so Escape is a no-op the
  // rest of the time. Neither blurs the button nor touches `touchRef`: focus
  // stays exactly where it was, and the tap flow from #31 is unaffected.
  //
  // The key event is left to propagate. Nothing else in the app acts on
  // Escape (the only other keydown handlers watch for Enter), so stopping it
  // would buy nothing and would quietly swallow the key from anything added
  // later.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: Event) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
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
