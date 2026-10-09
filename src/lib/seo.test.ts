// @vitest-environment node
// Guards the repo's own crawl surface — the four HTML entry points, their
// canonical tags, public/sitemap.xml and public/robots.txt — rather than a
// module, so there is no seo.ts to go with it. Node environment (not jsdom)
// because vite.config.ts resolves its HTML entries via import.meta.url, which
// is only a file: URL here; jsdom rewrites it to http and the import throws.
// jsdom is driven directly instead, for real HTML and XML parsing.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import { describe, it, expect } from 'vitest'
import viteConfig from '../../vite.config'

/** Every public URL must be absolute and sit under this origin — it's what each page already declares as its og:url. */
const SITE_ORIGIN = 'https://caniaffordthat.co.uk'

const { window } = new JSDOM()

function parse(source: string, type: DOMParserSupportedType) {
  return new window.DOMParser().parseFromString(source, type)
}

/** Hrefs of every `<link rel="canonical">`, in document order. Plural on purpose: a duplicated tag has to fail loudly rather than be silently ignored. */
function canonicalHrefs(html: string): string[] {
  return [...parse(html, 'text/html').querySelectorAll('link[rel="canonical"]')].map((link) => link.getAttribute('href') ?? '')
}

/** The page's og:url, or '' when it has none. */
function ogUrl(html: string): string {
  return parse(html, 'text/html').querySelector('meta[property="og:url"]')?.getAttribute('content') ?? ''
}

