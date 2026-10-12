import { test, expect } from '@playwright/test'

/*
 * public/404.html, in a real browser.
 *
 * It is requested here by its own path rather than through a bad URL,
 * deliberately. The 404 *status* and the internal redirect that serves this
 * body are nginx's job, and the dev server these specs run against has no
 * part in either: Vite answers every unknown path with index.html and a 200,
 * in `vite dev` and `vite preview` alike (measured, both). A "visit a bad URL
 * and expect the 404 page" assertion here would therefore be asserting
 * against the dev server's SPA fallback, not against the behaviour that
 * ships. scripts/verify-nginx.sh covers that half — status, the branded body,
 * the headers and the no-cache rule — against the real nginx.conf in CI's
 * nginx job. What is left, and what only a browser can check, is the page
 * itself: that it renders, themes itself and gets the visitor home.
 */
const PATH = '/404.html'

test.describe('the 404 page', () => {
  test('says what happened and offers a way back', async ({ page }) => {
    await page.goto(PATH)

    await expect(page).toHaveTitle('Page not found · Can I Afford That?')
    await expect(page.getByRole('heading', { level: 1, name: "This page doesn't exist" })).toBeVisible()
    await expect(page.getByText('ERROR 404')).toBeVisible()
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex')
  })

  test('the home link returns to the calculator', async ({ page }) => {
    await page.goto(PATH)
    await page.getByRole('link', { name: 'Back to the calculator' }).click()

    // Landed on the real app, not another copy of the error page.
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { name: 'What are you saving for?' })).toBeVisible()
  })

  test('the home link works with JavaScript disabled', async ({ browser }) => {
    // The case this page exists for includes "the bundle never ran", so the
    // way out must not need it. A plain <a href> does not, but a regression
    // to a JS-driven button would pass every other test here.
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()
    await page.goto(PATH)

    await expect(page.getByRole('heading', { level: 1, name: "This page doesn't exist" })).toBeVisible()
    await page.getByRole('link', { name: 'Back to the calculator' }).click()
    await expect(page).toHaveURL(/\/$/)
    await context.close()
  })

  test('renders at 320px with no horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 600 })
    await page.goto(PATH)

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)

    // And the copy keeps the 16px gutter rather than running to the edge.
    const box = await page.getByRole('heading', { level: 1 }).boundingBox()
    expect(box?.x).toBeGreaterThanOrEqual(16)
  })

  test("follows the visitor's colour scheme", async ({ page }) => {
    const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor)

    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto(PATH)
    // --bg-dark-1, #14121f.
    expect(await background()).toBe('rgb(20, 18, 31)')

    await page.emulateMedia({ colorScheme: 'light' })
    // The light theme's --bg-dark-1, #faf9fc.
    expect(await background()).toBe('rgb(250, 249, 252)')

    // The heading has to stay readable against whichever one is showing, so
    // the text colour must flip with it rather than only the background.
    const headingColor = await page.getByRole('heading', { level: 1 }).evaluate((el) => getComputedStyle(el).color)
    expect(headingColor).toBe('rgb(27, 22, 51)')
  })
})
