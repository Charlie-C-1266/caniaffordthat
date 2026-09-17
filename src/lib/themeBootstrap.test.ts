// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { IndexHtmlTransformContext } from 'vite'
import { THEME_BOOTSTRAP_PLUGIN_NAME, THEME_BOOTSTRAP_SCRIPT, themeBootstrapPlugin, themeBootstrapTags } from './themeBootstrap'
import { resolveInitialTheme, THEME_STORAGE_KEY } from './theme'

/** jsdom doesn't implement matchMedia — stub it to report a fixed light/dark preference. */
function stubMatchMedia(matches: boolean) {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches }))
}

/** Runs the bootstrap script exactly as a browser would: as a bare inline script against the document. */
function runBootstrapScript() {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- actually executing the generated inline script is the point of these tests
  new Function(THEME_BOOTSTRAP_SCRIPT)()
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('THEME_BOOTSTRAP_SCRIPT', () => {
  it('is generated from THEME_STORAGE_KEY, so the key cannot drift from theme.ts', () => {
    expect(THEME_BOOTSTRAP_SCRIPT).toContain(`localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})`)
  })

  it('pre-paints light for a stored "light" choice', () => {
    stubMatchMedia(false)
    localStorage.setItem(THEME_STORAGE_KEY, 'light')
    runBootstrapScript()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('leaves the attribute absent for a stored "dark" choice, even when the OS prefers light', () => {
    stubMatchMedia(true)
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    runBootstrapScript()
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  it('falls back to the OS preference when the stored value is missing or invalid', () => {
    stubMatchMedia(true)
    localStorage.setItem(THEME_STORAGE_KEY, 'system')
    runBootstrapScript()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')

    document.documentElement.removeAttribute('data-theme')
    localStorage.clear()
    stubMatchMedia(false)
    runBootstrapScript()
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  it('agrees with resolveInitialTheme (its importable mirror in theme.ts) in every scenario', () => {
    const scenarios: { stored: string | null; prefersLight: boolean }[] = [
      { stored: 'light', prefersLight: false },
      { stored: 'dark', prefersLight: true },
      { stored: 'not-a-theme', prefersLight: true },
      { stored: 'not-a-theme', prefersLight: false },
      { stored: null, prefersLight: true },
      { stored: null, prefersLight: false },
    ]
    for (const { stored, prefersLight } of scenarios) {
      localStorage.clear()
      document.documentElement.removeAttribute('data-theme')
      if (stored !== null) localStorage.setItem(THEME_STORAGE_KEY, stored)
      stubMatchMedia(prefersLight)

      runBootstrapScript()
      const painted = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
      expect(painted, `stored=${String(stored)} prefersLight=${String(prefersLight)}`).toBe(resolveInitialTheme())
    }
  })
})

describe('themeBootstrapPlugin', () => {
  it('injects exactly one head-prepend script tag carrying the current bootstrap script', () => {
    const tags = themeBootstrapTags()
    expect(tags).toHaveLength(1)
    expect(tags[0]).toEqual({ tag: 'script', children: THEME_BOOTSTRAP_SCRIPT, injectTo: 'head-prepend' })
  })

  it('injects the identical tags for every HTML entry it is handed', () => {
    const plugin = themeBootstrapPlugin()
    expect(plugin.name).toBe(THEME_BOOTSTRAP_PLUGIN_NAME)
    const hook = plugin.transformIndexHtml
    if (hook === undefined || typeof hook === 'function' || !('handler' in hook)) {
      throw new Error('expected an object-form transformIndexHtml hook')
    }
    const handler = hook.handler as (html: string, ctx: IndexHtmlTransformContext) => unknown
    const ctx = {} as IndexHtmlTransformContext
    const outputs = ['<!doctype html><html><head></head></html>', '<html><head><title>sources</title></head></html>'].map((html) =>
      handler(html, ctx),
    )
    expect(outputs[0]).toEqual(themeBootstrapTags())
    expect(outputs[1]).toEqual(outputs[0])
  })
})
