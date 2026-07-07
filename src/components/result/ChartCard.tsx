import { fmt } from '../../lib/calculations'
import { CHART_MONTHS_CAP, type ChartBar } from '../../lib/derive'

const CHART_BAR_AREA_HEIGHT = 74

interface ChartCardProps {
  bars: ChartBar[]
  endLabel: string
  hasOverflow: boolean
  months: number
  target: number
  title: string
  /** Fill for the final (most recent) bar — the mode accent when affordable, a neutral tone on a "No". */
  currentBarColor: string
}

/** Month-by-month projection toward the goal, styled for the dark tile. Shared by the standard and vehicle result cards. */
export function ChartCard({ bars, endLabel, hasOverflow, months, target, title, currentBarColor }: ChartCardProps) {
  const axisLabelStyle = {
    fontSize: 'var(--fs-rail-label)',
    color: 'var(--text-tertiary)',
    fontWeight: 700,
  } as const
  return (
    <div style={{ background: 'var(--tile-bg)', borderRadius: 'var(--radius-glass-sm)', padding: '13px 15px 11px', marginBottom: 10 }}>
      <div
        style={{
          fontSize: 'var(--fs-label)',
          fontWeight: 800,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--text-secondary-dim)',
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div
          className="mono"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: CHART_BAR_AREA_HEIGHT,
            textAlign: 'right',
            ...axisLabelStyle,
          }}
        >
          <span style={{ color: 'var(--text-secondary)' }}>{fmt(target)}</span>
          <span>£0</span>
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 3,
              height: CHART_BAR_AREA_HEIGHT,
              borderTop: '1px dashed rgba(245,243,255,0.22)',
              borderBottom: '1px solid rgba(245,243,255,0.22)',
            }}
          >
            {bars.map((bar, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
                <div
                  style={{
                    width: '100%',
                    borderRadius: '2px 2px 0 0',
                    background: i === bars.length - 1 ? currentBarColor : 'rgba(245,243,255,0.2)',
                    height: `${bar.heightPct}%`,
                    minHeight: 3,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7, textTransform: 'uppercase', ...axisLabelStyle }}>
            <span>Now</span>
            <span>{endLabel}</span>
          </div>
        </div>
      </div>
      {hasOverflow && (
        <div style={{ marginTop: 8, fontSize: 'var(--fs-label)', color: 'var(--text-tertiary)', fontWeight: 600 }}>
          Chart capped at {CHART_MONTHS_CAP} months — full term is {months} months.
        </div>
      )}
    </div>
  )
}
