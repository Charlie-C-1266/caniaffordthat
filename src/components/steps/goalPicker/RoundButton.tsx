import { Icon } from '../../Icon'
import type { IconName } from '../../iconRegistry'
import { usePillHover } from '../../../hooks/usePillHover'

interface RoundButtonProps {
  icon: IconName
  label: string
  onClick: () => void
}

export function RoundButton({ icon, label, onClick }: RoundButtonProps) {
  // usePillHover rather than a bare onMouseEnter: a tap fires a synthetic
  // mouseenter after touchend whose mouseleave may never come, which left the
  // arrow stuck highlighted (#205, the same defect #158 fixed for the
  // top-right pills).
  const { hovered, hoverHandlers } = usePillHover()
  return (
    <button
      type="button"
      onClick={onClick}
      {...hoverHandlers}
      aria-label={label}
      style={{
        width: 'var(--goal-nav-size)',
        height: 'var(--goal-nav-size)',
        flexShrink: 0,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid var(--icon-button-border)',
        background: hovered ? 'var(--surface-selected)' : 'var(--tile-bg)',
        color: 'var(--text-primary)',
        cursor: 'pointer',
      }}
    >
      <Icon name={icon} size={22} />
    </button>
  )
}
