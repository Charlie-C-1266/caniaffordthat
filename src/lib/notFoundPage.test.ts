// @vitest-environment node
// Guards public/404.html rather than a module, so there is no notFoundPage.ts
// to go with it — the same arrangement as seo.test.ts and dependabotConfig.
//
// The page is nginx's `error_page 404` body (and Vercel's not-found page), so
// it never loads the bundle. That means nothing in the app's own tests touches
// it, and nothing stops it drifting: these assertions are the only thing that
// does. Node environment with jsdom driven directly, because reading the files
// needs a real file: URL for import.meta.url.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import { describe, it, expect } from 'vitest'

const { window } = new JSDOM()

const readRepoFile = (path: string) => readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), 'utf8')

const HTML = readRepoFile('public/404.html')
const SITEMAP = readRepoFile('public/sitemap.xml')
const NGINX_CONF = readRepoFile('nginx.conf')
const TOKENS = readRepoFile('src/styles/tokens.css')

const doc = new window.DOMParser().parseFromString(HTML, 'text/html')

/** The value of a custom property within the first block matching `selector` — as noscriptFallback.test.ts does it. */
function tokenValue(selector: string, property: string): string {
  const block = new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(TOKENS)
  if (block === null) throw new Error(`no ${selector} block in tokens.css`)
  const match = new RegExp(`${property}:\\s*([^;]+);`).exec(block[1])
  if (match === null) throw new Error(`no ${property} in ${selector}`)
  return match[1].trim()
}

/** The page's own `--bg`/`--text`/… values, from its default or its light-scheme block. */
function pageColor(name: string, scheme: 'dark' | 'light'): string {
  const source =
    scheme === 'dark'
      ? // Everything before the media query is the default (dark) block.
        HTML.slice(0, HTML.indexOf('@media (prefers-color-scheme: light)'))
      : HTML.slice(HTML.indexOf('@media (prefers-color-scheme: light)'))
  const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(source)
  if (match === null) throw new Error(`no --${name} in the ${scheme} block of 404.html`)
  return match[1].trim()
}

describe('public/404.html', () => {
  it('exists and is a complete HTML document', () => {
    expect(HTML.trim().startsWith('<!doctype html>')).toBe(true)
    expect(doc.documentElement.getAttribute('lang')).toBe('en')
    // Without a charset the "doesn't" apostrophe and the · in the title are
    // decoded by guesswork.
    expect(doc.querySelector('meta[charset]')?.getAttribute('charset')?.toLowerCase()).toBe('utf-8')
    // Needed for the clamp()-based heading and the 16px gutter to mean
    // anything on a phone.
    expect(doc.querySelector('meta[name="viewport"]')?.getAttribute('content')).toContain('width=device-width')
  })

  it('has a title that says what happened and which site it is', () => {
    expect(doc.title).toBe('Page not found · Can I Afford That?')
  })

  it('tells crawlers not to index it', () => {
    // nginx serves it only as an error body, but Vercel serves static files by
    // path — so the tag is what keeps it out of the index there.
    const robots = [...doc.querySelectorAll('meta[name="robots"]')].map((tag) => tag.getAttribute('content'))
    expect(robots).toEqual(['noindex'])
  })

  it('offers exactly one way back, to the calculator', () => {
    const links = [...doc.querySelectorAll('a')]
    expect(links).toHaveLength(1)
    expect(links[0].getAttribute('href')).toBe('/')
    expect(links[0].textContent?.trim()).toBe('Back to the calculator')
  })

  it('says plainly that the page does not exist', () => {
    expect(doc.querySelector('h1')?.textContent?.trim()).toBe("This page doesn't exist")
    expect(doc.body.textContent).toContain('ERROR 404')
  })

  it('needs no JavaScript and no bundle to render', () => {
    // An error page that depended on the app's own bundle would be blank
    // exactly when the bundle is the thing that failed.
    expect(doc.querySelectorAll('script')).toHaveLength(0)
    expect(doc.querySelectorAll('link[rel="stylesheet"]')).toHaveLength(0)
    expect(doc.querySelectorAll('style')).toHaveLength(1)
    // No webfont or other third-party request either, so first paint can't be
    // held up by a network the visitor may already be having trouble with.
    expect(HTML).not.toContain('//fonts.googleapis.com')
    expect(HTML).not.toMatch(/src\s*=\s*["']https?:/)
  })

  it('themes itself from prefers-color-scheme, since the theme bootstrap is JavaScript', () => {
    expect(HTML).toContain('@media (prefers-color-scheme: light)')
  })

  it('keeps its hard-coded colours in step with tokens.css', () => {
    // Transcribed, not imported: tokens.css arrives with the bundle. Same
    // reasoning as NOSCRIPT_COLORS, and pinned the same way.
    expect(pageColor('bg', 'dark')).toBe(tokenValue(':root', '--bg-dark-1'))
    expect(pageColor('text', 'dark')).toBe(tokenValue(':root', '--text-primary'))
    expect(pageColor('bg', 'light')).toBe(tokenValue(":root\\[data-theme='light'\\]", '--bg-dark-1'))
    expect(pageColor('text', 'light')).toBe(tokenValue(":root\\[data-theme='light'\\]", '--text-primary'))
    // The accent is the link's background, so it carries the page's only
    // large text — the light value is the AA-safe one, not the brand green.
    expect(pageColor('accent', 'dark')).toBe(tokenValue(':root', '--accent-save'))
    expect(pageColor('accent', 'light')).toBe(tokenValue(":root\\[data-theme='light'\\]", '--accent-save-text'))
  })

  it('is not listed in sitemap.xml', () => {
    // seo.test.ts already fails if the sitemap lists anything that is not one
    // of the four pages' canonical URLs; this names the case directly, since
    // 404.html is the file most likely to be added there by mistake.
    expect(SITEMAP).not.toContain('404')
  })

  it('is wired up in nginx.conf as an error body, not a route', () => {
    // The page is useless without the directive that serves it, and the
    // directive is in a file no other test reads.
    expect(NGINX_CONF).toMatch(/^\s*error_page 404 \/404\.html;$/m)
    // `error_page 404 =200 ...` would serve it with a 200 and tell crawlers
    // the mistyped URL is real.
    expect(NGINX_CONF).not.toContain('error_page 404 =')
    // `internal` is what stops /404.html being a 200 route of its own.
    expect(NGINX_CONF).toMatch(/location = \/404\.html \{[\s\S]*?\binternal;/)
  })

  it('also serves the branded page for a directory that has no index', () => {
    // /methodology/ exists but holds only salary/ and vehicle/, so `index`
    // finds nothing and autoindex is off: nginx answers 403, not 404. Here
    // the `=404` is required rather than forbidden — it rewrites a status
    // that would otherwise say "not allowed" about a path that simply has no
    // page. scripts/verify-nginx.sh proves the behaviour against real nginx;
    // this guards the directive from being dropped.
    expect(NGINX_CONF).toMatch(/^\s*error_page 403 =404 \/404\.html;$/m)
  })
})
