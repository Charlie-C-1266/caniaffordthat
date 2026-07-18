import { useState } from 'react'
import { SegmentedControl, type SegmentedOption } from '../SegmentedControl'
import { ProjectionChart } from './ProjectionChart'
import { BudgetDonut } from './BudgetDonut'
import { ProjectionTable } from './ProjectionTable'
import { CHART_MONTHS_CAP, type Projection } from '../../lib/projection'
import type { BudgetBreakdown } from '../../lib/budgetSplit'

// The result screen's data views, behind one small toggle: the balance chart
// (how the goal is reached over time), the budget donut (how the new cost sits
// within the month's money), and the projection table (the exact month-by-
// month figures). When there's no time series to project — a cash purchase, or
// a target already met — only the budget view is offered.

type ChartView = 'chart' | 'budget' | 'table'

/** Neutral segmented-toggle styling — the mode accent is carried by the chart itself, not the switch. */
const VIEW_OPTIONS: readonly SegmentedOption<ChartView>[] = [
  { value: 'chart', label: 'Balance', activeBackground: 'var(--surface-selected)', activeColor: 'var(--text-primary)' },
  { value: 'budget', label: 'Budget', activeBackground: 'var(--surface-selected)', activeColor: 'var(--text-primary)' },
  { value: 'table', label: 'Table', activeBackground: 'var(--surface-selected)', activeColor: 'var(--text-primary)' },
]

interface ResultChartProps {
  /** The balance-over-time series, or `null` when there's nothing to project (cash, or an already-met target). */
  projection: Projection | null
  budget: BudgetBreakdown
  /** Chart-view heading — "Savings balance over time" or "Balance repaid over time". */
  chartTitle: string
  /** Line/donut-neutral accent: the mode accent on a "Yes", a neutral tone on a "No". */
  accentColor: string
  /** What the new-cost slice is called in the budget view. */
  newCostLabel: string
  /** The plan's full length, for the "chart capped" caption. */
  months: number
}

const boxStyle = {
  background: 'var(--tile-bg)',
  borderRadius: 'var(--radius-glass-sm)',
  padding: '13px 15px 12px',
  marginBottom: 10,
} as const

const titleStyle = {
  fontSize: 'var(--fs-label)',
  fontWeight: 800,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'var(--text-secondary-dim)',
} as const

/** Hosts the balance chart, budget donut and projection table under one toggle; the budget donut alone when there's no series to project. */
export function ResultChart({ projection, budget, chartTitle, accentColor, newCostLabel, months }: ResultChartProps) {
  const [view, setView] = useState<ChartView>('chart')

  // No time series (cash / already met): the budget donut is the whole story.
  if (projection === null) {
    return (
      <div style={boxStyle}>
        <div style={{ ...titleStyle, marginBottom: 12 }}>Where your money goes</div>
        <BudgetDonut budget={budget} newCostLabel={newCostLabel} />
      </div>
    )
  }

  const heading = view === 'chart' ? chartTitle : view === 'budget' ? 'Where your money goes' : 'Month by month'

  return (
    <div style={boxStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={titleStyle}>{heading}</div>
        <SegmentedControl options={VIEW_OPTIONS} value={view} onChange={setView} size="sm" />
      </div>

      {view === 'chart' && <ProjectionChart projection={projection} accentColor={accentColor} />}
      {view === 'budget' && <BudgetDonut budget={budget} newCostLabel={newCostLabel} />}
      {view === 'table' && <ProjectionTable projection={projection} />}

      {view !== 'budget' && projection.hasOverflow && (
        <div style={{ marginTop: 8, fontSize: 'var(--fs-label)', color: 'var(--text-tertiary)', fontWeight: 600 }}>
          Showing the first {CHART_MONTHS_CAP} months — the full term is {months} months.
        </div>
      )}
    </div>
  )
}
