import { test, expect, type Page } from '@playwright/test'

// 360px is the narrowest width this app supports; 375 and 414 are the common
// phone viewports, and 600 is the breakpoint where the compact carousel
// geometry gives way to the full cover-flow spread.
const NARROW_WIDTHS = [360, 375, 414, 600]

async function pageOverflow(page: Page) {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }))
}

async function expectNoHorizontalOverflow(page: Page) {
  const { scrollWidth, innerWidth } = await pageOverflow(page)
  expect(scrollWidth, `page scroll width ${scrollWidth} should not exceed the ${innerWidth}px viewport`).toBeLessThanOrEqual(innerWidth)
}

test.describe('goal carousel at narrow viewports', () => {
  for (const width of NARROW_WIDTHS) {
    test(`the goal-picker step doesn't force page-level horizontal scroll at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 812 })
      await page.goto('/')
      await page.getByRole('button', { name: 'Previous goal' }).waitFor()

      await expectNoHorizontalOverflow(page)
    })
  }

  test('the cards are contained by the carousel, not spilling past the screen edge', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    const stage = page.getByTestId('goal-carousel')
    await stage.waitFor()

    // The stage clips horizontally, so whatever the cards' own boxes say, only
    // the part inside this box is painted — it's the box that has to fit.
    const box = await stage.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(375)
    await expect(stage).toHaveCSS('overflow-x', 'clip')

    // The vertical axis stays visible so the focused card's glow isn't cut off
    // — `hidden` on one axis would force the other to `auto` and clip it.
    await expect(stage).toHaveCSS('overflow-y', 'visible')
  })

  test('prev/next arrows still move the carousel at a phone width', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')

    await page.getByRole('button', { name: 'Go to Vehicle' }).click()
    await expect(page.getByRole('button', { name: 'Get started with Vehicle', exact: true })).toBeVisible()

    // Left from the first goal wraps to the last, Mortgage.
    await page.getByRole('button', { name: 'Previous goal' }).click()
    await expect(page.getByRole('button', { name: 'Coming soon', exact: true })).toBeDisabled()

    await page.getByRole('button', { name: 'Next goal' }).click()
    await expect(page.getByRole('button', { name: 'Get started with Vehicle', exact: true })).toBeVisible()

    await expectNoHorizontalOverflow(page)
  })

  test('dot navigation still selects a goal at a phone width', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')

    await page.getByRole('button', { name: 'Go to Emergency fund' }).click()
    await expect(page.getByRole('button', { name: 'Get started with Emergency fund', exact: true })).toBeVisible()

    await expectNoHorizontalOverflow(page)
  })

  test('tapping a card still focuses it, and tapping the focused card starts the flow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')

    await page.getByRole('button', { name: 'Go to Vehicle' }).click()

    // The neighbouring card only peeks past the focused one, but its centre
    // stays inside the clipped stage, so it's still a real tap target.
    await page.getByRole('button', { name: 'Focus Holiday' }).click()
    const focusedHoliday = page.getByRole('button', { name: 'Continue with Holiday' })
    await expect(focusedHoliday).toBeVisible()

    // Tapping the now-focused card selects it and moves on to Details.
    await focusedHoliday.click()
    await expect(page.getByPlaceholder('e.g. Two weeks in Italy')).toBeVisible()
  })

  test('the desktop cover-flow spread is unchanged', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/')
    await page.getByRole('button', { name: 'Go to Vehicle' }).click()

    // Full-size cards, stepped at the design's 268px: the focused card and its
    // neighbour sit 268px apart centre to centre.
    const focused = await page.getByRole('button', { name: 'Continue with Vehicle' }).boundingBox()
    const neighbour = await page.getByRole('button', { name: 'Focus Holiday' }).boundingBox()
    expect(focused!.width).toBe(250)
    const centreGap = neighbour!.x + neighbour!.width / 2 - (focused!.x + focused!.width / 2)
    expect(Math.round(centreGap)).toBe(268)

    await expectNoHorizontalOverflow(page)
  })
})
