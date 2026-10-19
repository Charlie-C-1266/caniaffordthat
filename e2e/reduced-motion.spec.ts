import { test, expect, type Page } from '@playwright/test'

// The project config emulates reduced motion so the goal carousel's
// auto-rotate can't move focus mid-test. For a long time it set
// `use.reducedMotion`, which isn't a test option, so the browser quietly ran
// with full motion and the suite only stayed deterministic because most specs
// happened to click a carousel dot first (#228). These pin that the setting
// reaches the browser, and that a spec can still opt back into motion the
// way goal-carousel-slide.spec.ts does.

/** Whether the page's browser context reports `prefers-reduced-motion: reduce`. */
async function prefersReducedMotion(page: Page): Promise<boolean> {
  await page.goto('/')
  return page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
}

test('every spec runs with reduced motion unless it opts out', async ({ page }) => {
  expect(await prefersReducedMotion(page)).toBe(true)
})

test.describe('a spec that opts back into motion', () => {
  test.use({ contextOptions: { reducedMotion: 'no-preference' } })

  test('gets full motion', async ({ page }) => {
    expect(await prefersReducedMotion(page)).toBe(false)
  })
})
