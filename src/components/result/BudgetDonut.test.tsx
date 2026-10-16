// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { BudgetDonut } from './BudgetDonut'
import { budgetBreakdown } from '../../lib/budgetSplit'
import { DEFAULT_STATE } from '../../state/defaults'
import type { CalculatorState } from '../../state/types'

// The donut computes its arc geometry inline from the breakdown, so these
// tests build real breakdowns via budgetBreakdown and assert on the rendered
// SVG rather than any implementation detail.

const CIRCUMFERENCE = 2 * Math.PI * 60 // must match RADIUS in BudgetDonut
const GAP = 2

function makeState(overrides: Partial<CalculatorState>): CalculatorState {
  return { ...DEFAULT_STATE, ...overrides }
}

/** Every circle's dash geometry, parsed back out of the rendered SVG. */
function arcGeometry(container: HTMLElement) {
  return Array.from(container.querySelectorAll('circle')).map((circle) => ({
    drawn: Number(circle.getAttribute('stroke-dasharray')?.split(' ')[0]),
    rest: Number(circle.getAttribute('stroke-dasharray')?.split(' ')[1]),
    offset: Number(circle.getAttribute('stroke-dashoffset')),
  }))
}

describe('BudgetDonut', () => {
  afterEach(cleanup)

  it('draws arcs that sum to the ring and legend amounts that match the budget (in-budget case)', () => {
    // £2,000 take-home, £800 + £300 essentials, £200 new cost -> £700 left over.
    const budget = budgetBreakdown(makeState({ takeHome: '2000', housing: '800', groceries: '300' }), 200)
    const { container } = render(<BudgetDonut budget={budget} newCostLabel="Monthly saving" />)

    // Four arcs: housing, groceries, the new cost (fits entirely), leftover.
    const arcs = arcGeometry(container)
    expect(arcs).toHaveLength(4)
    for (const arc of arcs) {
      expect(Number.isFinite(arc.drawn)).toBe(true)
      expect(Number.isFinite(arc.rest)).toBe(true)
      expect(Number.isFinite(arc.offset)).toBe(true)
    }
    // Each arc gives up GAP of surface gap; together they cover the ring.
    const covered = arcs.reduce((sum, arc) => sum + arc.drawn, 0)
    expect(covered).toBeCloseTo(CIRCUMFERENCE - arcs.length * GAP, 6)

    // Legend rows carry the budget's own figures.
    expect(screen.getByText('Housing')).toBeTruthy()
    expect(screen.getByText('£800')).toBeTruthy()
    expect(screen.getByText('Groceries')).toBeTruthy()
    expect(screen.getByText('£300')).toBeTruthy()
    expect(screen.getByText('Monthly saving')).toBeTruthy()
    expect(screen.getByText('£200')).toBeTruthy()
    expect(screen.getByText('Left over')).toBeTruthy()
    expect(screen.getByText('£700')).toBeTruthy()

    // Centre read-out: £200 of £2,000 take-home = 10%.
    expect(screen.getByText('10%')).toBeTruthy()
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('£700 left over')
  })

  it('shows the overspend as its own red arc and legend row when the new cost exceeds spare cash', () => {
    // £900 spare cash against a £1,250 new cost -> £350 over.
    const budget = budgetBreakdown(makeState({ takeHome: '2000', housing: '800', groceries: '300' }), 1250)
    expect(budget.overBudget).toBe(true)
    expect(budget.newCostOver).toBe(350)

    const { container } = render(<BudgetDonut budget={budget} newCostLabel="Monthly payment" />)

    // Arcs: housing, groceries, the fitted £900, the £350 overspend — no leftover.
    const circles = Array.from(container.querySelectorAll('circle'))
    expect(circles).toHaveLength(4)
    expect(circles.some((c) => c.getAttribute('stroke') === 'var(--chart-over)')).toBe(true)

    expect(screen.getByText('Over spare cash')).toBeTruthy()
    expect(screen.getByText('£350')).toBeTruthy()
    expect(screen.queryByText('Left over')).toBeNull()
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('£350 over your spare cash')
  })

  it('gives regular saving its own arc, legend row and mention in the description', () => {
    // £2,000 take-home, £800 housing, £300/month already saved, £200 new cost
    // -> £700 left over. Saving is drawn apart from the essentials ramp.
    const budget = budgetBreakdown(makeState({ takeHome: '2000', housing: '800', savingsMonthly: '300' }), 200)
    const { container } = render(<BudgetDonut budget={budget} newCostLabel="Monthly saving" />)

    // Housing, saving, the new cost, leftover.
    expect(arcGeometry(container)).toHaveLength(4)
    expect(container.querySelector('circle[stroke="var(--chart-saving)"]')).not.toBeNull()
    expect(screen.getByText('Saving')).toBeTruthy()
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('£300 into savings')
  })

  it('leaves saving out entirely when the user saves nothing', () => {
    const budget = budgetBreakdown(makeState({ takeHome: '2000', housing: '800' }), 200)
    const { container } = render(<BudgetDonut budget={budget} newCostLabel="Monthly saving" />)

    expect(container.querySelector('circle[stroke="var(--chart-saving)"]')).toBeNull()
    expect(screen.queryByText('Saving')).toBeNull()
    expect(screen.getByRole('img').getAttribute('aria-label')).not.toContain('into savings')
  })

  it('renders the ringTotal === 0 edge case without NaN or Infinity anywhere', () => {
    // Everything blank: no take-home, no essentials, no new cost.
    const budget = budgetBreakdown(makeState({}), 0)
    expect(budget.ringTotal).toBe(0)

    const { container } = render(<BudgetDonut budget={budget} newCostLabel="Monthly saving" />)

    // No throw above, and whatever was drawn contains finite geometry only.
    for (const arc of arcGeometry(container)) {
      expect(Number.isFinite(arc.drawn)).toBe(true)
      expect(Number.isFinite(arc.rest)).toBe(true)
      expect(Number.isFinite(arc.offset)).toBe(true)
    }
    expect(container.innerHTML).not.toContain('NaN')
    expect(container.innerHTML).not.toContain('Infinity')
    expect(screen.getByText('0%')).toBeTruthy()
    // The reason that holds: with nothing to show, there are no arcs to
    // divide by the (zero) ring total in the first place.
    expect(container.querySelectorAll('circle')).toHaveLength(0)
  })

  it('never draws an arc against a zero ring total — the invariant the arc geometry relies on', () => {
    // An arc only exists when its own amount is positive, and every arc's
    // amount is part of ringTotal, so any budget that draws something has a
    // positive ring. Checked across the awkward shapes: nothing at all, only
    // essentials, only a new cost, a new cost that overshoots, negative and
    // non-numeric field values, and a very large one.
    const cases: [Partial<CalculatorState>, number][] = [
      [{}, 0],
      [{ takeHome: '0' }, 0],
      [{ takeHome: '', housing: '' }, 0],
      [{ takeHome: '-500', housing: '-200' }, 0],
      [{ takeHome: 'abc', housing: 'abc' }, 0],
      [{ takeHome: '0', housing: '0' }, -50],
      [{ takeHome: '2000' }, 0],
      [{ takeHome: '0', housing: '800' }, 0],
      [{ takeHome: '0' }, 300],
      [{ takeHome: '1000' }, 2500],
      [{ takeHome: '1000000', housing: '250000' }, 500000],
    ]

    // Observations are collected first and asserted once, so a failure names
    // the case that broke rather than stopping at an assertion in a branch.
    const observed = cases.map(([overrides, newCost]) => {
      const budget = budgetBreakdown(makeState(overrides), newCost)
      const { container, unmount } = render(<BudgetDonut budget={budget} newCostLabel="Monthly saving" />)
      const summary = {
        label: `${JSON.stringify(overrides)} + ${newCost}`,
        arcs: container.querySelectorAll('circle').length,
        ringTotal: budget.ringTotal,
        finiteGeometry: arcGeometry(container).every(
          (arc) => Number.isFinite(arc.drawn) && Number.isFinite(arc.rest) && Number.isFinite(arc.offset),
        ),
        cleanMarkup: !container.innerHTML.includes('NaN') && !container.innerHTML.includes('Infinity'),
      }
      unmount()
      return summary
    })

    expect(observed.filter((o) => o.arcs > 0 && o.ringTotal <= 0)).toEqual([])
    expect(observed.filter((o) => o.arcs === 0 && o.ringTotal !== 0)).toEqual([])
    expect(observed.filter((o) => !o.finiteGeometry || !o.cleanMarkup)).toEqual([])
    // And the set does exercise both sides: some cases draw, some don't.
    expect(observed.some((o) => o.arcs > 0)).toBe(true)
    expect(observed.some((o) => o.arcs === 0)).toBe(true)
  })
})
