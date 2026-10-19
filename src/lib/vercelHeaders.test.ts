// @vitest-environment node
// Guards vercel.json against nginx.conf rather than a module, so there is no
// vercelHeaders.ts to go with it — the same shape as dependabotConfig.test.ts.
//
// The two files serve the same site from different places: nginx.conf reaches
// self-hosters, vercel.json reaches production. Nothing but this test stops
// one of them from quietly gaining, losing or changing a security header
// while the other keeps the old list (#215), because neither file imports the
// other and CI never serves both at once.
//
// Cache-Control is deliberately *not* part of the security-header comparison:
// it is route-specific by design (a year and immutable under /assets/,
// no-cache for HTML, an hour for the unhashed public files), so it is checked
// per route instead.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import viteConfig from '../../vite.config'

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url))

const read = (name: string) => readFileSync(`${REPO_ROOT}${name}`, 'utf8')

/** Compared separately per route, so it never counts as a security header. */
const CACHE_CONTROL = 'cache-control'

/** The hashed assets' location in each file, which must agree on one cache value. */
const NGINX_ASSETS_LOCATION = '^~ /assets/'
const VERCEL_ASSETS_SOURCE = '/assets/(.*)'
/** Vercel's catch-all, which has to carry what nginx repeats in every location. */
const VERCEL_ALL_SOURCE = '/(.*)'

type Headers = Map<string, string>

/** The shape of vercel.json this test reads. Parsed rather than imported, so a malformed file is a reportable problem instead of a build error. */
interface VercelHeaderEntry {
  source: string
  headers: { key: string; value: string }[]
}
interface VercelConfig {
  ignoreCommand?: string
  trailingSlash?: boolean
  headers?: VercelHeaderEntry[]
}

/** The repository's own vercel.json, typed. Only ever called on a file the tests below also validate. */
function parseVercel(source: string): VercelConfig {
  return JSON.parse(source) as VercelConfig
}

/**
 * Every `location` block's `add_header` directives, keyed by the location
 * spec. Header names are lower-cased so a casing change on either side isn't
 * read as a different header.
 */
function nginxLocations(source: string): Map<string, Headers> {
  const locations = new Map<string, Headers>()
  let current: Headers | null = null
  let depth = 0

  for (const raw of source.split('\n')) {
    const line = raw.trim()
    if (line.startsWith('#')) continue

    if (current === null) {
      const opened = /^location\s+(.+?)\s*\{$/.exec(line)
      if (opened) {
        current = new Map<string, string>()
        depth = 1
        locations.set(opened[1], current)
      }
      continue
    }

    depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length
    if (depth <= 0) {
      current = null
      continue
    }
    const header = /^add_header\s+([A-Za-z-]+)\s+"([^"]*)"(\s+always)?\s*;$/.exec(line)
    if (header) current.set(header[1].toLowerCase(), header[2])
  }
  return locations
}

/** A copy of `headers` without Cache-Control — the set the two files must agree on. */
function securityOnly(headers: Headers): Headers {
  return new Map([...headers].filter(([name]) => name !== CACHE_CONTROL))
}

/** `[problems, routes]` — the parsed `headers` block of a vercel.json, keyed by `source`. */
function vercelRoutes(source: string): [string[], Map<string, Headers>] {
  const routes = new Map<string, Headers>()
  let config: VercelConfig
  try {
    config = parseVercel(source)
  } catch (error) {
    // A parse failure is the whole story — nothing below can run on it.
    return [[`vercel.json is not valid JSON: ${(error as Error).message}`], routes]
  }

  const block: unknown = config.headers
  if (!Array.isArray(block)) return [['vercel.json has no `headers` array'], routes]
  if (block.length === 0) return [["vercel.json's `headers` array is empty"], routes]

  const problems: string[] = []
  for (const [i, raw] of (block as unknown[]).entries()) {
    const entry = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
    const where = typeof entry.source === 'string' && entry.source !== '' ? entry.source : `headers[${i}]`
    if (typeof entry.source !== 'string' || entry.source === '') problems.push(`headers[${i}] has no \`source\``)
    if (!Array.isArray(entry.headers) || entry.headers.length === 0) {
      problems.push(`${where} has no headers of its own`)
      continue
    }
    // A repeated `source` is merged rather than overwritten, so a header split
    // across two entries for the same route still counts as present.
    const headers = routes.get(where) ?? new Map<string, string>()
    for (const rawHeader of entry.headers as unknown[]) {
      const h = typeof rawHeader === 'object' && rawHeader !== null ? (rawHeader as Record<string, unknown>) : {}
      if (typeof h.key !== 'string' || typeof h.value !== 'string') {
        problems.push(`${where} has a header that is not a {key, value} pair of strings`)
        continue
      }
      headers.set(h.key.toLowerCase(), h.value)
    }
    routes.set(where, headers)
  }
  return [problems, routes]
}

