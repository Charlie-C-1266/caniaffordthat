// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { DepreciationChart } from './DepreciationChart'
import { retentionCurve } from './curve'
import { UK_AVERAGE_ANNUAL_MILES } from '../lib/vehicle'

// The chart maps retentionCurve() points into viewBox coordinates inline, so
// these tests assert on the rendered SVG/DOM — the path commands, the axis
// labels and the legend — rather than reaching for x()/y()/pathFor() directly.

/** The plotted series' `d` attributes, in render order. */
function seriesPaths(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('path')).map((path) => path.getAttribute('d') ?? '')
}

describe('DepreciationChart', () => {
  afterEach(cleanup)

  it('draws one polyline per mileage profile, each starting with M and continuing with L', () => {
    const { container } = render(<DepreciationChart />)

    // Three profiles: 4,000 / UK-average / 16,000 miles a year.
    const paths = seriesPaths(container)
    expect(paths).toHaveLength(3)

    // retentionCurve's default 0.5-year step over 10 years gives 21 points, so
    // each path is one M command followed by 20 L commands.
    const expectedPoints = retentionCurve(UK_AVERAGE_ANNUAL_MILES, 10).length
    expect(expectedPoints).toBe(21)

    for (const d of paths) {
      expect(d).not.toBe('')
      expect(d.startsWith('M')).toBe(true)
      const commands = d.split(' ')
      expect(commands).toHaveLength(expectedPoints)
      expect(commands.filter((c) => c.startsWith('L'))).toHaveLength(expectedPoints - 1)
      // Every command carries a finite "x,y" pair inside the viewBox.
      for (const command of commands) {
        const [cx, cy] = command.slice(1).split(',').map(Number)
        expect(Number.isFinite(cx)).toBe(true)
        expect(Number.isFinite(cy)).toBe(true)
        expect(cx).toBeGreaterThanOrEqual(0)
        expect(cx).toBeLessThanOrEqual(640)
        expect(cy).toBeGreaterThanOrEqual(0)
        expect(cy).toBeLessThanOrEqual(340)
      }
    }
    expect(container.innerHTML).not.toContain('NaN')

    // All three start at 100% retained (same y), and higher mileage ends lower
    // down the chart (a larger y) after ten years.
    const firstY = paths.map((d) => Number(d.split(' ')[0].split(',')[1]))
    expect(firstY[0]).toBeCloseTo(firstY[1], 6)
    expect(firstY[1]).toBeCloseTo(firstY[2], 6)
    const lastY = paths.map((d) => Number(d.split(' ').at(-1)!.split(',')[1]))
    expect(lastY[0]).toBeLessThan(lastY[1])
    expect(lastY[1]).toBeLessThan(lastY[2])

    // Each curve spans the plot the gridlines mark out: age 0 on its left
    // edge, ten years on its right. The gridlines' ends don't go through x()
    // (the year ticks do), so a flipped or squashed age axis can't shift both
    // together — and the in-bounds checks above would pass either way.
    const gridline = container.querySelector('line')!
    const plotLeft = Number(gridline.getAttribute('x1'))
    const plotRight = Number(gridline.getAttribute('x2'))
    expect(plotRight).toBeGreaterThan(plotLeft)
    for (const d of paths) {
      const xs = d.split(' ').map((command) => Number(command.slice(1).split(',')[0]))
      expect(xs[0]).toBeCloseTo(plotLeft, 1)
      expect(xs.at(-1)).toBeCloseTo(plotRight, 1)
    }
  })

  it('labels the retention gridlines and the age axis ticks', () => {
    render(<DepreciationChart />)

    for (const pct of [0, 25, 50, 75, 100]) {
      expect(screen.getByText(`${pct}%`)).toBeTruthy()
    }

    // Year 0 reads "New"; the rest are even-year ticks up to ten.
    expect(screen.getByText('New')).toBeTruthy()
    for (const year of [2, 4, 6, 8, 10]) {
      expect(screen.getByText(`${year} yrs`)).toBeTruthy()
    }
    expect(screen.getByText('Age of car')).toBeTruthy()
  })

  it('renders a legend entry for each series, including the localised UK-average label', () => {
    const { container } = render(<DepreciationChart />)

    const legend = container.querySelector('figcaption')
    expect(legend).toBeTruthy()
    expect(legend!.querySelectorAll(':scope > span')).toHaveLength(3)

    expect(screen.getByText('4,000 miles/year')).toBeTruthy()
    expect(screen.getByText(`${UK_AVERAGE_ANNUAL_MILES.toLocaleString('en-GB')} miles/year (UK average)`)).toBeTruthy()
    expect(screen.getByText('16,000 miles/year')).toBeTruthy()

    // The chart itself stays a single labelled image for screen readers.
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('depreciation curve')
  })
})
