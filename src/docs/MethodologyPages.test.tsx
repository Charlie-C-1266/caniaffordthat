// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import { SalaryMethodologyPage } from './SalaryMethodologyPage'
import { VehicleMethodologyPage } from './VehicleMethodologyPage'
import { SALARY_SOURCES, VEHICLE_SOURCES } from '../lib/sources'
import { fmt } from '../lib/calculations'
import { CURRENT_TAX_YEAR } from '../lib/taxYears'
import { installResizeObserver } from '../test/resizeObserver'

afterEach(cleanup)

// Every page here renders the docs' scroll containers, which observe their own
// width to decide whether they currently overflow (#314). jsdom has no
// ResizeObserver, so it is stubbed before anything renders.
beforeEach(installResizeObserver)

// These two pages are long, data-driven documents: their figures are computed
// live from lib/salary.ts and lib/vehicle.ts (so the published working can't
// drift from the code), and their citations come from lib/sources.ts. That
// makes "renders at all" a genuinely useful assertion — a bad source entry or
// a renamed export would blank a public page — and the link hygiene below is
// the part a reader's security actually depends on.

/** Every anchor pointing at another site (http/https). */
const outboundLinks = () => screen.getAllByRole('link').filter((a) => (a.getAttribute('href') ?? '').startsWith('http'))

/** Every anchor that opens a new browsing context, whatever its scheme. */
const newTabLinks = () => screen.getAllByRole('link').filter((a) => a.getAttribute('target') === '_blank')

/** The rel guard both pages must satisfy for every link that opens a new tab. */
function expectNewTabLinksGuarded(minimum: number) {
  const newTab = newTabLinks()
  expect(newTab.length).toBeGreaterThanOrEqual(minimum)
  for (const link of newTab) {
    expect(link.getAttribute('rel'), `${link.getAttribute('href')} is missing rel`).toContain('noopener')
    expect(link.getAttribute('rel')).toContain('noreferrer')
  }
}

/**
 * Every table on a docs page exposes each body row's name as a row header.
 *
 * The docs tables are all DataTable, whose first column is the row's name —
 * since #285 marked up as `<th scope="row">` rather than a styled `<td>`, so a
 * screen reader reads a row's name alongside each of its values (WCAG 1.3.1).
 * Asserted per table rather than page-wide, so a single table losing its row
 * headers can't hide behind the others.
 */
function expectEveryTableHasRowHeaders(atLeastTables: number) {
  const tables = screen.getAllByRole('table')
  // A floor rather than an exact count: it stops the loop below passing
  // vacuously without needing an edit every time a page gains a table.
  expect(tables.length).toBeGreaterThanOrEqual(atLeastTables)

  for (const table of tables) {
    const scope = within(table)
    const bodyRows = Array.from(table.querySelectorAll('tbody tr'))
    expect(bodyRows.length, 'the table has body rows to name').toBeGreaterThan(0)

    // One row header per body row, each scoped to its row and non-empty.
    const rowHeaders = scope.getAllByRole('rowheader')
    expect(rowHeaders).toHaveLength(bodyRows.length)
    for (const rowHeader of rowHeaders) {
      expect(rowHeader.getAttribute('scope')).toBe('row')
      expect(rowHeader.textContent?.trim()).not.toBe('')
    }

    // And the column headers are scoped too.
    for (const columnHeader of scope.getAllByRole('columnheader')) {
      expect(columnHeader.getAttribute('scope')).toBe('col')
    }
  }
}

