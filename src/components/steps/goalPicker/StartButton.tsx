import { Icon } from '../../Icon'
import type { Goal } from '../../../lib/goals'

/** The primary landing CTA. Text stays a static "Get started" so it never overflows or reads awkwardly per goal; the focused goal's name rides along in the aria-label for screen readers (clicking the focused card selects it too). */
export function StartButton({ goal, onClick }: { goal: Goal; onClick: () => void }) {
  const disabled = Boolean(goal.soon)

  return (
    <button
      type="button"
      // Not wired for a "Soon" goal, matching GoalCard: `disabled` already
      // stops the click, so this is the second, structural layer that keeps
      // select() unreachable for one (#207).
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-label={disabled ? undefined : `Get started with ${goal.name}`}
      // The hover lift is CSS (`.goal-cta` in index.css): a mouse-driven lift
      // stayed on after a tap, and was still on when scrolling back up (#205).
      className="goal-cta"
      style={{
        minWidth: 'var(--goal-cta-min-width)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '16px var(--goal-cta-padding-x)',
        whiteSpace: 'nowrap',
        borderRadius: 99,
        border: 'none',
        fontSize: 15.5,
        fontWeight: 800,
        fontFamily: 'inherit',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: disabled ? 'var(--pill-bg)' : 'var(--accent-save-gradient)',
        color: disabled ? 'var(--text-disabled)' : 'var(--on-accent-save)',
        boxShadow: disabled ? 'none' : 'var(--accent-save-shadow-strong)',
      }}
    >
      {disabled ? 'Coming soon' : 'Get started'}
      {!disabled && <Icon name="arrow-right" size={18} />}
    </button>
  )
}
