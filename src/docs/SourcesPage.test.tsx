// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import type { HelpfulLink, Source } from '../lib/sources'

// SourcesPage reads SOURCE_LIST/HELPFUL_LINKS at render time, so the registry
// is mocked behind getters that normally pass the real data straight through.
// A test can set an override to render the page against a deliberately sparse
// registry (an entry missing its annotation, or an empty list) without
// touching lib/sources.ts itself — the data integrity of the real registry is
// covered separately by lib/sources.test.ts.
const overrides = vi.hoisted(() => ({
  sourceList: null as readonly Source[] | null,
  helpfulLinks: null as readonly HelpfulLink[] | null,
}))

vi.mock('../lib/sources', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/sources')>()
  return {
    ...actual,
    get SOURCE_LIST() {
      return overrides.sourceList ?? actual.SOURCE_LIST
    },
    get HELPFUL_LINKS() {
      return overrides.helpfulLinks ?? actual.HELPFUL_LINKS
    },
  }
})

const { SourcesPage } = await import('./SourcesPage')
const { SOURCE_LIST, HELPFUL_LINKS } = await import('../lib/sources')

afterEach(() => {
  overrides.sourceList = null
  overrides.helpfulLinks = null
  cleanup()
})

/** Every anchor pointing at another site (http/https), as opposed to a same-site path or a mailto. */
const outboundLinks = () => screen.getAllByRole('link').filter((a) => (a.getAttribute('href') ?? '').startsWith('http'))

/** Every anchor that opens a new browsing context, whatever its scheme. */
const newTabLinks = () => screen.getAllByRole('link').filter((a) => a.getAttribute('target') === '_blank')

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
  it('renders its top-level heading and the page intro', () => {
    render(<SourcesPage />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Our sources & ethos')
  })

  it('renders one external link per SOURCE_LIST entry, pointing at that entry URL', () => {
    render(<SourcesPage />)
    for (const source of SOURCE_LIST) {
      const link = screen.getByRole('link', { name: source.label })
      expect(link.getAttribute('href')).toBe(source.url)
    }
  })

  it('renders each source annotation alongside its link', () => {
    render(<SourcesPage />)
    for (const source of SOURCE_LIST) {
      expect(screen.getByText(source.usedFor), `missing usedFor for "${source.label}"`).toBeDefined()
    }
  })

  it('renders one external link per HELPFUL_LINKS entry, with its blurb', () => {
    render(<SourcesPage />)
    for (const link of HELPFUL_LINKS) {
      expect(screen.getByRole('link', { name: link.label }).getAttribute('href')).toBe(link.url)
      expect(screen.getByText(link.blurb)).toBeDefined()
    }
  })

  it('renders the contact mailto link with its prefilled subject', () => {
    render(<SourcesPage />)
    const mailtos = screen
      .getAllByRole('link')
      .map((a) => a.getAttribute('href') ?? '')
      .filter((href) => href.startsWith('mailto:'))
    expect(mailtos).toContain('mailto:hello@caniaffordthat.co.uk?subject=Helpful%20reading%20suggestion')
  })

  it('guards every outbound link with target="_blank" and rel="noopener"', () => {
    render(<SourcesPage />)
    const outbound = outboundLinks()
    // Sanity-check the filter actually found the links before asserting over
    // them — a page that rendered no links would pass an empty loop.
    expect(outbound.length).toBeGreaterThanOrEqual(SOURCE_LIST.length + HELPFUL_LINKS.length)
    for (const link of outbound) {
      expect(link.getAttribute('rel'), `${link.getAttribute('href')} is missing rel`).toContain('noopener')
      expect(link.getAttribute('target'), `${link.getAttribute('href')} does not open in a new tab`).toBe('_blank')
    }
  })

  it('guards every new-tab link with rel="noopener", whatever its scheme', () => {
    // The guard that actually matters is per-target, not per-scheme: any
    // target="_blank" anchor (the mailto suggestion link included) hands the
    // opened context a window.opener handle unless rel says otherwise.
    render(<SourcesPage />)
    const newTab = newTabLinks()
    expect(newTab.length).toBeGreaterThan(0)
    for (const link of newTab) {
      expect(link.getAttribute('rel'), `${link.getAttribute('href')} is missing rel`).toContain('noopener')
      expect(link.getAttribute('rel')).toContain('noreferrer')
    }
  })

  it('links the methodology pages as internal, same-tab links', () => {
    render(<SourcesPage />)
    const methodology = screen.getByRole('link', { name: 'How the vehicle calculator works' })
    expect(methodology.getAttribute('href')).toBe('/methodology/vehicle/')
    expect(methodology.getAttribute('target')).toBeNull()
  })

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

  it('renders a source whose annotation is missing, without dropping its link', () => {
    // `Source` has no optional fields — the nearest reachable "entry without
    // its optional field" is one whose `usedFor` annotation is blank, e.g. a
    // newly added source not yet annotated. The link must still render.
    overrides.sourceList = [{ label: 'Unannotated source', url: 'https://www.gov.uk/unannotated', usedFor: '' }]
    render(<SourcesPage />)
    const link = screen.getByRole('link', { name: 'Unannotated source' })
    expect(link.getAttribute('href')).toBe('https://www.gov.uk/unannotated')
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('renders with empty registries without throwing', () => {
    overrides.sourceList = []
    overrides.helpfulLinks = []
    render(<SourcesPage />)
    // The page's own structure survives: heading, section titles and the
    // contact link are all still there, just with no data rows.
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Our sources & ethos')
    expect(screen.getByRole('heading', { level: 2, name: 'The sources behind the numbers' })).toBeDefined()
    // Scoped to <main>: the shared Footer carries its own feedback mailto to
    // the same address, so an unscoped query would match two links.
    const main = within(screen.getByRole('main'))
    expect(main.getByRole('link', { name: 'hello@caniaffordthat.co.uk' })).toBeDefined()
  })

  it('renders the shared page header and the site footer', () => {
    render(<SourcesPage />)
    expect(screen.getByText('← Back to the calculator')).toBeDefined()
    expect(screen.getByText(/early alpha/)).toBeDefined()
  })
})
