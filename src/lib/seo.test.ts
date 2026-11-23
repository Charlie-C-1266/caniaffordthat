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

/**
 * The three description tags every entry point must carry exactly once, each with the selector that finds it.
 * `description` feeds search results; `og:description` and `twitter:description` feed link previews (Slack, iMessage, social).
 */
const DESCRIPTION_TAGS = [
  ['description', 'meta[name="description"]'],
  ['og:description', 'meta[property="og:description"]'],
  ['twitter:description', 'meta[name="twitter:description"]'],
] as const

/** Google truncates a search snippet past roughly this many characters, so anything longer is wasted wording. */
const MAX_DESCRIPTION_LENGTH = 160

/** Fragments that only appear when a template was never filled in: a leftover `%placeholder%`, a `{{ moustache }}`, or a TODO. */
const UNEXPANDED_MARKERS = ['%', '{{', 'TODO']

/** Everything wrong with one page's description tags; empty means the page is sound. Every message names the page and the tag. */
function descriptionProblems(page: string, html: string): string[] {
  const doc = parse(html, 'text/html')
  const problems: string[] = []

  for (const [label, selector] of DESCRIPTION_TAGS) {
    const tags = [...doc.querySelectorAll(selector)]
    if (tags.length !== 1) {
      problems.push(`${page}: expected exactly 1 ${label} tag, found ${tags.length}`)
      continue
    }

    // A tag with no `content` attribute at all reads the same as `content=""`.
    const content = tags[0].getAttribute('content') ?? ''
    if (!content.trim()) {
      problems.push(`${page}: ${label} is empty`)
      continue
    }

    for (const marker of UNEXPANDED_MARKERS) {
      if (content.includes(marker)) problems.push(`${page}: ${label} contains unexpanded template text ${marker}`)
    }

    // Only the search snippet is length-capped; the preview tags are allowed the longer wording the cards show.
    if (label === 'description' && content.length > MAX_DESCRIPTION_LENGTH) {
      problems.push(`${page}: ${label} is ${content.length} characters, over the ${MAX_DESCRIPTION_LENGTH}-character limit`)
    }
  }

  return problems
}

/**
 * The deductions #291 added to the salary engine, as the salary page's own descriptions have to name them.
 * Lower-cased, so the check is case-insensitive whichever way the wording is capitalised.
 */
const SALARY_PAGE_KEYWORDS = ['student loan', 'pension']

