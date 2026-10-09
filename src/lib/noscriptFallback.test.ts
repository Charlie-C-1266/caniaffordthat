import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { IndexHtmlTransformContext } from 'vite'
import {
  noscriptFallbackHtml,
  noscriptFallbackPlugin,
  noscriptFallbackTags,
  NOSCRIPT_CLASS,
  NOSCRIPT_COLORS,
  NOSCRIPT_FALLBACK_PLUGIN_NAME,
  NOSCRIPT_HEADING,
  NOSCRIPT_MESSAGE,
} from './noscriptFallback'

/** The four HTML entries, as vite.config.ts lists them, by the path the plugin sees. */
const ENTRY_PATHS = ['/index.html', '/methodology/vehicle/index.html', '/methodology/salary/index.html', '/sources/index.html'] as const

describe('noscriptFallbackHtml', () => {
  it('is a <noscript> block with a visible heading and message', () => {
    const html = noscriptFallbackHtml()
    expect(html.startsWith('<noscript>')).toBe(true)
    expect(html.endsWith('</noscript>')).toBe(true)
    expect(html).toContain(`class="${NOSCRIPT_CLASS}"`)
    expect(html).toContain(`<h1>${NOSCRIPT_HEADING}</h1>`)
    expect(html).toContain(NOSCRIPT_MESSAGE)
  })

  it('speaks for whichever page it is on, not just the calculator', () => {
    // The same copy shows on the sources and methodology pages.
    expect(NOSCRIPT_MESSAGE).toMatch(/^This page needs JavaScript/)
    expect(NOSCRIPT_MESSAGE).not.toContain('calculator')
  })

  it('carries no links, since every page it could point at needs JavaScript too', () => {
    expect(noscriptFallbackHtml()).not.toContain('<a ')
  })

  it('carries its own styles, because no stylesheet loads without the bundle', () => {
    const html = noscriptFallbackHtml()
    expect(html).toContain('<style>')
    // Including the page background: with no bundle, body has none.
    expect(html).toContain('body {')
    // The theme bootstrap is itself JS, so the light/dark split is plain CSS.
    expect(html).toContain('@media (prefers-color-scheme: light)')
    // And no dependence on the token custom properties, which ship with the bundle.
    expect(html).not.toContain('var(--')
  })
})

describe('NOSCRIPT_COLORS', () => {
  // The fallback hard-codes its colours because tokens.css arrives with the
  // bundle. This parses tokens.css and fails if those copies ever drift.
  const tokens = readFileSync(fileURLToPath(new URL('../styles/tokens.css', import.meta.url)), 'utf8')

  /** The value of a custom property within the first block matching `selector`. */
  function tokenValue(selector: string, property: string): string {
    const block = new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(tokens)
    if (block === null) throw new Error(`no ${selector} block in tokens.css`)
    const match = new RegExp(`${property}:\\s*([^;]+);`).exec(block[1])
    if (match === null) throw new Error(`no ${property} in ${selector}`)
    return match[1].trim()
  }

  it('matches the dark theme tokens', () => {
    expect(NOSCRIPT_COLORS.dark.background).toBe(tokenValue(':root', '--bg-dark-1'))
    expect(NOSCRIPT_COLORS.dark.text).toBe(tokenValue(':root', '--text-primary'))
  })

  it('matches the light theme tokens', () => {
    expect(NOSCRIPT_COLORS.light.background).toBe(tokenValue(":root\\[data-theme='light'\\]", '--bg-dark-1'))
    expect(NOSCRIPT_COLORS.light.text).toBe(tokenValue(":root\\[data-theme='light'\\]", '--text-primary'))
  })
})

describe('noscriptFallbackPlugin', () => {
  it('is registered under a stable name', () => {
    expect(noscriptFallbackPlugin().name).toBe(NOSCRIPT_FALLBACK_PLUGIN_NAME)
  })

  it('injects the fallback into the body of every entry', () => {
    const plugin = noscriptFallbackPlugin()
    const hook = plugin.transformIndexHtml
    if (hook === undefined || typeof hook === 'function' || !('handler' in hook)) {
      throw new Error('expected an object-form transformIndexHtml hook')
    }
    const handler = hook.handler as (html: string, ctx: IndexHtmlTransformContext) => unknown

    const injected = ENTRY_PATHS.map((path) =>
      handler('<!doctype html><html><head></head><body></body></html>', { path } as IndexHtmlTransformContext),
    )
    // The same fallback on every entry — the reason it's generated rather than
    // hand-copied (cf. #41).
    expect(injected).toEqual(ENTRY_PATHS.map(() => noscriptFallbackTags()))

    // Prepended into the body, so the fallback is a no-JS visitor's first content.
    const [tag] = noscriptFallbackTags()
    expect({ tag: tag.tag, injectTo: tag.injectTo }).toEqual({ tag: 'noscript', injectTo: 'body-prepend' })
  })
})
