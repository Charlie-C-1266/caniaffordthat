import { Icon } from '../../Icon'
import { usePillHover } from '../../../hooks/usePillHover'
import type { Goal } from '../../../lib/goals'

/** The primary landing CTA. Text stays a static "Get started" so it never overflows or reads awkwardly per goal; the focused goal's name rides along in the aria-label for screen readers (clicking the focused card selects it too). */
export function StartButton({ goal, onClick }: { goal: Goal; onClick: () => void }) {
  // See RoundButton: without this the CTA stayed lifted after a tap, and was
  // still lifted on scrolling back up to it (#205).
  const { hovered, hoverHandlers } = usePillHover()
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
      {...hoverHandlers}
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
        transform: hovered && !disabled ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'transform var(--duration-hover) ease',
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
