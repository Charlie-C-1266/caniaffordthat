import { UK_AVERAGE_ANNUAL_MILES } from '../lib/vehicle'
import { retentionCurve, type CurvePoint } from './curve'

// Chart geometry: a 640x340 viewBox scaled responsively, with margins for
// the axis labels.
const VIEW_W = 640
const VIEW_H = 340
// Right margin leaves room for the final "10 yrs" tick label, which is
// centred on the plot's right edge.
const MARGIN = { top: 14, right: 30, bottom: 42, left: 48 }
const PLOT_W = VIEW_W - MARGIN.left - MARGIN.right
const PLOT_H = VIEW_H - MARGIN.top - MARGIN.bottom
const MAX_YEARS = 10

/** The three mileage profiles the chart contrasts. Colours are theme accents that read apart on the dark background. */
const SERIES = [
  { annualMiles: 4_000, color: '#5ee0ff', label: '4,000 miles/year' },
  { annualMiles: UK_AVERAGE_ANNUAL_MILES, color: 'var(--accent-save)', label: `${UK_AVERAGE_ANNUAL_MILES.toLocaleString('en-GB')} miles/year (UK average)` },
  { annualMiles: 16_000, color: 'var(--accent-finance)', label: '16,000 miles/year' },
]

const x = (ageYears: number) => MARGIN.left + (ageYears / MAX_YEARS) * PLOT_W
const y = (retentionPct: number) => MARGIN.top + (1 - retentionPct / 100) * PLOT_H

/** SVG polyline path for one retention series. */
function pathFor(points: CurvePoint[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.ageYears).toFixed(1)},${y(p.retentionPct).toFixed(1)}`).join(' ')
}

const axisLabelStyle = {
  fontSize: 11,
  fontWeight: 700,
  fill: 'var(--text-tertiary)',
  fontFamily: 'var(--font-mono)',
} as const

/**
 * The generic depreciation curve the balloon estimator uses, drawn live from
 * the same `retentionAt`/`mileageFactor` functions — value retained (% of the
 * as-new price) against age, for three annual-mileage profiles.
 */
export function DepreciationChart() {
  return (
    <figure style={{ margin: 0 }}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        role="img"
        aria-label="Line chart of the generic depreciation curve: share of as-new value retained over ten years, shown for 4,000, 8,000 and 16,000 miles a year. Higher annual mileage retains less value."
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        {/* Horizontal gridlines at 0/25/50/75/100% */}
        {[0, 25, 50, 75, 100].map((pct) => (
          <g key={pct}>
            <line
              x1={MARGIN.left}
              y1={y(pct)}
              x2={VIEW_W - MARGIN.right}
              y2={y(pct)}
              stroke="rgba(245,243,255,0.12)"
              strokeWidth={1}
              strokeDasharray={pct === 0 ? undefined : '3 5'}
            />
            <text x={MARGIN.left - 8} y={y(pct) + 4} textAnchor="end" style={axisLabelStyle}>
              {pct}%
            </text>
          </g>
        ))}

        {/* X-axis year ticks */}
        {[0, 2, 4, 6, 8, 10].map((year) => (
          <text key={year} x={x(year)} y={VIEW_H - MARGIN.bottom + 20} textAnchor="middle" style={axisLabelStyle}>
            {year === 0 ? 'New' : `${year} yrs`}
          </text>
        ))}
        <text
          x={MARGIN.left + PLOT_W / 2}
          y={VIEW_H - 4}
          textAnchor="middle"
          style={{ ...axisLabelStyle, fill: 'var(--text-secondary-dim)', fontFamily: 'var(--font-ui)' }}
        >
          Age of car
        </text>

        {SERIES.map((series) => (
          <path
            key={series.annualMiles}
            d={pathFor(retentionCurve(series.annualMiles, MAX_YEARS))}
            fill="none"
            stroke={series.color}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
      </svg>

      <figcaption
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px 22px',
          marginTop: 10,
          fontSize: 'var(--fs-helper)',
          fontWeight: 600,
          color: 'var(--text-secondary)',
        }}
      >
        {SERIES.map((series) => (
          <span key={series.annualMiles} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <span aria-hidden="true" style={{ width: 18, height: 3, borderRadius: 2, background: series.color, display: 'inline-block' }} />
            {series.label}
          </span>
        ))}
      </figcaption>
    </figure>
  )
}
