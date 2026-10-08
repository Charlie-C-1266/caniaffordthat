// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import { ProjectionTable } from './ProjectionTable'
import type { Projection, ProjectionPoint } from '../../lib/projection'

// The table is a pure read-off of the projection it's handed, so these tests
// build small Projection objects by hand rather than going through
// derive/vehicle — that keeps each case's value/target pair obvious, which is
// the whole point of the "% of goal" assertions below.

function point(month: number, value: number): ProjectionPoint {
  return { month, value, dateLabel: month === 0 ? 'July 2026' : `Month ${month} 2026` }
}

function projectionOf(overrides: Partial<Projection> = {}): Projection {
  return {
    kind: 'save',
    points: [point(0, 0), point(1, 250), point(2, 500)],
    target: 1000,
    months: 4,
    hasOverflow: false,
    endLabel: 'November 2026',
    ...overrides,
  }
}

/** Every body row as `[month, date, value, % of goal]`, read back out of the rendered table. */
function rows(): string[][] {
  // Row 0 is the header row; the rest are the projection's points.
  return screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => {
      const scoped = within(row)
      const cells = [scoped.getByRole('rowheader')].concat(scoped.getAllByRole('cell'))
      return cells.map((cell) => cell.textContent ?? '')
    })
}

describe('ProjectionTable', () => {
  afterEach(cleanup)

  it('renders a saving projection with a "Saved" column, "Now" for month 0, and rounded percentages', () => {
    render(<ProjectionTable projection={projectionOf()} />)

    expect(screen.getByRole('columnheader', { name: 'Saved' })).toBeTruthy()
    expect(screen.queryByRole('columnheader', { name: 'Repaid' })).toBeNull()

    // £0 / £250 / £500 against a £1,000 target -> 0% / 25% / 50%.
    expect(rows()).toEqual([
      ['Now', 'July 2026', '£0', '0%'],
      ['1', 'Month 1 2026', '£250', '25%'],
      ['2', 'Month 2 2026', '£500', '50%'],
    ])
  })

  it('rounds a fractional percentage rather than truncating it', () => {
    // 333/1000 rounds up to 33%, 666/1000 to 67% — a floor would give 66%.
    render(<ProjectionTable projection={projectionOf({ points: [point(0, 0), point(1, 333), point(2, 666)] })} />)

    expect(rows().map((row) => row[3])).toEqual(['0%', '33%', '67%'])
  })

  it('words a finance projection as "Repaid"', () => {
    render(<ProjectionTable projection={projectionOf({ kind: 'finance', points: [point(0, 0), point(1, 100)], target: 1200 })} />)

    expect(screen.getByRole('columnheader', { name: 'Repaid' })).toBeTruthy()
    expect(screen.queryByRole('columnheader', { name: 'Saved' })).toBeNull()
  })

  // A 0 target is unreachable from derive.ts/vehicle.ts (both only build a
  // projection for a target above 0 — see the comment at the guard), so it's
  // pinned down by rendering one directly rather than via a "realistic" scenario.
  it('renders 0% for every row when the target is 0, rather than NaN or Infinity', () => {
    // target === 0 would make value/target NaN (at month 0) or Infinity
    // (thereafter) without the guard on the "% of goal" cell.
    const { container } = render(<ProjectionTable projection={projectionOf({ target: 0 })} />)

    expect(rows().map((row) => row[3])).toEqual(['0%', '0%', '0%'])
    expect(container.innerHTML).not.toContain('NaN')
    expect(container.innerHTML).not.toContain('Infinity')
  })
})
