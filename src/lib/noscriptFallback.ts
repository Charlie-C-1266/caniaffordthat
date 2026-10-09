import type { HtmlTagDescriptor, Plugin } from 'vite'

// The no-JavaScript fallback, injected into every HTML entry by
// noscriptFallbackPlugin() below. Without it each entry is an empty `#root`
// div, so a visitor with JS disabled or blocked — or whose bundle simply
// failed to load — gets a blank white screen with no explanation. This is
// distinct from the error boundary (#35), which handles a React render error
// *after* the bundle has loaded and run.
//
// Generated from one source for the same reason the theme bootstrap is
// (#41/themeBootstrap.ts): four hand-copied blocks drift.

/**
 * The fallback's own colours, as literal values.
 *
 * It cannot use the `--bg-dark-1`/`--text-primary` custom properties: those
 * live in styles/tokens.css, which arrives with the bundle, and the whole
 * point of this block is the case where the bundle never runs. Nor can it use
 * the theme bootstrap's resolved choice, which is itself JavaScript — so the
 * light/dark split is done in plain CSS with `prefers-color-scheme`.
 *
 * These are transcribed from tokens.css, and noscriptFallback.test.ts parses
 * that file and asserts they still match, so the copy cannot drift.
 */
export const NOSCRIPT_COLORS = {
  dark: { background: '#14121f', text: '#f5f3ff', link: '#2ed573' },
  light: { background: '#faf9fc', text: '#1b1633', link: '#0f7a3f' },
} as const

/** The class the fallback's wrapper carries — also how the e2e specs find it. */
export const NOSCRIPT_CLASS = 'noscript-fallback'

/** The heading and sentence, identical on every page so the copy can't drift. */
export const NOSCRIPT_HEADING = 'Can I Afford That?'
export const NOSCRIPT_MESSAGE =
  'This calculator needs JavaScript to run. Please enable it, or try a different browser, and the page will load.'

export const NOSCRIPT_FALLBACK_PLUGIN_NAME = 'inject-noscript-fallback'

/**
 * Whether an HTML entry is the calculator itself rather than one of the docs
 * pages. Only the calculator offers the "Our sources" link, so the fallback
 * isn't a dead end there; on the sources page that link would point at itself.
 *
 * Matches both the dev server's request paths (`/`, `/sources/`) and the
 * build's entry filenames (`sources/index.html`).
 */
export function isCalculatorEntry(path: string): boolean {
  return !/(^|\/)(sources|methodology)\//.test(path)
}

/** The scoped stylesheet. Styles `body` too: with no bundle there is no stylesheet at all, so even the page background is this block's job. */
function noscriptStyles(): string {
  const { dark, light } = NOSCRIPT_COLORS
  return `
    body {
      margin: 0;
      background: ${dark.background};
    }
    .${NOSCRIPT_CLASS} {
      box-sizing: border-box;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 14px;
      padding: 48px 16px;
      text-align: center;
      font-family: Manrope, system-ui, -apple-system, 'Segoe UI', sans-serif;
      background: ${dark.background};
      color: ${dark.text};
    }
    .${NOSCRIPT_CLASS} h1 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .${NOSCRIPT_CLASS} p {
      margin: 0;
      max-width: 34rem;
      font-size: 1rem;
      line-height: 1.5;
      overflow-wrap: break-word;
    }
    .${NOSCRIPT_CLASS} a {
      color: ${dark.link};
      font-weight: 700;
    }
    @media (prefers-color-scheme: light) {
      body {
        background: ${light.background};
      }
      .${NOSCRIPT_CLASS} {
        background: ${light.background};
        color: ${light.text};
      }
      .${NOSCRIPT_CLASS} a {
        color: ${light.link};
      }
    }
  `
}

/**
 * The fallback's body — everything inside the `<noscript>` element. One
 * source for both the injected tag and the test's expectations.
 */
export function noscriptInnerHtml(path: string): string {
  const sourcesLink = isCalculatorEntry(path)
    ? `
      <p><a href="/sources/">Read how the numbers are worked out</a></p>`
    : ''
  return `
    <style>${noscriptStyles()}</style>
    <div class="${NOSCRIPT_CLASS}">
      <h1>${NOSCRIPT_HEADING}</h1>
      <p>${NOSCRIPT_MESSAGE}</p>${sourcesLink}
    </div>
  `
}

/** The full `<noscript>` element for one entry, as it appears in the served HTML. */
export function noscriptFallbackHtml(path: string): string {
  return `<noscript>${noscriptInnerHtml(path)}</noscript>`
}

/** The tag descriptor injected into an entry — exported so the test asserts against exactly what ships. */
export function noscriptFallbackTags(path: string): HtmlTagDescriptor[] {
  return [
    {
      tag: 'noscript',
      children: noscriptInnerHtml(path),
      // Ahead of `#root`, so a no-JS visitor's content is the first thing in
      // the body rather than sitting after an empty mount point.
      injectTo: 'body-prepend',
    },
  ]
}

/**
 * Vite plugin that injects the no-JS fallback into every HTML entry point, in
 * dev and build alike — one source instead of four hand-maintained copies.
 */
export function noscriptFallbackPlugin(): Plugin {
  return {
    name: NOSCRIPT_FALLBACK_PLUGIN_NAME,
    transformIndexHtml: {
      order: 'pre',
      handler: (_html, ctx) => noscriptFallbackTags(ctx.path),
    },
  }
}