/**
 * Everything the two files disagree about; empty means they are in step.
 *
 * Extra headers are treated as drift in both directions, deliberately: a
 * header that only one deployment sets means visitors get different responses
 * depending on where the site is served from, which is the whole failure this
 * guard exists to catch. Adding a header is therefore a two-file change.
 */
function headerParityProblems(nginxSource: string, vercelSource: string): string[] {
  const problems: string[] = []
  const locations = nginxLocations(nginxSource)
  if (locations.size === 0) return ['nginx.conf declares no location blocks']

  // nginx repeats the security headers in every location, because a location
  // that sets any `add_header` of its own inherits none from the server block.
  // Its own comment says to keep those lists in sync, so that is checked here
  // before either list is compared with Vercel's.
  const specs = [...locations.keys()]
  const first = specs[0]
  const expected = securityOnly(locations.get(first) ?? new Map<string, string>())
  for (const spec of specs.slice(1)) {
    const got = securityOnly(locations.get(spec) ?? new Map<string, string>())
    for (const [name, value] of expected) {
      const mine = got.get(name)
      if (mine === undefined) problems.push(`nginx.conf: location ${spec} is missing ${name}, which location ${first} sets`)
      else if (mine !== value)
        problems.push(`nginx.conf: location ${spec} sets ${name} to "${mine}", but location ${first} sets "${value}"`)
    }
    for (const name of got.keys()) {
      if (!expected.has(name)) problems.push(`nginx.conf: location ${spec} sets ${name}, which location ${first} does not`)
    }
  }

  const [vercelProblems, routes] = vercelRoutes(vercelSource)
  problems.push(...vercelProblems)
  if (routes.size === 0) return problems

  const all = routes.get(VERCEL_ALL_SOURCE)
  if (all === undefined) {
    problems.push(`vercel.json has no "${VERCEL_ALL_SOURCE}" route, so the security headers cannot apply to every path`)
  } else {
    const got = securityOnly(all)
    for (const [name, value] of expected) {
      const mine = got.get(name)
      if (mine === undefined) problems.push(`vercel.json is missing ${name}, which nginx.conf sets to "${value}"`)
      else if (mine !== value) problems.push(`${name} differs: nginx.conf "${value}", vercel.json "${mine}"`)
    }
    for (const name of got.keys()) {
      if (!expected.has(name)) problems.push(`vercel.json sets ${name} on every route, which nginx.conf does not set at all`)
    }
  }

  // The hashed assets' cache value, the other thing the two files have to agree on.
  const nginxAssets = locations.get(NGINX_ASSETS_LOCATION)?.get(CACHE_CONTROL)
  const vercelAssets = routes.get(VERCEL_ASSETS_SOURCE)?.get(CACHE_CONTROL)
  if (nginxAssets === undefined) problems.push(`nginx.conf: location ${NGINX_ASSETS_LOCATION} sets no Cache-Control`)
  if (vercelAssets === undefined) problems.push(`vercel.json: "${VERCEL_ASSETS_SOURCE}" sets no Cache-Control`)
  if (nginxAssets !== undefined && vercelAssets !== undefined && nginxAssets !== vercelAssets) {
    problems.push(`the /assets/ cache differs: nginx.conf "${nginxAssets}", vercel.json "${vercelAssets}"`)
  }

  return problems
}

/** The URL every HTML entry in vite.config.ts is served at, e.g. `sources/index.html` -> `/sources/`. */
function htmlPageUrls(): string[] {
  const input = viteConfig.build?.rollupOptions?.input
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('vite.config.ts declares no named HTML entries')
  return Object.values(input).map((path) => {
    const relative = path.startsWith(REPO_ROOT) ? path.slice(REPO_ROOT.length) : path
    return `/${relative.replace(/index\.html$/, '')}`
  })
}

