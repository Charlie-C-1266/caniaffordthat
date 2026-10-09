// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { SalaryMethodologyPage } from './SalaryMethodologyPage'
import { VehicleMethodologyPage } from './VehicleMethodologyPage'
import { SALARY_SOURCES, VEHICLE_SOURCES } from '../lib/sources'
import { CURRENT_TAX_YEAR } from '../lib/taxYears'

afterEach(cleanup)

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

  it('renders its sections and data tables rather than an empty shell', () => {
    render(<SalaryMethodologyPage />)
    expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('table').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('columnheader').length).toBeGreaterThan(0)
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
})
