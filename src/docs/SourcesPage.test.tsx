// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { SourcesPage } from './SourcesPage'
import { HELPFUL_LINKS, SOURCE_LIST } from '../lib/sources'

// The published methodology pages, discovered from the multi-page build's HTML
// entries (`methodology/<name>/index.html`, each served as a directory index at
// `/methodology/<name>/`) rather than hard-coded here — so publishing a page
// without listing it on the hub fails this test instead of shipping silently,
// which is exactly how the salary page went missing.
const publishedMethodologyHrefs = Object.keys(import.meta.glob('../../methodology/*/index.html')).map(
  (path) => `/methodology/${path.split('/').at(-2)}/`,
)

/** The hrefs of the links inside the "full working, per calculator" list. */
function methodologyHubHrefs() {
  const heading = screen.getByRole('heading', { name: 'The full working, per calculator' })
  const list = heading.parentElement?.querySelector('ul')
  if (!list) throw new Error('the methodology section rendered no list')
  return [...list.querySelectorAll('a')].map((anchor) => anchor.getAttribute('href'))
}

describe('SourcesPage', () => {
  afterEach(cleanup)

  it('lists every published methodology page in "The full working, per calculator"', () => {
    render(<SourcesPage />)
    // Sanity: the build really does publish more than one methodology page, so
    // the comparison below can't pass vacuously against an empty list.
    expect(publishedMethodologyHrefs.length).toBeGreaterThan(1)
    expect(methodologyHubHrefs().toSorted()).toEqual(publishedMethodologyHrefs.toSorted())
  })

  it('links the salary methodology page, not just the vehicle one', () => {
    render(<SourcesPage />)
    const hrefs = methodologyHubHrefs()
    expect(hrefs).toContain('/methodology/salary/')
    expect(hrefs).toContain('/methodology/vehicle/')
  })

  it('gives the salary entry a label and a blurb describing what the page covers', () => {
    render(<SourcesPage />)
    const salaryLink = screen.getByRole('link', { name: 'How the required-salary calculator works' })
    expect(salaryLink.getAttribute('href')).toBe('/methodology/salary/')
    // The blurb sits alongside the link in the same list item.
    expect(salaryLink.closest('li')?.textContent).toContain('take-home')
  })

  it('renders every cited source and helpful-reading link from the shared registry', () => {
    render(<SourcesPage />)
    // Guards the hub's other two lists against the same silent-drop failure.
    for (const source of SOURCE_LIST) {
      expect(screen.getByRole('link', { name: source.label }).getAttribute('href')).toBe(source.url)
    }
    for (const link of HELPFUL_LINKS) {
      expect(screen.getByRole('link', { name: link.label }).getAttribute('href')).toBe(link.url)
    }
  })
})