const NGINX = read('docker/nginx.conf')
const VERCEL = read('vercel.json')

/** The repository's vercel.json with one entry's headers replaced, as a JSON string. */
function vercelWith(source: string, headers: { key: string; value: string }[]): string {
  const config = parseVercel(VERCEL)
  const entries = (config.headers ?? []).map((entry) =>
    entry.source === source ? { source: entry.source, headers } : { source: entry.source, headers: entry.headers },
  )
  return JSON.stringify({ headers: entries })
}

/** The repository's vercel.json with one route removed entirely, as a JSON string. */
function vercelWithout(source: string): string {
  const config = parseVercel(VERCEL)
  return JSON.stringify({ headers: (config.headers ?? []).filter((entry) => entry.source !== source) })
}

/** The headers the repository's vercel.json puts on a given route. */
function headersOn(source: string): { key: string; value: string }[] {
  const config = parseVercel(VERCEL)
  return (config.headers ?? []).find((entry) => entry.source === source)?.headers ?? []
}

describe('vercel.json and nginx.conf agree on headers', () => {
  it('reports no problems for the files in the repository', () => {
    expect(headerParityProblems(NGINX, VERCEL)).toEqual([])
  })

  it('finds the four security headers in nginx.conf, so the comparison is not vacuously empty', () => {
    // Without this, the assertion above would still pass if the nginx parser
    // silently matched nothing at all.
    const assets = nginxLocations(NGINX).get(NGINX_ASSETS_LOCATION) ?? new Map<string, string>()
    expect([...securityOnly(assets).keys()].toSorted()).toEqual([
      'content-security-policy',
      'referrer-policy',
      'x-content-type-options',
      'x-frame-options',
    ])
  })
})

describe('the drift it catches', () => {
  it('fails when vercel.json drops a security header', () => {
    const vercel = vercelWith(
      VERCEL_ALL_SOURCE,
      headersOn(VERCEL_ALL_SOURCE).filter((h) => h.key !== 'X-Frame-Options'),
    )
    expect(headerParityProblems(NGINX, vercel)).toContain('vercel.json is missing x-frame-options, which nginx.conf sets to "DENY"')
  })

  it('fails when nginx.conf drops a header that vercel.json still sets', () => {
    const nginx = NGINX.split('\n')
      .filter((line) => !line.includes('X-Frame-Options'))
      .join('\n')
    expect(headerParityProblems(nginx, VERCEL)).toContain(
      'vercel.json sets x-frame-options on every route, which nginx.conf does not set at all',
    )
  })

  it('fails when a value differs between the two', () => {
    const vercel = VERCEL.replace('strict-origin-when-cross-origin', 'no-referrer')
    expect(headerParityProblems(NGINX, vercel)).toContain(
      'referrer-policy differs: nginx.conf "strict-origin-when-cross-origin", vercel.json "no-referrer"',
    )
  })

  it('fails when an extra header exists only in vercel.json', () => {
    const vercel = vercelWith(VERCEL_ALL_SOURCE, [...headersOn(VERCEL_ALL_SOURCE), { key: 'X-Made-Up', value: '1' }])
    expect(headerParityProblems(NGINX, vercel)).toContain('vercel.json sets x-made-up on every route, which nginx.conf does not set at all')
  })

  it('fails when an extra header exists only in one nginx location', () => {
    const nginx = NGINX.replace(
      '    location ~* \\.html$ {\n        add_header Cache-Control "no-cache";',
      '    location ~* \\.html$ {\n        add_header Cache-Control "no-cache";\n        add_header X-Made-Up "1" always;',
    )
    expect(headerParityProblems(nginx, VERCEL).join('\n')).toContain('x-made-up')
  })

  it('fails when the /assets/ cache value drifts', () => {
    const vercel = VERCEL.replace('public, max-age=31536000, immutable', 'public, max-age=600')
    expect(headerParityProblems(NGINX, vercel)).toContain(
      'the /assets/ cache differs: nginx.conf "public, max-age=31536000, immutable", vercel.json "public, max-age=600"',
    )
  })

  it('fails when the /assets/ route loses its Cache-Control entirely', () => {
    expect(headerParityProblems(NGINX, vercelWithout(VERCEL_ASSETS_SOURCE))).toContain('vercel.json: "/assets/(.*)" sets no Cache-Control')
  })

  it('fails when the catch-all route is gone, so no path gets the headers', () => {
    expect(headerParityProblems(NGINX, vercelWithout(VERCEL_ALL_SOURCE))).toContain(
      'vercel.json has no "/(.*)" route, so the security headers cannot apply to every path',
    )
  })
})

