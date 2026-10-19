import { test, expect, type Locator, type Page } from '@playwright/test'

// The other half of pill-hover-touch.spec.ts and goal-picker-hover-touch.spec.ts.
// The controls' hover styles are CSS behind `@media (hover: hover)`, which
// keeps a tap on a touch screen from setting them off. This checks that a real
// mouse still gets them: on the desktop project's context, whose pointer can
// hover, each control is hovered for real, must change, and must go back when
// the pointer leaves.

/** What a colour token resolves to as a background on this page, for comparing against a computed colour. */
async function resolvedBackground(page: Page, token: string): Promise<string> {
  return page.evaluate((value) => {
    const probe = document.createElement('div')
    probe.style.background = value
    document.body.append(probe)
    const colour = getComputedStyle(probe).backgroundColor
    probe.remove()
    return colour
  }, `var(${token})`)
}

/** The background the user sees, resolved from whatever CSS applies. */
async function background(locator: Locator): Promise<string> {
  return locator.evaluate((element) => getComputedStyle(element).backgroundColor)
}

/** Moves the pointer to the page's top-left corner, clear of every control. */
async function pointerAway(page: Page) {
  await page.mouse.move(0, 0)
}

const BACKGROUND_HOVERS: readonly { name: string; locate: (page: Page) => Locator; resting: string; hovered: string }[] = [
  { name: 'the sources link', locate: (page) => page.getByTestId('sources-link'), resting: '--pill-bg', hovered: '--pill-bg-hover' },
  { name: 'the theme toggle', locate: (page) => page.getByTestId('theme-toggle'), resting: '--pill-bg', hovered: '--pill-bg-hover' },
  { name: 'Start over', locate: (page) => page.getByTestId('start-over'), resting: '--pill-bg', hovered: '--pill-bg-hover' },
  {
    name: 'the previous-goal arrow',
    locate: (page) => page.getByRole('button', { name: 'Previous goal' }),
    resting: '--tile-bg',
    hovered: '--surface-selected',
  },
  {
    name: 'the next-goal arrow',
    locate: (page) => page.getByRole('button', { name: 'Next goal' }),
    resting: '--tile-bg',
    hovered: '--surface-selected',
  },
]

/** A CTA at rest, and lifted 2px by its hover. */
const UNLIFTED = 'matrix(1, 0, 0, 1, 0, 0)'
const LIFTED = 'matrix(1, 0, 0, 1, 0, -2)'

test.describe('hover styles for a real mouse', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Next goal' }).waitFor()
    await pointerAway(page)
  })

  for (const { name, locate, resting, hovered } of BACKGROUND_HOVERS) {
    test(`${name} takes its hover background, and drops it when the pointer leaves`, async ({ page }) => {
      const control = locate(page)
      const restingColour = await resolvedBackground(page, resting)
      const hoveredColour = await resolvedBackground(page, hovered)
      // Otherwise the test couldn't tell a hover from no hover.
      expect(hoveredColour).not.toBe(restingColour)

      expect(await background(control)).toBe(restingColour)
      await control.hover()
      await expect.poll(() => background(control)).toBe(hoveredColour)
      await pointerAway(page)
      await expect.poll(() => background(control)).toBe(restingColour)
    })
  }

  test('the "Get started" CTA lifts while hovered, and settles when the pointer leaves', async ({ page }) => {
    const cta = page.getByRole('button', { name: 'Get started with Vehicle', exact: true })
    await expect(cta).toHaveCSS('transform', UNLIFTED)
    await cta.hover()
    await expect(cta).toHaveCSS('transform', LIFTED)
    await pointerAway(page)
    await expect(cta).toHaveCSS('transform', UNLIFTED)
  })

  test('a disabled "Coming soon" CTA does not lift, since nothing suggests it can be pressed', async ({ page }) => {
    await page.getByRole('button', { name: 'Go to Mortgage' }).click()
    const soon = page.getByRole('button', { name: 'Coming soon', exact: true })
    await expect(soon).toBeDisabled()
    // `force`: Playwright otherwise waits for a disabled element to become
    // actionable before moving the pointer onto it.
    await soon.hover({ force: true })
    // Longer than the CTA's own transition, so a lift would have shown by now.
    await page.waitForTimeout(400)
    await expect(soon).toHaveCSS('transform', UNLIFTED)
  })
})
