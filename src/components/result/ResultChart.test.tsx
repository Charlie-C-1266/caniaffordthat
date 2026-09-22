// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { ResultChart } from './ResultChart'
import { budgetBreakdown } from '../../lib/budgetSplit'
import { CHART_MONTHS_CAP, type Projection } from '../../lib/projection'
import { DEFAULT_STATE } from '../../state/defaults'

// ResultChart's children are each tested directly (BudgetDonut.test.tsx,
// ProjectionChart.test.tsx, ProjectionTable.test.tsx); what has no coverage is
// this component's own switching — the no-projection short-circuit, the
// three-way view toggle and its heading, and the "months capped" caption.
// Projections here are hand-built rather than derived, so each branch is
// driven by exactly one field.

const CHART_TITLE = 'Savings balance over time'
const BUDGET_HEADING = 'Where your money goes'
const TABLE_HEADING = 'Month by month'
const NEW_COST_LABEL = 'Monthly saving'
const MONTHS = 36
const ACCENT = '#4ade80'

const BUDGET = budgetBreakdown({ ...DEFAULT_STATE, takeHome: '2000', housing: '800' }, 400)

/** A short saving projection; `hasOverflow` is the field the caption keys off. */
function projection(overrides: Partial<Projection> = {}): Projection {
  return {
    kind: 'save',
    points: [
      { month: 0, value: 0, dateLabel: 'September 2026' },
      { month: 1, value: 400, dateLabel: 'October 2026' },
      { month: 2, value: 800, dateLabel: 'November 2026' },
    ],
    target: 8000,
    months: MONTHS,
    hasOverflow: false,
    endLabel: 'November 2026',
    ...overrides,
  }
}

function renderChart(proj: Projection | null) {
  return render(
    <ResultChart
      projection={proj}
      budget={BUDGET}
      chartTitle={CHART_TITLE}
      accentColor={ACCENT}
      newCostLabel={NEW_COST_LABEL}
      months={MONTHS}
    />,
  )
}

const viewButton = (label: string) => screen.getByRole('button', { name: label })
/** The projection table, identified by a column heading only it renders. */
const tableIsShown = () => screen.queryByText('% of goal') !== null
/** The budget donut, identified by the legend row only it renders. */
const donutIsShown = () => screen.queryByText(NEW_COST_LABEL) !== null
const captionText = () => `Showing the first ${CHART_MONTHS_CAP} months — the full term is ${MONTHS} months.`

describe('ResultChart', () => {
  afterEach(cleanup)

  describe('with no projection to show', () => {
    it('renders the budget donut alone, with no toggle', () => {
      renderChart(null)

      expect(screen.getByText(BUDGET_HEADING)).toBeTruthy()
      expect(donutIsShown()).toBe(true)
      // The short-circuit returns before the toggle is ever mounted.
      expect(screen.queryByRole('button', { name: 'Balance' })).toBeNull()
      expect(screen.queryByRole('button', { name: 'Budget' })).toBeNull()
      expect(screen.queryByRole('button', { name: 'Table' })).toBeNull()
    })

    it('shows no capped-months caption, since there is no term to cap', () => {
      renderChart(null)

      expect(screen.queryByText(captionText())).toBeNull()
    })
  })

  describe('the view toggle', () => {
    it('opens on the balance chart, under the chart title', () => {
      const { container } = renderChart(projection())

      expect(screen.getByText(CHART_TITLE)).toBeTruthy()
      // The chart is the only SVG among the three views.
      expect(container.querySelector('svg')).toBeTruthy()
      expect(tableIsShown()).toBe(false)
    })

    it('swaps to the donut and retitles the box when "Budget" is picked', () => {
      renderChart(projection())

      fireEvent.click(viewButton('Budget'))

      expect(screen.getByText(BUDGET_HEADING)).toBeTruthy()
      expect(screen.queryByText(CHART_TITLE)).toBeNull()
      expect(donutIsShown()).toBe(true)
      expect(tableIsShown()).toBe(false)
    })

    it('swaps to the table and retitles the box when "Table" is picked', () => {
      renderChart(projection())

      fireEvent.click(viewButton('Table'))

      expect(screen.getByText(TABLE_HEADING)).toBeTruthy()
      expect(screen.queryByText(CHART_TITLE)).toBeNull()
      expect(tableIsShown()).toBe(true)
    })

    it('goes back to the chart when "Balance" is picked again', () => {
      renderChart(projection())

      fireEvent.click(viewButton('Table'))
      fireEvent.click(viewButton('Balance'))

      expect(screen.getByText(CHART_TITLE)).toBeTruthy()
      expect(tableIsShown()).toBe(false)
    })
  })

  describe('the capped-months caption', () => {
    it('is shown on the chart view for a plan that runs past the cap', () => {
      renderChart(projection({ hasOverflow: true }))

      expect(screen.getByText(captionText())).toBeTruthy()
    })

    it('stays on the table view, which is capped the same way', () => {
      renderChart(projection({ hasOverflow: true }))

      fireEvent.click(viewButton('Table'))

      expect(screen.getByText(captionText())).toBeTruthy()
    })

    it('is hidden on the budget view, which has no time axis to cap', () => {
      renderChart(projection({ hasOverflow: true }))

      fireEvent.click(viewButton('Budget'))

      expect(screen.queryByText(captionText())).toBeNull()
    })

    it('never appears for a plan that fits inside the cap', () => {
      renderChart(projection({ hasOverflow: false }))

      expect(screen.queryByText(captionText())).toBeNull()
      fireEvent.click(viewButton('Table'))
      expect(screen.queryByText(captionText())).toBeNull()
    })
  })

  it('titles the chart view with whatever the caller passed', () => {
    // The vehicle card and the finance flow both pass "Balance repaid over
    // time"; only the chart view uses it, the other two are fixed.
    render(
      <ResultChart
        projection={projection()}
        budget={BUDGET}
        chartTitle="Balance repaid over time"
        accentColor={ACCENT}
        newCostLabel="Total car cost"
        months={MONTHS}
      />,
    )

    expect(screen.getByText('Balance repaid over time')).toBeTruthy()
  })
})
