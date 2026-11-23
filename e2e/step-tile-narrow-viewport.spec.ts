import { test, expect, type Page } from '@playwright/test'

// #316: on a phone the content inside a step tile was squeezed into a strip
// down the middle. StepPanel padded every step `120px 40px` and each step
// passed its Tile a fixed desktop padding (44-48px a side), and neither
// shrank — so at 320px, 180px of the 320px went on gutters and padding and
// the form got 140-148px, 44% of the screen.
//
// The gutters and the tile padding are custom properties now, tightened under
// a 600px media query. The right-hand gutter stays wider than the left
// because ProgressRail is `position: fixed` on that edge, so these also check
// that nothing in the tile ends up underneath it.

const PHONE_WIDTHS = [320, 360, 390] as const

/** The content width each phone width has to leave inside the tile, from the issue. */
const MIN_CONTENT: Record<number, number> = { 320: 230, 360: 270, 390: 270 }

/** Every tile's desktop content width, which must not move. The figures are the issue's own table. */
const DESKTOP_CONTENT: Record<string, number> = {
  Details: 548,
  Budget: 580,
  Plan: 540,
  'Paying for it': 548,
  'Running costs': 580,
}

/**
 * The big-purchase flow in salary mode with every deduction line showing and
 * "About your pay" open — the reproduction link from the issue.
 */
const BIG_SALARY =
  '/?goalId=big&mode=save&saveFlavor=goal&itemPrice=1200&takeHomeMode=salary&grossSalary=35000&takeHome=2234.52' +
  '&studentPlan=plan2&postgradLoan=1&pensionArrangement=sacrifice&pensionMode=amount&pensionMonthlyAmount=150' +
  '&housing=500&utilities=0&groceries=0&transport=0&debts=0&savings=0&savingsMonthly=100'

/** The same flow in take-home mode, so "About your pay" starts closed. */
const BIG_TAKE_HOME =
  '/?goalId=big&mode=save&saveFlavor=goal&itemPrice=1200&takeHome=2500' +
  '&housing=500&utilities=0&groceries=0&transport=0&debts=0&savings=0&savingsMonthly=100'

const CAR =
  '/?goalId=car&itemPrice=22000&takeHome=2600&vehicleMethod=pcp&balloonMode=known&balloonAmount=9500' +
  '&housing=500&utilities=0&groceries=0&transport=0&debts=0&savingsMonthly=100'

/** The visible step tile: the card-bordered box inside the panel on screen, measured inside its padding and border. */
async function tileMetrics(page: Page) {
  return page.evaluate(() => {
    const tile = [...document.querySelectorAll('div')].find((element) => {
      const rect = element.getBoundingClientRect()
      return getComputedStyle(element).borderTopWidth === '2px' && rect.width > 100 && rect.top < window.innerHeight && rect.bottom > 0
    })
    if (!tile) throw new Error('no step tile on screen')

    const style = getComputedStyle(tile)
    const rect = tile.getBoundingClientRect()
    const borderX = parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth)
    const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)

    // Where the rail's dots start, and how far right anything focusable in
    // the tile reaches.
    const dots = [...document.querySelectorAll('nav[aria-label="Step progress"] span')].map((dot) => dot.getBoundingClientRect())
    const controls = [...tile.querySelectorAll('button, input, a, select, textarea')]
      .map((control) => control.getBoundingClientRect())
      .filter((box) => box.width > 0 && box.height > 0)

    return {
      tileWidth: Math.round(rect.width),
      contentWidth: Math.round(rect.width - padX - borderX),
      railLeft: Math.round(Math.min(...dots.map((dot) => dot.left))),
      controlsRight: controls.length === 0 ? 0 : Math.round(Math.max(...controls.map((box) => box.right))),
      contentRight: Math.round(rect.right - parseFloat(style.paddingRight) - parseFloat(style.borderRightWidth)),
    }
  })
}

