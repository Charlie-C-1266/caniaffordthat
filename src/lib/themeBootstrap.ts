import type { HtmlTagDescriptor, Plugin } from 'vite'
import { THEME_STORAGE_KEY } from './themeStorageKey.ts'

// The pre-paint theme bootstrap, generated from THEME_STORAGE_KEY so the
// storage key literally cannot drift from theme.ts. Every HTML entry gets it
// injected at build/serve time by themeBootstrapPlugin() below — previously
// each entry hand-copied an identical inline <script>, and any change to the
// key or the resolution rule had to be remembered in four separate files.
//
// It must mirror resolveInitialTheme + applyTheme in theme.ts: it runs
// before any bundled JS exists, so it can't import them. themeBootstrap.test.ts
// executes this script and pins its behavior against those helpers.

/** The inline script body: resolve stored choice → OS preference → dark, and pre-paint light via the data-theme attribute. */
export const THEME_BOOTSTRAP_SCRIPT = `(function () {
  try {
    var stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})
    var theme =
      stored === 'light' || stored === 'dark'
        ? stored
        : window.matchMedia('(prefers-color-scheme: light)').matches
          ? 'light'
          : 'dark'
    if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light')
  } catch (e) {}
})()`

export const THEME_BOOTSTRAP_PLUGIN_NAME = 'inject-theme-bootstrap'

/** The tag descriptor injected into every HTML entry — exported so the test can assert against exactly what ships. */
export function themeBootstrapTags(): HtmlTagDescriptor[] {
  return [
    {
      tag: 'script',
      children: THEME_BOOTSTRAP_SCRIPT,
      // As early as possible: before the stylesheets and the (deferred)
      // module bundle, so the theme is applied before first paint and the
      // page never flashes the wrong theme.
      injectTo: 'head-prepend',
    },
  ]
}

/**
 * Vite plugin that injects the theme bootstrap script into every HTML entry
 * point, in dev and build alike — the single replacement for the four
 * hand-maintained copies.
 */
export function themeBootstrapPlugin(): Plugin {
  return {
    name: THEME_BOOTSTRAP_PLUGIN_NAME,
    transformIndexHtml: {
      order: 'pre',
      handler: () => themeBootstrapTags(),
    },
  }
}
