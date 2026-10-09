import { test, expect, devices } from '@playwright/test'

// A real touch device, not synthetic events. Playwright's `tap()` on a
// `hasTouch` context fires the genuine touchstart/touchend/synthetic-
// mouseenter order that leaves a mouse-driven hover style stuck on after a
// tap (#116, and #158 for the theme toggle). The unit tests reproduce that
// order by hand; this proves the order itself is what a browser sends, and
// that all three top-right controls now survive it together.
//
// A whole spec file rather than a `describe` block: `test.use` with a device
// profile has to be top-level, since changing the browser type forces a new
// worker.
test.use({ ...devices['Pixel 7'] })

/** The inline `background` the component sets, which is what these controls drive off `hovered`. */
async function background(locator: import('@playwright/test').Locator): Promise<string | null> {
  return locator.evaluate((element) => (element as HTMLElement).style.background)
}

test.describe('top-right controls after a real tap', () => {
  test('a tap on the theme toggle flips the theme and leaves it on the resting pill background', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')

    const toggle = page.getByTestId('theme-toggle')
    expect(await background(toggle)).toBe('var(--pill-bg)')

    await toggle.tap()

    // The tap still does its job — the hover fix must not swallow the click.
    await expect(toggle).toHaveAttribute('aria-label', 'Switch to dark theme')
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('light')

    // ...and the button is not left lit.
    expect(await background(toggle)).toBe('var(--pill-bg)')
  })

  test('the sources link does not stick either — the toggle now matches its neighbours', async ({ page }) => {
    // The parity this is really about: before #158 a tap left the toggle on
    // --pill-bg-hover while the pill beside it came back to --pill-bg.
    await page.goto('/')

    const link = page.getByRole('link', { name: 'Our sources' })
    // Tapping it would navigate (target=_blank), so dispatch the tap gesture
    // without following the link, which is all the hover state needs.
    await link.dispatchEvent('touchstart')
    await link.dispatchEvent('touchend')
    await link.dispatchEvent('mouseenter')

    expect(await background(link)).toBe('var(--pill-bg)')
    expect(await background(page.getByTestId('theme-toggle'))).toBe('var(--pill-bg)')
  })
})
