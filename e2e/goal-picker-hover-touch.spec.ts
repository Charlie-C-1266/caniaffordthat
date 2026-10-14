import { test, expect, devices } from '@playwright/test'

// The goal carousel's own controls, on a real touch device. Same defect and
// same proof as pill-hover-touch.spec.ts covers for the top-right pills
// (#116, #158): `tap()` on a `hasTouch` context fires the genuine
// touchstart/touchend/synthetic-mouseenter order, with no mouseleave, which
// is what left these two stuck in their hover style (#205). The unit tests
// reproduce that order by hand; this proves the order is what a browser
// actually sends, and that both controls survive it.
//
// A whole spec file rather than a `describe` block: `test.use` with a device
// profile has to be top-level, since changing the browser type forces a new
// worker.
test.use({ ...devices['Pixel 7'] })

const ARROW_RESTING = 'var(--tile-bg)'
// Matched rather than compared: the component writes `translateY(0)` and the
// browser serialises it back as `translateY(0px)`. (jsdom does not, which is
// why GoalPickerStep.test.tsx can compare the string directly.)
const CTA_RESTING = /^translateY\(0(px)?\)$/

/** The inline `background` the arrows drive off `hovered`. */
async function background(locator: import('@playwright/test').Locator): Promise<string | null> {
  return locator.evaluate((element) => (element as HTMLElement).style.background)
}

/** The inline `transform` the CTA drives off `hovered`. */
async function transform(locator: import('@playwright/test').Locator): Promise<string | null> {
  return locator.evaluate((element) => (element as HTMLElement).style.transform)
}

test.describe('goal carousel controls after a real tap', () => {
  test('the "Next goal" arrow moves the carousel and is left on its resting background', async ({ page }) => {
    await page.goto('/')

    const next = page.getByRole('button', { name: 'Next goal' })
    expect(await background(next)).toBe(ARROW_RESTING)

    await next.tap()

    // The tap still does its job — the hover guard must not swallow it. The
    // carousel opens on Vehicle, so one step right lands on Holiday.
    await expect(page.getByRole('button', { name: 'Get started with Holiday', exact: true })).toBeVisible()
    // ...and the arrow is not left lit.
    expect(await background(next)).toBe(ARROW_RESTING)
  })

  test('the "Get started" CTA selects the goal and is left unlifted', async ({ page }) => {
    await page.goto('/')

    const cta = page.getByRole('button', { name: 'Get started with Vehicle', exact: true })
    expect(await transform(cta)).toMatch(CTA_RESTING)

    await cta.tap()

    // The goal was selected: the vehicle Details step is now reachable.
    await expect(page.getByPlaceholder('e.g. Volkswagen Golf')).toBeVisible()

    // The CTA is still in the DOM (the carousel stays rendered above the
    // flow), and must have settled rather than staying lifted — the issue
    // noted it was still lifted after scrolling back up to it.
    expect(await transform(cta)).toMatch(CTA_RESTING)
  })

  test('the previous-goal arrow does not stick either', async ({ page }) => {
    await page.goto('/')

    const previous = page.getByRole('button', { name: 'Previous goal' })
    await previous.tap()

    // Left from the first goal wraps to the last, Mortgage.
    await expect(page.getByRole('button', { name: 'Mortgage (coming soon)' })).toBeVisible()
    expect(await background(previous)).toBe(ARROW_RESTING)
  })
})
