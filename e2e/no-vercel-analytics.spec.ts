import { test, expect } from '@playwright/test'

// Vercel's Speed Insights and Analytics scripts are served from /_vercel/, a
// path only Vercel's edge answers. Before #176 all four entry points mounted
// them unconditionally, so every page of the self-hosted Docker/nginx build
// and of `vite preview` fetched two scripts that 404.
//
// These specs run against the local dev server, which is by definition a
// non-Vercel build (no VERCEL environment variable), so they pin the gate shut
// exactly where the bug was. The open side is covered by
// src/components/VercelInsights.test.tsx.

/** Every page of the site: the calculator plus the three docs pages. */
const PAGES = ['/', '/sources/', '/methodology/salary/', '/methodology/vehicle/']

/**
 * Both Vercel packages tag the `<script>` they inject with `data-sdkn` (SDK
 * name). That marker — not the script's URL — is what this asserts on, because
 * in a dev build the packages load `script.debug.js` from
 * `va.vercel-scripts.com` and only a production build uses the `/_vercel/…`
 * path. Matching on `/_vercel/` alone would therefore pass against the dev
 * server even with the gate wide open, which is no guard at all.
 */
const SDK_SCRIPT = 'script[data-sdkn]'

for (const path of PAGES) {
  test(`${path} mounts no Vercel analytics and logs no failed resource`, async ({ page }) => {
    const vercelRequests: string[] = []
    const failedResources: string[] = []

    page.on('request', (request) => {
      if (request.url().includes('/_vercel/')) vercelRequests.push(request.url())
    })
    page.on('console', (message) => {
      if (message.type() === 'error' && message.text().includes('Failed to load resource')) {
        failedResources.push(message.text())
      }
    })

    await page.goto(path)
    // The analytics components inject their <script> on mount, so wait for the
    // app to render rather than asserting against an empty network log.
    await page.waitForLoadState('load')
    await expect(page.locator('#root')).not.toBeEmpty()
    await page.waitForTimeout(1500)

    // The assertion that actually pins the gate, in any build mode.
    expect(await page.locator(SDK_SCRIPT).count(), `a Vercel analytics script was injected on ${path}`).toBe(0)
    expect(vercelRequests, `unexpected /_vercel/ request(s) on ${path}`).toEqual([])
    expect(failedResources, `failed resource load(s) on ${path}`).toEqual([])
  })
}
