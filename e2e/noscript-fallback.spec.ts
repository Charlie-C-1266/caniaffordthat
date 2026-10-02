import { test, expect } from '@playwright/test'

// With JavaScript disabled, blocked by a privacy extension, or simply failing
// to load, every entry point used to be an empty `#root` — a blank white
// screen with no explanation. These specs load each of the four URLs with
// scripting off and assert the fallback is what a visitor actually gets.
// Distinct from #35's error boundary, which covers a render error *after* the
// bundle has run.

const MESSAGE = /This calculator needs JavaScript to run/
const HEADING = 'Can I Afford That?'

/** The four HTML entry points, as vite.config.ts lists them. */
const ENTRIES = ['/', '/methodology/vehicle/', '/methodology/salary/', '/sources/'] as const

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  for (const url of ENTRIES) {
    test(`${url} shows the fallback instead of a blank page`, async ({ page }) => {
      await page.goto(url)

      await expect(page.getByRole('heading', { name: HEADING })).toBeVisible()
      await expect(page.getByText(MESSAGE)).toBeVisible()

      // The actual complaint in the issue: the page is not blank.
      const text = ((await page.locator('body').textContent()) ?? '').trim()
      expect(text.length).toBeGreaterThan(0)
    })
  }

  test('the fallback is legible, not browser defaults, in dark mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')

    const colors = await page.locator('.noscript-fallback').evaluate((el) => {
      const style = getComputedStyle(el)
      return { background: style.backgroundColor, text: style.color, body: getComputedStyle(document.body).backgroundColor }
    })
    // tokens.css --bg-dark-1 / --text-primary, not white-on-black defaults.
    expect(colors.background).toBe('rgb(20, 18, 31)')
    expect(colors.text).toBe('rgb(245, 243, 255)')
    expect(colors.body).toBe('rgb(20, 18, 31)')
  })

  test('the fallback is legible, not browser defaults, in light mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')

    const colors = await page.locator('.noscript-fallback').evaluate((el) => {
      const style = getComputedStyle(el)
      return { background: style.backgroundColor, text: style.color, body: getComputedStyle(document.body).backgroundColor }
    })
    // The light overrides of the same two tokens.
    expect(colors.background).toBe('rgb(250, 249, 252)')
    expect(colors.text).toBe('rgb(27, 22, 51)')
    expect(colors.body).toBe('rgb(250, 249, 252)')
  })

  test('the sources link on the calculator page works with JavaScript off', async ({ page }) => {
    await page.goto('/')

    // Not a dead end: the one page a no-JS visitor can still usefully read.
    await page.getByRole('link', { name: /how the numbers are worked out/ }).click()
    await expect(page).toHaveURL(/\/sources\/$/)
    // And the sources page's own fallback greets them there.
    await expect(page.getByRole('heading', { name: HEADING })).toBeVisible()
  })

  test('the message is readable at 320px with no horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 })
    await page.goto('/')

    await expect(page.getByText(MESSAGE)).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
})

test.describe('with JavaScript', () => {
  for (const url of ENTRIES) {
    test(`${url} does not leak the fallback text into the normal UI`, async ({ page }) => {
      await page.goto(url)

      // The app has mounted...
      await expect(page.locator('#root').locator('visible=true').first()).toBeVisible()
      // ...and the <noscript> content is inert: present in the markup, never rendered.
      await expect(page.getByText(MESSAGE)).toBeHidden()
      await expect(page.locator('.noscript-fallback')).toBeHidden()
    })
  }
})
