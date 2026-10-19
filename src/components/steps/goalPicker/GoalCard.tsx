import type { CSSProperties } from 'react'
import { Icon } from '../../Icon'
import type { Goal } from '../../../lib/goals'

// Card width and the horizontal gap between adjacent cards' centres. The
// design's cover-flow spec is 250px wide, stepped 268px apart, which needs
// ~1100px of room for the focused card and one neighbour each side — so both
// are read from custom properties that index.css steps down on narrow
// viewports rather than being baked in here (see --goal-card-width).
const CARD_WIDTH = 'var(--goal-card-width)'
const CARD_STEP_X = 'var(--goal-card-step-x)'
// Cards more than this many positions from centre are faded out / non-interactive.
const MAX_VISIBLE_OFFSET = 2

/** Per-card cover-flow transform, opacity, and stacking from its distance to the focused card. */
function cardGeometry(offset: number): CSSProperties {
  const ax = Math.abs(offset)
  const scale = Math.max(0.7, 1 - ax * 0.13)
  // Written as an explicit +/- term rather than a signed multiplier, so the
  // generated calc() never reads `+ -3 * ...`.
  const step = offset === 0 ? '' : ` ${offset < 0 ? '-' : '+'} ${ax} * ${CARD_STEP_X}`
  return {
    transform: `translateX(calc(-50%${step})) scale(${scale})`,
    opacity: ax > MAX_VISIBLE_OFFSET ? 0 : 1 - ax * 0.32,
    zIndex: 20 - ax,
    pointerEvents: ax > MAX_VISIBLE_OFFSET ? 'none' : 'auto',
  }
}

interface GoalCardProps {
  goal: Goal
  offset: number
  focused: boolean
  /** When true, don't animate the horizontal move — the card is jumping across the wrap seam and should re-appear on the other side rather than fly across. */
  teleport: boolean
  onFocus: () => void
  onSelect: () => void
}

export function GoalCard({ goal, offset, focused, teleport, onFocus, onSelect }: GoalCardProps) {
  const geo = cardGeometry(offset)
  // The text-safe variant: this accent is used for the card border, icon
  // fill, and tag-label text below, and --accent-save fails contrast as
  // text/icon colour in the light theme (see tokens.css).
  const accent = 'var(--accent-save-text)'
  // Opacity still eases (so a wrapped card fades in/out in place) but the
  // transform jumps instantly across the seam when teleporting. The slide's
  // duration is a token so reduced motion can collapse it (see tokens.css).
  const transition = teleport
    ? 'opacity 0.5s ease, background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease'
    : 'transform var(--duration-carousel) cubic-bezier(0.16,1,0.3,1), opacity 0.5s ease, background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease'

  return (
    <button
      type="button"
      // A "Soon" goal never gets `onSelect` wired up at all, so selecting one
      // is structurally impossible rather than guarded against at the far end
      // (#207). `disabled` below already stops the click, so this changes
      // nothing a user can see — but it is evaluated on every render, which
      // makes it a rule the tests actually exercise, where the old
      // `if (goal.soon) return` inside select() was unreachable dead code.
      onClick={focused && !goal.soon ? onSelect : onFocus}
      disabled={goal.soon && focused}
      aria-label={goal.soon ? `${goal.name} (coming soon)` : focused ? `Continue with ${goal.name}` : `Focus ${goal.name}`}
      style={{
        position: 'absolute',
        top: 0,
        left: '50%',
        width: CARD_WIDTH,
        boxSizing: 'border-box',
        textAlign: 'left',
        borderRadius: 22,
        padding: '30px 26px 26px',
        backdropFilter: 'blur(12px)',
        cursor: goal.soon ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
        color: 'var(--text-primary)',
        background: focused ? 'var(--accent-save-bg-card)' : 'var(--tile-bg-neutral)',
        border: `1.5px solid ${focused ? accent : 'var(--divider)'}`,
        boxShadow: focused ? 'var(--shadow-card-focused)' : 'var(--shadow-card)',
        transition,
        ...geo,
      }}
    >
      {goal.soon && (
        <span
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            padding: '4px 9px',
            borderRadius: 99,
            background: 'var(--surface-selected)',
            border: '1px solid var(--tile-border-neutral)',
            color: 'var(--text-secondary-mid)',
          }}
        >
          Soon
        </span>
      )}
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 18,
          background: focused ? 'var(--accent-save-bg-chip)' : 'var(--surface-faint)',
          color: focused ? accent : 'var(--icon-chip-fg)',
        }}
      >
        <Icon name={goal.icon} size={26} />
      </div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: focused ? accent : 'var(--text-tertiary)',
          marginBottom: 8,
        }}
      >
        {goal.tag}
      </div>
      <div style={{ fontSize: 23, fontWeight: 800, marginBottom: 8 }}>{goal.name}</div>
      <div
        style={{
          fontSize: 13.5,
          fontWeight: 500,
          lineHeight: 1.5,
          color: 'var(--text-secondary-mid)',
          minHeight: 40,
        }}
      >
        {goal.blurb}
      </div>
    </button>
  )
}
