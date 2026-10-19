import { test, expect, devices, type Locator } from '@playwright/test'

// The goal carousel's own controls, on a real touch device. Same defect and
// same proof as pill-hover-touch.spec.ts covers for the top-right pills
// (#116, #158): `tap()` on a `hasTouch` context fires the genuine
// touchstart/touchend/synthetic-mouseenter order, with no mouseleave, which
// is what used to leave these two stuck in their hover style (#205). Their
// hover is now CSS behind `@media (hover: hover)`, so these compare what the
// user sees, the computed style, before and after a tap.
//
// A whole spec file rather than a `describe` block: `test.use` with a device
// profile has to be top-level, since changing the browser type forces a new
// worker.
test.use({ ...devices['Pixel 7'] })

/** The background the user sees, resolved from whatever CSS applies. */
async function background(locator: Locator): Promise<string> {
  return locator.evaluate((element) => getComputedStyle(element).backgroundColor)
}

/** The transform the user sees; a CTA at rest computes to the identity matrix. */
async function transform(locator: Locator): Promise<string> {
  return locator.evaluate((element) => getComputedStyle(element).transform)
}

test.describe('goal carousel controls after a real tap', () => {
  test('the "Next goal" arrow moves the carousel and is left on its resting background', async ({ page }) => {
    await page.goto('/')

    const next = page.getByRole('button', { name: 'Next goal' })
    const resting = await background(next)

    await next.tap()

    // The tap still does its job. The carousel opens on Vehicle, so one step
    // right lands on Holiday.
    await expect(page.getByRole('button', { name: 'Get started with Holiday', exact: true })).toBeVisible()
    // ...and the arrow is not left lit.
    expect(await background(next)).toBe(resting)
  })

  test('the "Get started" CTA selects the goal and is left unlifted', async ({ page }) => {
    await page.goto('/')

    const cta = page.getByRole('button', { name: 'Get started with Vehicle', exact: true })
    const resting = await transform(cta)

    await cta.tap()

    // The goal was selected: the vehicle Details step is now reachable.
    await expect(page.getByPlaceholder('e.g. Volkswagen Golf')).toBeVisible()

    // The CTA is still in the DOM (the carousel stays rendered above the
    // flow), and must not be lifted: the issue noted it was still lifted after
    // scrolling back up to it.
    expect(await transform(cta)).toBe(resting)
  })

  test('the previous-goal arrow does not stick either', async ({ page }) => {
    await page.goto('/')

    const previous = page.getByRole('button', { name: 'Previous goal' })
    const resting = await background(previous)
    await previous.tap()

    // Left from the first goal wraps to the last, Mortgage.
    await expect(page.getByRole('button', { name: 'Mortgage (coming soon)' })).toBeVisible()
    expect(await background(previous)).toBe(resting)
  })
})