/** Opens `link` at `width` in `theme` and scrolls to `step`. */
async function goToStep(page: Page, link: string, step: string, width: number, theme: 'dark' | 'light' = 'dark') {
  await page.setViewportSize({ width, height: 900 })
  await page.goto(link)
  await page.evaluate((chosen) => document.documentElement.setAttribute('data-theme', chosen), theme)
  await page.getByLabel('Step progress').getByRole('button', { name: step, exact: true }).click()
  // The tile has slid in and settled before anything is measured.
  await expect(page.getByLabel('Step progress').getByRole('button', { name: step, exact: true })).toHaveAttribute('aria-current', 'step')
}

test.describe('step tiles at a narrow viewport', () => {
  for (const width of PHONE_WIDTHS) {
    for (const step of ['Details', 'Budget', 'Plan'] as const) {
      test(`the ${step} tile leaves at least ${MIN_CONTENT[width]}px of content at ${width}px`, async ({ page }) => {
        await goToStep(page, BIG_SALARY, step, width)
        const { contentWidth } = await tileMetrics(page)
        expect(contentWidth).toBeGreaterThanOrEqual(MIN_CONTENT[width])
      })
    }

    for (const step of ['Paying for it', 'Running costs'] as const) {
      test(`the vehicle ${step} tile gains the same room at ${width}px`, async ({ page }) => {
        await goToStep(page, CAR, step, width)
        const { contentWidth } = await tileMetrics(page)
        expect(contentWidth).toBeGreaterThanOrEqual(MIN_CONTENT[width])
      })
    }

    for (const theme of ['dark', 'light'] as const) {
      test(`nothing in the Budget tile reaches the progress rail at ${width}px in ${theme} mode`, async ({ page }) => {
        // Salary mode with "About your pay" open is the busiest the tile
        // gets: the payslip, both loan rows and the pension fields.
        await goToStep(page, BIG_SALARY, 'Budget', width, theme)
        await page.getByRole('button', { name: /^About your pay/ }).click()

        const { railLeft, controlsRight, contentRight } = await tileMetrics(page)
        expect(controlsRight).toBeGreaterThan(0)
        expect(controlsRight).toBeLessThan(railLeft)
        expect(contentRight).toBeLessThan(railLeft)
      })
    }

    test(`the Budget tile in take-home mode, with the section closed, has the room too at ${width}px`, async ({ page }) => {
      await goToStep(page, BIG_TAKE_HOME, 'Budget', width)
      await expect(page.getByRole('button', { name: /^About your pay/ })).toHaveAttribute('aria-expanded', 'false')

      const { contentWidth, railLeft, controlsRight } = await tileMetrics(page)
      expect(contentWidth).toBeGreaterThanOrEqual(MIN_CONTENT[width])
      expect(controlsRight).toBeLessThan(railLeft)
    })
  }

  test('the Workplace pension choice fits on one row at 390px', async ({ page }) => {
    await goToStep(page, BIG_SALARY, 'Budget', 390)
    await page.getByRole('button', { name: /^About your pay/ }).click()

    const pill = page.locator('button', { hasText: /^Net pay$/ }).locator('..')
    const rows = await pill.evaluate((el) => new Set([...el.children].map((child) => Math.round(child.getBoundingClientRect().top))).size)
    expect(rows).toBe(1)
  })

  for (const [name, link, steps] of [
    ['big purchase', BIG_SALARY, ['Details', 'Budget', 'Plan', 'Result']],
    ['vehicle', CAR, ['Details', 'Paying for it', 'Running costs', 'Budget', 'Result']],
  ] as const) {
    // One test per step, so no await sits inside a loop and a failure names
    // the step that overflowed.
    for (const step of steps) {
      test(`the ${name} flow's ${step} step does not scroll sideways at 320px`, async ({ page }) => {
        await goToStep(page, link, step, 320)
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
        expect(overflow).toBeLessThanOrEqual(0)
      })
    }
  }

  // The regression half: desktop must not move by a pixel.
  for (const [step, link] of [
    ['Details', BIG_SALARY],
    ['Budget', BIG_SALARY],
    ['Plan', BIG_SALARY],
    ['Paying for it', CAR],
    ['Running costs', CAR],
  ] as const) {
    test(`the ${step} tile is unchanged at 1280px`, async ({ page }) => {
      await goToStep(page, link, step, 1280)
      const { contentWidth } = await tileMetrics(page)
      expect(contentWidth).toBe(DESKTOP_CONTENT[step])
    })
  }
})