describe('SalaryMethodologyPage', () => {
  it('renders without throwing and exposes its top-level heading', () => {
    render(<SalaryMethodologyPage />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('How the “what salary would I need?” flip works')
  })

  it('cites every salary source, each pointing at that source URL', () => {
    render(<SalaryMethodologyPage />)
    for (const source of SALARY_SOURCES) {
      expect(screen.getByRole('link', { name: source.label }).getAttribute('href')).toBe(source.url)
    }
  })

  it('publishes the tax year its figures are computed for', () => {
    // The page's whole claim is "this is the working, for this tax year" — a
    // page stating a stale year would be worse than one stating none.
    render(<SalaryMethodologyPage />)
    expect(screen.getAllByText((_, el) => el?.textContent?.includes(CURRENT_TAX_YEAR.label) === true).length).toBeGreaterThan(0)
  })

  it('guards every outbound link with target="_blank" and rel="noopener"', () => {
    render(<SalaryMethodologyPage />)
    const outbound = outboundLinks()
    expect(outbound.length).toBeGreaterThanOrEqual(SALARY_SOURCES.length)
    for (const link of outbound) {
      expect(link.getAttribute('rel'), `${link.getAttribute('href')} is missing rel`).toContain('noopener')
      expect(link.getAttribute('target')).toBe('_blank')
    }
    expectNewTabLinksGuarded(SALARY_SOURCES.length)
  })

  it('renders the shared header and footer, and keeps internal links same-tab', () => {
    render(<SalaryMethodologyPage />)
    expect(screen.getByText('← Back to the calculator')).toBeDefined()
    expect(screen.getByText(/early alpha/)).toBeDefined()
    for (const link of screen.getAllByRole('link').filter((a) => (a.getAttribute('href') ?? '').startsWith('/'))) {
      expect(link.getAttribute('target')).toBeNull()
    }
  })

  it('publishes the student loan thresholds, a worked repayment, and when the figures were last checked', () => {
    render(<SalaryMethodologyPage />)
    expect(screen.getByRole('heading', { name: 'Student loans' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Workplace pensions' })).toBeTruthy()
    for (const [plan, terms] of Object.entries(CURRENT_TAX_YEAR.studentLoanPlans)) {
      // Since #285 the plan name is the row's header, not a plain cell.
      const row = screen.getByRole('rowheader', { name: `Plan ${plan.slice(-1)}` }).closest('tr')
      expect(row?.textContent, `${plan} row`).toContain(fmt(terms.threshold))
    }
    // Plan 2 at £35,000: 9% of £5,615.
    expect(screen.getByText('£42.11')).toBeTruthy()
    expect(screen.getByText('13 November 2026')).toBeTruthy()
  })

  it('renders its sections and data tables rather than an empty shell', () => {
    render(<SalaryMethodologyPage />)
    expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('table').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('columnheader').length).toBeGreaterThan(0)
  })

  it('names every body row of every table, "Model limitations" included', () => {
    render(<SalaryMethodologyPage />)
    // The page's own tables plus the shared "Model limitations" table.
    expectEveryTableHasRowHeaders(4)
    // The limitations table's simplifications are what a reader needs for the
    // "What it means for you" column to make sense.
    const limitations = screen.getAllByRole('table').at(-1)
    expect(limitations).toBeDefined()
    expect(within(limitations as HTMLElement).getAllByRole('rowheader').length).toBeGreaterThan(0)
  })
})

describe('VehicleMethodologyPage', () => {
  it('renders without throwing and exposes its top-level heading', () => {
    render(<VehicleMethodologyPage />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('How the vehicle calculator works')
  })

  it('cites every vehicle source, each pointing at that source URL', () => {
    render(<VehicleMethodologyPage />)
    for (const source of VEHICLE_SOURCES) {
      expect(screen.getByRole('link', { name: source.label }).getAttribute('href')).toBe(source.url)
    }
  })

  it('guards every outbound link with target="_blank" and rel="noopener"', () => {
    render(<VehicleMethodologyPage />)
    const outbound = outboundLinks()
    expect(outbound.length).toBeGreaterThanOrEqual(VEHICLE_SOURCES.length)
    for (const link of outbound) {
      expect(link.getAttribute('rel'), `${link.getAttribute('href')} is missing rel`).toContain('noopener')
      expect(link.getAttribute('target')).toBe('_blank')
    }
    expectNewTabLinksGuarded(VEHICLE_SOURCES.length)
  })

  it('renders the depreciation chart with its accessible description', () => {
    render(<VehicleMethodologyPage />)
    expect(screen.getByRole('img', { name: /depreciation curve/i })).toBeDefined()
  })

  it('renders the shared header with the finance accent, and the footer', () => {
    const { container } = render(<VehicleMethodologyPage />)
    expect(container.querySelector('header span')?.getAttribute('style')).toContain('var(--accent-finance)')
    expect(screen.getByText('← Back to the calculator')).toBeDefined()
    expect(screen.getByText(/early alpha/)).toBeDefined()
  })

  it('renders its sections and data tables rather than an empty shell', () => {
    render(<VehicleMethodologyPage />)
    expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('table').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('columnheader').length).toBeGreaterThan(0)
  })

  it('names every body row of every table, "Model limitations" included', () => {
    render(<VehicleMethodologyPage />)
    // The page's own tables plus the shared "Model limitations" table.
    expectEveryTableHasRowHeaders(7)
    expect(screen.getAllByRole('rowheader').length).toBeGreaterThan(0)
  })

  it('makes a non-string first cell a row header', () => {
    // The depreciation table's first column is `<>Up to {pct(...)}</>`, not a
    // string, so this is the one page where that path is exercised for real.
    render(<VehicleMethodologyPage />)
    const rowHeaders = screen.getAllByRole('rowheader')
    expect(rowHeaders.some((th) => (th.textContent ?? '').startsWith('Up to'))).toBe(true)
  })
})
