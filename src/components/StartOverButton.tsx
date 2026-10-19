/**
 * Small persistent top-right button that clears the flow and scrolls back to
 * the first step. Shares the "ghost pill" chrome, and its touch-safe hover
 * (`.pill-control` in index.css), with SourcesLink.
 */
export function StartOverButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      data-testid="start-over"
      onClick={onClick}
      className="pill-control"
      style={{
        border: '1px solid var(--pill-border)',
        color: 'var(--text-primary)',
        fontSize: 'var(--pill-font-size)',
        fontWeight: 600,
        padding: 'var(--pill-padding-block) var(--pill-padding-inline)',
        borderRadius: 20,
        cursor: 'pointer',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
      }}
    >
      Start over
    </button>
  )
}