describe('malformed input is reported rather than passing quietly', () => {
  it('reports JSON that does not parse', () => {
    expect(headerParityProblems(NGINX, '{ not json')[0]).toMatch(/^vercel\.json is not valid JSON:/)
  })

  it('reports a missing headers block', () => {
    expect(headerParityProblems(NGINX, '{}')).toContain('vercel.json has no `headers` array')
  })

  it('reports a headers block that is not an array', () => {
    expect(headerParityProblems(NGINX, '{"headers":{}}')).toContain('vercel.json has no `headers` array')
  })

  it('reports an empty headers array', () => {
    expect(headerParityProblems(NGINX, '{"headers":[]}')).toContain("vercel.json's `headers` array is empty")
  })

  it('reports a route with no headers of its own', () => {
    expect(headerParityProblems(NGINX, '{"headers":[{"source":"/(.*)","headers":[]}]}')).toContain('/(.*) has no headers of its own')
  })

  it('reports a route with no source', () => {
    expect(headerParityProblems(NGINX, '{"headers":[{"headers":[{"key":"A","value":"b"}]}]}')).toContain('headers[0] has no `source`')
  })

  it('reports a header that is not a key/value pair of strings', () => {
    expect(headerParityProblems(NGINX, '{"headers":[{"source":"/(.*)","headers":[{"key":"A"}]}]}')).toContain(
      '/(.*) has a header that is not a {key, value} pair of strings',
    )
  })

  it('reports an nginx.conf with no location blocks', () => {
    expect(headerParityProblems('server {\n    listen 80;\n}\n', VERCEL)).toEqual(['nginx.conf declares no location blocks'])
  })
})

describe('vercel.json keeps the rest of its configuration', () => {
  it('still runs the build-skip command', () => {
    // #146's ignoreCommand: losing it would make every PR rebuild the site.
    expect(parseVercel(VERCEL).ignoreCommand).toBe('bash scripts/vercel-ignore-build.sh')
  })

  it('redirects to the trailing-slash form, the one the canonicals and sitemap use', () => {
    // #154 made /sources/ canonical; without this, /sources answers 200 too
    // and the same page has two live URLs.
    expect(parseVercel(VERCEL).trailingSlash).toBe(true)
  })

  it('marks every HTML page no-cache, so a new page cannot be added without one', () => {
    // The document names the hashed bundles, so a cached copy pins visitors
    // to a previous deploy's JS. Derived from vite.config.ts's entries, the
    // same source of truth seo.test.ts uses for the sitemap.
    const [, routes] = vercelRoutes(VERCEL)
    for (const url of htmlPageUrls()) {
      expect(routes.get(url)?.get(CACHE_CONTROL), `${url} has no Cache-Control in vercel.json`).toBe('no-cache')
    }
  })

  it('caches the unhashed public files for an hour, as nginx.conf does', () => {
    const [, routes] = vercelRoutes(VERCEL)
    const hourly = [...routes].find(([source]) => source.includes('favicon.svg'))
    expect(hourly?.[1].get(CACHE_CONTROL)).toBe('public, max-age=3600')
    // The same value nginx's catch-all location serves them with.
    expect(hourly?.[1].get(CACHE_CONTROL)).toBe(nginxLocations(NGINX).get('/')?.get(CACHE_CONTROL))
  })

  it('does not put a Cache-Control on the catch-all, so an unknown path is never cached', () => {
    // nginx gets this from `add_header` without `always`, which skips error
    // responses. Vercel matches on path alone, so the only way to keep a 404
    // uncacheable is for no catch-all rule to set Cache-Control at all.
    const [, routes] = vercelRoutes(VERCEL)
    expect(routes.get(VERCEL_ALL_SOURCE)?.has(CACHE_CONTROL)).toBe(false)
  })
})