/** The sitemap's `<loc>` values. Throws on XML that isn't well formed, so a malformed sitemap fails rather than reading as an empty one. */
function sitemapLocs(xml: string): string[] {
  const doc = parse(xml, 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('sitemap.xml is not well-formed XML')
  return [...doc.querySelectorAll('urlset > url > loc')].map((node) => node.textContent?.trim() ?? '')
}

/** Everything wrong with one page's canonical/og:url pair; empty means the page is sound. */
function canonicalProblems(html: string): string[] {
  const problems: string[] = []
  const hrefs = canonicalHrefs(html)
  const og = ogUrl(html)

  if (hrefs.length !== 1) problems.push(`expected exactly 1 canonical tag, found ${hrefs.length}`)
  if (!og) problems.push('no og:url')
  if (hrefs.length === 1 && og && hrefs[0] !== og) problems.push(`canonical ${hrefs[0]} differs from og:url ${og}`)

  // Shape rules applied to both, so a bad og:url can't quietly drag a
  // matching canonical along with it.
  for (const [label, url] of [
    ['canonical', hrefs[0] ?? ''],
    ['og:url', og],
  ] as const) {
    if (!url) continue
    if (!url.startsWith(`${SITE_ORIGIN}/`)) problems.push(`${label} ${url} is not absolute under ${SITE_ORIGIN}`)
    if (url.includes('?') || url.includes('#')) problems.push(`${label} ${url} carries a query string or fragment`)
    if (!url.endsWith('/')) problems.push(`${label} ${url} has no trailing slash`)
  }

  return problems
}

/** Everything wrong with the sitemap, given the canonical URLs it is meant to list exactly. */
function sitemapProblems(xml: string, canonicals: string[]): string[] {
  let locs: string[]
  try {
    locs = sitemapLocs(xml)
  } catch (error) {
    return [(error as Error).message]
  }

  const listed = new Set(locs)
  const expected = new Set(canonicals)

  const problems: string[] = []
  if (locs.length === 0) problems.push('sitemap lists no URLs')
  if (listed.size !== locs.length) problems.push('sitemap lists the same URL twice')
  for (const url of locs) if (!expected.has(url)) problems.push(`sitemap lists ${url}, which is no page's canonical URL`)
  for (const url of canonicals) if (!listed.has(url)) problems.push(`sitemap is missing ${url}`)
  return problems
}

/** Everything wrong with robots.txt; empty means it allows crawling and points at the sitemap. */
function robotsProblems(txt: string): string[] {
  const lines = new Set(txt.split('\n').map((line) => line.trim()))
  const problems: string[] = []
  if (!lines.has('User-agent: *')) problems.push('no "User-agent: *" group')
  if (!lines.has('Allow: /')) problems.push('does not allow crawling')
  if (lines.has('Disallow: /')) problems.push('blanket-disallows the whole site')
  if (!lines.has(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`)) problems.push('no Sitemap: line pointing at the sitemap')
  return problems
}

/** The HTML entries Vite actually builds, read straight off the config so a new page can't bypass these checks. */
function htmlEntries(): [name: string, html: string][] {
  const input = viteConfig.build?.rollupOptions?.input
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('vite.config.ts declares no named HTML entries')
  return Object.entries(input).map(([name, path]) => [name, readFileSync(path, 'utf8')])
}

function readPublicFile(name: string): string {
  return readFileSync(fileURLToPath(new URL(`../../public/${name}`, import.meta.url)), 'utf8')
}

// Fixture builders for the self-checks at the bottom of this file: the
// smallest page and sitemap shapes the guards above have to judge.
const pageFixture = (head: string) => `<!doctype html><html lang="en"><head>${head}</head><body></body></html>`
const canonicalTag = (href: string) => `<link rel="canonical" href="${href}" />`
const ogUrlTag = (content: string) => `<meta property="og:url" content="${content}" />`
const sitemapFixture = (body: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`
const locEntry = (url: string) => `<url><loc>${url}</loc></url>`

describe('canonical tags on the HTML entry points', () => {
  const entries = htmlEntries()

  it('finds every entry Vite builds', () => {
    expect(entries.map(([name]) => name)).toEqual(['main', 'vehicleMethodology', 'salaryMethodology', 'sourcesEthos'])
  })

  it.each(entries)('%s declares exactly one canonical, equal to its og:url', (_name, html) => {
    expect(canonicalProblems(html)).toEqual([])
  })
})

describe('sitemap.xml and robots.txt', () => {
  // A page with no canonical reports as such rather than as `undefined`.
  const canonicals = htmlEntries().map(([, html]) => canonicalHrefs(html)[0] ?? '(page has no canonical tag)')

  it('lists every page once and nothing else', () => {
    expect(sitemapProblems(readPublicFile('sitemap.xml'), canonicals)).toEqual([])
  })

  it('allows crawling and points at the sitemap', () => {
    expect(robotsProblems(readPublicFile('robots.txt'))).toEqual([])
  })

  it('ships both files from public/, which Vite copies verbatim into dist/', () => {
    expect(readPublicFile('robots.txt')).toContain('Sitemap:')
    expect(readPublicFile('sitemap.xml')).toContain('<urlset')
  })
})

// The checks above are only worth anything if they actually reject the
// mistakes they describe, so each failure mode is pinned against a fixture.
describe('the checks reject the mistakes they are meant to catch', () => {
  const sound = pageFixture(canonicalTag(`${SITE_ORIGIN}/sources/`) + ogUrlTag(`${SITE_ORIGIN}/sources/`))

  it('accepts a sound page', () => {
    expect(canonicalProblems(sound)).toEqual([])
  })

  it('rejects a page with no canonical tag', () => {
    expect(canonicalProblems(pageFixture(ogUrlTag(`${SITE_ORIGIN}/sources/`)))).toContain('expected exactly 1 canonical tag, found 0')
  })

  it('rejects a page with duplicate canonical tags', () => {
    const html = pageFixture(
      canonicalTag(`${SITE_ORIGIN}/sources/`) + canonicalTag(`${SITE_ORIGIN}/sources/`) + ogUrlTag(`${SITE_ORIGIN}/sources/`),
    )
    expect(canonicalProblems(html)).toContain('expected exactly 1 canonical tag, found 2')
  })

  it('rejects a page whose canonical differs from its og:url', () => {
    const html = pageFixture(canonicalTag(`${SITE_ORIGIN}/sources/`) + ogUrlTag(`${SITE_ORIGIN}/methodology/salary/`))
    expect(canonicalProblems(html)).toContain(`canonical ${SITE_ORIGIN}/sources/ differs from og:url ${SITE_ORIGIN}/methodology/salary/`)
  })

  it('rejects a trailing-slash mismatch between canonical and og:url', () => {
    const html = pageFixture(canonicalTag(`${SITE_ORIGIN}/sources`) + ogUrlTag(`${SITE_ORIGIN}/sources/`))
    expect(canonicalProblems(html)).toContain(`canonical ${SITE_ORIGIN}/sources has no trailing slash`)
  })

  it('rejects an og:url carrying a query string', () => {
    // A shared result link, which is exactly the URL shape a canonical must
    // never be. It trips the trailing-slash rule too, so assert on the
    // query-string problems rather than the whole list.
    const withQuery = `${SITE_ORIGIN}/?kind=save&price=1200`
    const problems = canonicalProblems(pageFixture(canonicalTag(withQuery) + ogUrlTag(withQuery)))
    expect(problems).toContain(`canonical ${withQuery} carries a query string or fragment`)
    expect(problems).toContain(`og:url ${withQuery} carries a query string or fragment`)
  })

  it('rejects a relative or off-origin canonical', () => {
    const html = pageFixture(canonicalTag('/sources/') + ogUrlTag('/sources/'))
    expect(canonicalProblems(html)).toContain(`canonical /sources/ is not absolute under ${SITE_ORIGIN}`)
  })

  it('rejects a page with no og:url', () => {
    expect(canonicalProblems(pageFixture(canonicalTag(`${SITE_ORIGIN}/sources/`)))).toContain('no og:url')
  })

  const twoPages = [`${SITE_ORIGIN}/`, `${SITE_ORIGIN}/sources/`]

  it('accepts a sitemap matching the pages exactly', () => {
    expect(sitemapProblems(sitemapFixture(twoPages.map(locEntry).join('')), twoPages)).toEqual([])
  })

  it('rejects an empty sitemap', () => {
    expect(sitemapProblems(sitemapFixture(''), twoPages)).toContain('sitemap lists no URLs')
  })

  it('rejects a sitemap missing a page', () => {
    expect(sitemapProblems(sitemapFixture(locEntry(twoPages[0])), twoPages)).toEqual([`sitemap is missing ${SITE_ORIGIN}/sources/`])
  })

  it('rejects a sitemap listing a URL no page claims', () => {
    const stray = `${SITE_ORIGIN}/methodology/`
    expect(sitemapProblems(sitemapFixture([...twoPages, stray].map(locEntry).join('')), twoPages)).toEqual([
      `sitemap lists ${stray}, which is no page's canonical URL`,
    ])
  })

  it('rejects a sitemap listing the same URL twice', () => {
    expect(sitemapProblems(sitemapFixture([...twoPages, twoPages[0]].map(locEntry).join('')), twoPages)).toContain(
      'sitemap lists the same URL twice',
    )
  })

  it('rejects malformed XML instead of reading it as empty', () => {
    const malformed = `<?xml version="1.0" encoding="UTF-8"?><urlset>${locEntry(twoPages[0])}`
    expect(sitemapProblems(malformed, twoPages)).toEqual(['sitemap.xml is not well-formed XML'])
  })

  it('rejects robots.txt without the sitemap line, and a blanket disallow', () => {
    expect(robotsProblems('User-agent: *\nAllow: /\n')).toEqual(['no Sitemap: line pointing at the sitemap'])
    expect(robotsProblems(`User-agent: *\nDisallow: /\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`)).toEqual([
      'does not allow crawling',
      'blanket-disallows the whole site',
    ])
  })
})
