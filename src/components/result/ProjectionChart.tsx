import { useId } from 'react'
import { fmt } from '../../lib/calculations'
import type { Projection } from '../../lib/projection'

// A filled area + line of the balance over time — the richer replacement for
// the old flat bars. It plots the actual £ balance (saved, or repaid) against
// a real money y-axis and a time x-axis, with a dashed goal line at the top
// and a per-month read-off on hover. Drawn as an SVG that scales to its
// container, in the same idiom as the depreciation chart in the docs.

const VIEW_W = 640
const VIEW_H = 172
const MARGIN = { top: 18, right: 16, bottom: 24, left: 58 }
const PLOT_W = VIEW_W - MARGIN.left - MARGIN.right
const PLOT_H = VIEW_H - MARGIN.top - MARGIN.bottom

interface ProjectionChartProps {
  projection: Projection
  /** Line/area colour — the mode accent on a "Yes", a neutral tone on a "No". */
  accentColor: string
}

/** The balance-over-time area chart: £ saved (or repaid) climbing month by month toward the goal line. */
export function ProjectionChart({ projection, accentColor }: ProjectionChartProps) {
  const gradientId = useId()
  const { points, target, kind } = projection
  const lastMonth = points[points.length - 1].month || 1
  const reached = points[points.length - 1].value
  const verb = kind === 'save' ? 'saved' : 'repaid'

  const x = (month: number) => MARGIN.left + (month / lastMonth) * PLOT_W
  const y = (value: number) => MARGIN.top + (1 - Math.min(1, target > 0 ? value / target : 0)) * PLOT_H

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.month).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${x(lastMonth).toFixed(1)},${(MARGIN.top + PLOT_H).toFixed(1)} L${x(0).toFixed(1)},${(MARGIN.top + PLOT_H).toFixed(1)} Z`

  const axisLabelStyle = {
    fontSize: 11,
    fontWeight: 700,
    fill: 'var(--text-tertiary)',
    fontFamily: 'var(--font-mono)',
  } as const

  // Three money gridlines: £0, half-way, and the goal.
  const yTicks = [0, target / 2, target]

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      role="img"
      aria-label={`Area chart of the balance ${verb} over time: ${fmt(0)} now, climbing to ${fmt(reached)} by ${projection.endLabel}, against a ${fmt(target)} goal.`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accentColor} stopOpacity={0.32} />
          <stop offset="100%" stopColor={accentColor} stopOpacity={0.02} />
        </linearGradient>
      </defs>

      {/* Money gridlines + labels. The top line (the goal) is dashed. */}
      {yTicks.map((value, i) => (
        <g key={i}>
          <line
            x1={MARGIN.left}
            y1={y(value)}
            x2={VIEW_W - MARGIN.right}
            y2={y(value)}
            style={{ stroke: 'var(--chart-axis-line)' }}
            strokeWidth={1}
            strokeDasharray={i === yTicks.length - 1 ? '3 5' : undefined}
          />
          <text x={MARGIN.left - 8} y={y(value) + 4} textAnchor="end" style={axisLabelStyle}>
            {fmt(value)}
          </text>
        </g>
      ))}

      {/* Filled area then the line on top. */}
      <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
      <path d={linePath} fill="none" stroke={accentColor} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

      {/* The reached point, ringed against the fill. */}
      <circle cx={x(lastMonth)} cy={y(reached)} r={4.5} fill={accentColor} stroke="var(--tile-bg)" strokeWidth={2} />

      {/* Per-month read-off: an invisible full-height hit strip carrying a native tooltip. */}
      {points.slice(1).map((p) => (
        <rect
          key={p.month}
          x={x(p.month) - PLOT_W / lastMonth / 2}
          y={MARGIN.top}
          width={PLOT_W / lastMonth}
          height={PLOT_H}
          fill="transparent"
        >
          <title>{`${p.dateLabel}: ${fmt(p.value)} ${verb}`}</title>
        </rect>
      ))}

      {/* Time axis: "Now" at the left, the goal date at the right. */}
      <text x={MARGIN.left} y={VIEW_H - 6} textAnchor="start" style={axisLabelStyle}>
        Now
      </text>
      <text x={VIEW_W - MARGIN.right} y={VIEW_H - 6} textAnchor="end" style={axisLabelStyle}>
        {projection.endLabel}
      </text>
    </svg>
  )
}