/** Everything the salary page's search-and-share descriptions fail to mention; empty means they cover the whole page. */
function salaryKeywordProblems(html: string): string[] {
  const doc = parse(html, 'text/html')
  const problems: string[] = []

  // twitter:description is deliberately the short one, so only the two full-length tags are held to this.
  for (const [label, selector] of DESCRIPTION_TAGS.filter(([tag]) => tag !== 'twitter:description')) {
    const content = (doc.querySelector(selector)?.getAttribute('content') ?? '').toLowerCase()
    for (const keyword of SALARY_PAGE_KEYWORDS) {
      if (!content.includes(keyword)) problems.push(`salaryMethodology: ${label} does not mention ${keyword}`)
    }
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
const descriptionTag = (content: string) => `<meta name="description" content="${content}" />`
const ogDescriptionTag = (content: string) => `<meta property="og:description" content="${content}" />`
const twitterDescriptionTag = (content: string) => `<meta name="twitter:description" content="${content}" />`
/** A page whose three descriptions are all sound, with `description` overridable so one rule at a time can be broken. */
const describedPage = (description = 'A sound search description.') =>
  pageFixture(descriptionTag(description) + ogDescriptionTag('A sound link-preview description.') + twitterDescriptionTag('A sound card.'))
/** A description of exactly `length` characters, so the limit can be probed from either side. */
const descriptionOfLength = (length: number) => 'a'.repeat(length)

describe('canonical tags on the HTML entry points', () => {
  const entries = htmlEntries()

  it('finds every entry Vite builds', () => {
    expect(entries.map(([name]) => name)).toEqual(['main', 'vehicleMethodology', 'salaryMethodology', 'sourcesEthos'])
  })

  it.each(entries)('%s declares exactly one canonical, equal to its og:url', (_name, html) => {
    expect(canonicalProblems(html)).toEqual([])
  })
})

describe('search and share descriptions on the HTML entry points', () => {
  const entries = htmlEntries()

  it.each(entries)('%s carries one sound description, og:description and twitter:description', (name, html) => {
    expect(descriptionProblems(name, html)).toEqual([])
  })

  // #320: the page gained Student loans and Workplace pensions sections in #291, but its <head> still
  // advertised tax and NI only, so search results and link previews under-sold half the page. Nothing
  // tested the descriptions, which is how they drifted; this is the guard that stops it happening again.
  it('says the salary page covers student loans and pensions, as the page and the /sources/ blurb do', () => {
    const salary = entries.find(([name]) => name === 'salaryMethodology')
    expect(salary).toBeDefined()
    expect(salaryKeywordProblems(salary![1])).toEqual([])
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

  it('accepts a page whose three descriptions are all sound', () => {
    expect(descriptionProblems('page', describedPage())).toEqual([])
  })

  it('rejects a page missing each description tag in turn', () => {
    expect(descriptionProblems('page', pageFixture(ogDescriptionTag('og') + twitterDescriptionTag('card')))).toContain(
      'page: expected exactly 1 description tag, found 0',
    )
    expect(descriptionProblems('page', pageFixture(descriptionTag('search') + twitterDescriptionTag('card')))).toContain(
      'page: expected exactly 1 og:description tag, found 0',
    )
    expect(descriptionProblems('page', pageFixture(descriptionTag('search') + ogDescriptionTag('og')))).toContain(
      'page: expected exactly 1 twitter:description tag, found 0',
    )
  })

  it('rejects a duplicated description tag rather than silently reading the first', () => {
    const html = pageFixture(descriptionTag('search') + descriptionTag('search') + ogDescriptionTag('og') + twitterDescriptionTag('card'))
    expect(descriptionProblems('page', html)).toEqual(['page: expected exactly 1 description tag, found 2'])
  })

  it('rejects an empty, whitespace-only or attribute-less description', () => {
    expect(descriptionProblems('page', describedPage(''))).toEqual(['page: description is empty'])
    expect(descriptionProblems('page', describedPage('   '))).toEqual(['page: description is empty'])
    const noAttribute = pageFixture('<meta name="description" />' + ogDescriptionTag('og') + twitterDescriptionTag('card'))
    expect(descriptionProblems('page', noAttribute)).toEqual(['page: description is empty'])
  })

  it('rejects unexpanded template text in any description', () => {
    expect(descriptionProblems('page', describedPage('Saving %rate% a month.'))).toEqual([
      'page: description contains unexpanded template text %',
    ])
    expect(descriptionProblems('page', describedPage('Saving {{ rate }} a month.'))).toEqual([
      'page: description contains unexpanded template text {{',
    ])
    expect(descriptionProblems('page', describedPage('TODO: write this.'))).toEqual([
      'page: description contains unexpanded template text TODO',
    ])
  })

  it('caps the search description at 160 characters, and only that tag', () => {
    expect(descriptionProblems('page', describedPage(descriptionOfLength(MAX_DESCRIPTION_LENGTH)))).toEqual([])
    expect(descriptionProblems('page', describedPage(descriptionOfLength(MAX_DESCRIPTION_LENGTH + 1)))).toEqual([
      `page: description is ${MAX_DESCRIPTION_LENGTH + 1} characters, over the ${MAX_DESCRIPTION_LENGTH}-character limit`,
    ])

    // The preview tags carry the longer wording the cards show, so the cap must not reach them.
    const longPreviews = pageFixture(
      descriptionTag('Short enough.') +
        ogDescriptionTag(descriptionOfLength(MAX_DESCRIPTION_LENGTH + 40)) +
        twitterDescriptionTag(descriptionOfLength(MAX_DESCRIPTION_LENGTH + 40)),
    )
    expect(descriptionProblems('page', longPreviews)).toEqual([])
  })

  it('rejects a salary-page description that leaves out student loans or pensions', () => {
    const taxOnly = 'How UK income tax and National Insurance are inverted to turn take-home back into a gross salary.'
    expect(salaryKeywordProblems(describedPage(taxOnly))).toEqual([
      'salaryMethodology: description does not mention student loan',
      'salaryMethodology: description does not mention pension',
      'salaryMethodology: og:description does not mention student loan',
      'salaryMethodology: og:description does not mention pension',
    ])

    const loanOnly = pageFixture(
      descriptionTag('Income tax, National Insurance and student loan deductions.') +
        ogDescriptionTag('Income tax, National Insurance and student loan deductions.') +
        twitterDescriptionTag('card'),
    )
    expect(salaryKeywordProblems(loanOnly)).toEqual([
      'salaryMethodology: description does not mention pension',
      'salaryMethodology: og:description does not mention pension',
    ])
  })

  it('matches the salary-page keywords whatever their capitalisation', () => {
    const shouty = pageFixture(
      descriptionTag('STUDENT LOAN and PENSION deductions.') +
        ogDescriptionTag('Student Loan and Workplace Pension deductions.') +
        twitterDescriptionTag('card'),
    )
    expect(salaryKeywordProblems(shouty)).toEqual([])
  })
})
