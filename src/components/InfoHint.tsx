import { useId, useState } from 'react'
import { Icon } from './Icon'

interface InfoHintProps {
  /** The explanatory text revealed on hover or focus, and read out as the button's accessible name. */
  text: string
  /** Diameter of the "?" affordance in pixels. */
  size?: number
}

/**
 * A small "?" affordance that reveals a short explanation on hover or keyboard
 * focus. Used to move supporting copy out of the main layout so a tile stays
 * compact while the detail remains one interaction away.
 */
export function InfoHint({ text, size = 18 }: InfoHintProps) {
  const [open, setOpen] = useState(false)
  const tooltipId = useId()

  return (
    <span style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle' }}>
      <button
        type="button"
        aria-label={text}
        aria-describedby={open ? tooltipId : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
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
            border: '1px solid rgba(245,243,255,0.12)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
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
