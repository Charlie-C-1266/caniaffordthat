import { Icon } from '../../Icon'
import type { IconName } from '../../iconRegistry'

interface RoundButtonProps {
  icon: IconName
  label: string
  onClick: () => void
}

export function RoundButton({ icon, label, onClick }: RoundButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      // The hover background is CSS (`.carousel-arrow` in index.css) rather than
      // a mouseenter handler, so a tap can't leave the arrow highlighted (#205).
      className="carousel-arrow"
      style={{
        width: 'var(--goal-nav-size)',
        height: 'var(--goal-nav-size)',
        flexShrink: 0,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid var(--icon-button-border)',
        color: 'var(--text-primary)',
        cursor: 'pointer',
      }}
    >
      <Icon name={icon} size={22} />
    </button>
  )
}
