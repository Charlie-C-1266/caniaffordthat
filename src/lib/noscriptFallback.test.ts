import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { IndexHtmlTransformContext } from 'vite'
import {
  isCalculatorEntry,
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

describe('isCalculatorEntry', () => {
  it('is true only for the calculator entry', () => {
    expect(isCalculatorEntry('/index.html')).toBe(true)
    expect(isCalculatorEntry('/sources/index.html')).toBe(false)
    expect(isCalculatorEntry('/methodology/salary/index.html')).toBe(false)
    expect(isCalculatorEntry('/methodology/vehicle/index.html')).toBe(false)
  })

  it("also handles the dev server's request paths", () => {
    // In dev the plugin is handed '/' or '/sources/', not a filename.
    expect(isCalculatorEntry('/')).toBe(true)
    expect(isCalculatorEntry('/sources/')).toBe(false)
    expect(isCalculatorEntry('/methodology/salary/')).toBe(false)
  })
})

describe('noscriptFallbackHtml', () => {
  it('gives every entry a visible heading and message', () => {
    // Collected rather than asserted per entry so a failure names the pages.
    const incomplete = ENTRY_PATHS.filter((path) => {
      const html = noscriptFallbackHtml(path)
      return (
        !html.includes(`<h1>${NOSCRIPT_HEADING}</h1>`) ||
        !html.includes(NOSCRIPT_MESSAGE) ||
        !html.includes(`class="${NOSCRIPT_CLASS}"`) ||
        !html.startsWith('<noscript>') ||
        !html.endsWith('</noscript>')
      )
    })
    expect(incomplete).toEqual([])
  })

  it('offers the sources link on the calculator only, so it is not a dead end', () => {
    expect(noscriptFallbackHtml('/index.html')).toContain('href="/sources/"')
    // On the sources page itself that link would point at the current page.
    const docsWithLink = ENTRY_PATHS.slice(1).filter((path) => noscriptFallbackHtml(path).includes('href="/sources/"'))
    expect(docsWithLink).toEqual([])
  })

  it('keeps the heading and message copy identical across all four entries', () => {
    // The whole reason this is generated rather than hand-copied (cf. #41).
    const bodies = ENTRY_PATHS.map((path) => noscriptFallbackHtml(path).replace(/\s*<p><a href="\/sources\/">[^<]*<\/a><\/p>/, ''))
    expect(new Set(bodies).size).toBe(1)
  })

  it('carries its own styles, because no stylesheet loads without the bundle', () => {
    const html = noscriptFallbackHtml('/index.html')
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
    expect(NOSCRIPT_COLORS.dark.link).toBe(tokenValue(':root', '--accent-save'))
  })

  it('matches the light theme tokens', () => {
    expect(NOSCRIPT_COLORS.light.background).toBe(tokenValue(":root\\[data-theme='light'\\]", '--bg-dark-1'))
    expect(NOSCRIPT_COLORS.light.text).toBe(tokenValue(":root\\[data-theme='light'\\]", '--text-primary'))
    // --accent-save is only 1.84:1 on the light background; --accent-save-text
    // is the AA-passing variant, which is what a link needs.
    expect(NOSCRIPT_COLORS.light.link).toBe(tokenValue(":root\\[data-theme='light'\\]", '--accent-save-text'))
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
    expect(injected).toEqual(ENTRY_PATHS.map((path) => noscriptFallbackTags(path)))

    // Prepended into the body, so the fallback is a no-JS visitor's first content.
    const placements = ENTRY_PATHS.map((path) => {
      const [tag] = noscriptFallbackTags(path)
      return { tag: tag.tag, injectTo: tag.injectTo }
    })
    expect(placements).toEqual(ENTRY_PATHS.map(() => ({ tag: 'noscript', injectTo: 'body-prepend' })))
  })
})
