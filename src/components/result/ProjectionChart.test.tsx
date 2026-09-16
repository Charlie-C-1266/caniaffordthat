// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ProjectionChart } from './ProjectionChart'
import { savingProjection, financeProjection } from '../../lib/projection'

// The chart computes its x/y scaling inline from the projection, so these
// tests feed it real projections (built by the same lib the app uses) and
// assert on the rendered SVG output.

/** Both path `d` attributes: [0] the filled area, [1] the line on top. */
function paths(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('path')).map((p) => p.getAttribute('d') ?? '')
}

describe('ProjectionChart', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 15)) // 15 July 2026, matching projection.test.ts
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('renders a multi-point saving projection with an honest aria description', () => {
    // £250/mo reaching £1,000 in 4 months.
    const projection = savingProjection(1000, 250, 0, 4)
    const { container } = render(<ProjectionChart projection={projection} accentColor="#3fb950" />)

    const label = screen.getByRole('img').getAttribute('aria-label') ?? ''
    expect(label).toContain('£0 now')
    expect(label).toContain('climbing to £1,000')
    expect(label).toContain('November 2026') // 4 months from July 2026
    expect(label).toContain('against a £1,000 goal')
    expect(label).toContain('saved')

    const [area, line] = paths(container)
    expect(line.startsWith('M')).toBe(true)
    expect(line.split('L')).toHaveLength(5) // one segment per point, months 0..4
    expect(area.endsWith('Z')).toBe(true)
    expect(container.innerHTML).not.toContain('NaN')

    // One hover read-off strip per charted month (month 0 has no strip).
    expect(container.querySelectorAll('rect')).toHaveLength(4)
    expect(container.querySelector('title')?.textContent).toBe('August 2026: £250 saved')
  })

  it('words a finance projection as "repaid"', () => {
    const projection = financeProjection(1200, 100, 0, 12)
    render(<ProjectionChart projection={projection} accentColor="#8b8b8b" />)
    const label = screen.getByRole('img').getAttribute('aria-label') ?? ''
    expect(label).toContain('repaid')
    expect(label).toContain('climbing to £1,200')
  })

  it('renders a target === 0 projection without NaN in any coordinate', () => {
    // A zero target would divide by zero in the y() scale without its guard.
    const projection = savingProjection(0, 100, 0, 4)
    expect(projection.target).toBe(0)

    const { container } = render(<ProjectionChart projection={projection} accentColor="#3fb950" />)
    expect(container.innerHTML).not.toContain('NaN')
    for (const d of paths(container)) {
      expect(d.length).toBeGreaterThan(0)
    }
    const dot = container.querySelector('circle')
    expect(Number.isFinite(Number(dot?.getAttribute('cx')))).toBe(true)
    expect(Number.isFinite(Number(dot?.getAttribute('cy')))).toBe(true)
  })

  it('renders a single-charted-month projection without dividing by zero on the x scale', () => {
    const projection = savingProjection(1000, 1000, 0, 1)
    expect(projection.points).toHaveLength(2) // month 0 + month 1

    const { container } = render(<ProjectionChart projection={projection} accentColor="#3fb950" />)
    expect(container.innerHTML).not.toContain('NaN')
    expect(container.querySelectorAll('rect')).toHaveLength(1)
    const [, line] = paths(container)
    expect(line.split('L')).toHaveLength(2)
    const dot = container.querySelector('circle')
    expect(Number.isFinite(Number(dot?.getAttribute('cx')))).toBe(true)
  })
})
