import { usePillHover } from '../hooks/usePillHover'

/**
 * Small persistent top-right button that clears the flow and scrolls back to
 * the first step. Shares the "ghost pill" chrome — and its touch-safe hover
 * handling — with SourcesLink.
 */
export function StartOverButton({ onClick }: { onClick: () => void }) {
  const { hovered, hoverHandlers } = usePillHover()

  return (
    <button
      type="button"
      data-testid="start-over"
      onClick={onClick}
      {...hoverHandlers}
      style={{
        background: hovered ? 'var(--pill-bg-hover)' : 'var(--pill-bg)',
        border: '1px solid var(--pill-border)',
        color: 'var(--text-primary)',
        fontSize: 12.5,
        fontWeight: 600,
        padding: '8px 14px',
        borderRadius: 20,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      Start over
    </button>
  )
}
