// @vitest-environment jsdom
// The gate that stops Vercel's two analytics scripts being requested on builds
// that aren't on Vercel. Both sides matter: left open it 404s twice per page on
// the self-hosted Docker/nginx build, and closed by mistake it would silently
// end analytics on production.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { VercelInsights, ON_VERCEL } from './VercelInsights'

/**
 * The `<script>` tags Vercel's two components inject, identified by the
 * `data-sdkn` (SDK name) attribute they tag themselves with.
 *
 * Deliberately not matched on the src URL: in a dev or test build both
 * packages point at their `script.debug.js` on `va.vercel-scripts.com`, and
 * only a production build uses the `/_vercel/…` path. `data-sdkn` is the same
 * either way, so this asserts "the component mounted" rather than "this build
 * happened to choose the production URL".
 */
function injectedSdkNames(): string[] {
  return [...document.querySelectorAll('script[data-sdkn]')].map((script) => script.getAttribute('data-sdkn') ?? '')
}

afterEach(() => {
  cleanup()
  // The components append to <head>, which testing-library's cleanup doesn't
  // touch — left behind, they'd leak into the next test's assertions.
  for (const script of document.querySelectorAll('script[data-sdkn]')) script.remove()
  vi.restoreAllMocks()
})

describe('ON_VERCEL', () => {
  // Vitest runs through the same vite.config.ts, so this is the real `define`
  // being evaluated with no VERCEL variable set — the self-hosted case.
  it('is false when the build has no VERCEL environment variable', () => {
    expect(ON_VERCEL).toBe(false)
  })

  // Not a formality: reading this through `import.meta.env` instead hands back
  // the *string* 'false', which is truthy and would leave the gate open
  // everywhere. The `__ON_VERCEL__` define keeps it a real boolean.
  it('is a boolean, not a truthy string from the environment', () => {
    expect(typeof ON_VERCEL).toBe('boolean')
  })
})

describe('VercelInsights', () => {
  it('renders nothing at all when the gate is closed', () => {
    const { container } = render(<VercelInsights enabled={false} />)
    expect(container.innerHTML).toBe('')
    expect(injectedSdkNames()).toEqual([])
  })

  it('injects no analytics script by default off Vercel', () => {
    const { container } = render(<VercelInsights />)
    expect(container.innerHTML).toBe('')
    expect(injectedSdkNames()).toEqual([])
    // Belt and braces on the exact path that was 404ing.
    expect(document.querySelectorAll('script[src*="/_vercel/"]')).toHaveLength(0)
  })

  it('mounts both Speed Insights and Analytics when the gate is open', () => {
    render(<VercelInsights enabled />)
    expect(injectedSdkNames().toSorted()).toEqual(['@vercel/analytics/react', '@vercel/speed-insights/react'])
  })
})
