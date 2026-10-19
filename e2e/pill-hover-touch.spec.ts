import { test, expect, devices, type Locator } from '@playwright/test'

// A real touch device, not synthetic events. Playwright's `tap()` on a
// `hasTouch` context fires the genuine touchstart/touchend/synthetic-
// mouseenter order that used to leave a mouse-driven hover style stuck on
// after a tap (#116, and #158 for the theme toggle). The hover is now CSS
// behind `@media (hover: hover)`, which a touch screen doesn't match, so these
// check what the user actually sees, the computed background, rather than
// any inline style. hover-styles.spec.ts proves the same hover does still
// apply for a real mouse.
//
// A whole spec file rather than a `describe` block: `test.use` with a device
// profile has to be top-level, since changing the browser type forces a new
// worker.
test.use({ ...devices['Pixel 7'] })

/** The background the user sees, resolved from whatever CSS applies. */
async function background(locator: Locator): Promise<string> {
  return locator.evaluate((element) => getComputedStyle(element).backgroundColor)
}

test.describe('top-right controls after a real tap', () => {
  test('a tap on the theme toggle flips the theme and leaves it on the resting pill background', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')

    const toggle = page.getByTestId('theme-toggle')
    await toggle.tap()

    // The tap still does its job: the theme flipped.
    await expect(toggle).toHaveAttribute('aria-label', 'Switch to dark theme')
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('light')

    // ...and the button is not left lit. The resting background is read after
    // the tap, because the flip changed the theme and with it the pill colour;
    // moving focus and the pointer away settles any hover the tap left behind.
    const afterTap = await background(toggle)
    await page.mouse.move(0, 0)
    await toggle.blur()
    expect(await background(toggle)).toBe(afterTap)
  })

  test('the sources link beside it is not lit by a pointer resting on it', async ({ page }) => {
    // Tapping it would navigate (target=_blank), so the pointer is moved onto
    // it instead: on a touch screen, nothing short of that could hover it.
    await page.goto('/')

    const link = page.getByRole('link', { name: 'Our sources' })
    const resting = await background(link)
    await link.hover()

    expect(await background(link)).toBe(resting)
  })
})
