import { test, expect, type Locator, type Page } from '@playwright/test'

// #291 made every compact (`size="sm"`) SegmentedControl wrap so the five
// student-loan plans could fit on a phone. The comment said "Two-option
// toggles never get that wide" — but two other compact controls broke with
// it: "Monthly take-home / Annual salary" split onto two rows at every width
// up to about 430px, and the result's "Balance / Budget / Table" at 390px and
// below. A pill in two rows looks broken and no longer reads as either/or,
// and these are the first controls a phone user meets on those two steps.
//
// Measured the way the issue measured them: by comparing the `y` of every
// button in the control.

const PHONE_WIDTHS = [320, 360, 390] as const

/** The result's three views; whichever is selected is the widest segment. */
const VIEWS = ['Balance', 'Budget', 'Table'] as const

/** A complete plan, so the Budget step and a real result are both reachable from one link. */
const LINK =
  '/?goalId=big&mode=save&saveFlavor=goal&itemPrice=1200&takeHome=2500&housing=500' +
  '&utilities=0&groceries=0&transport=0&debts=0&savings=0&savingsMonthly=100'

/** The pill a given button sits in — the flex row whose wrapping is the thing under test. */
const pillContaining = (page: Page, label: string) => page.locator('button', { hasText: new RegExp(`^${label}$`) }).locator('..')

/** How many rows the buttons in `pill` occupy: one distinct top offset per row. */
async function rowCount(pill: Locator): Promise<number> {
  return pill.evaluate((el) => new Set([...el.children].map((child) => Math.round(child.getBoundingClientRect().top))).size)
}

/** Opens the shared link at `width` in `theme` and lands on the Budget step. */
async function goToBudget(page: Page, width: number, theme: 'dark' | 'light') {
  await page.setViewportSize({ width, height: 900 })
  await page.goto(LINK)
  await page.evaluate((chosen) => document.documentElement.setAttribute('data-theme', chosen), theme)
  await page.getByLabel('Step progress').getByRole('button', { name: 'Budget', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Monthly take-home' })).toBeVisible()
}

test.describe('compact segmented controls at a narrow viewport', () => {
  for (const width of PHONE_WIDTHS) {
    for (const theme of ['dark', 'light'] as const) {
      test(`the pay-mode toggle keeps both options on one row at ${width}px in ${theme} mode`, async ({ page }) => {
        await goToBudget(page, width, theme)
        expect(await rowCount(pillContaining(page, 'Monthly take-home'))).toBe(1)
      })

      test(`the pay-mode toggle stays on one row with salary mode selected at ${width}px in ${theme} mode`, async ({ page }) => {
        // The selected segment is the wider of the two here, so this is the
        // harder of the two states.
        await goToBudget(page, width, theme)
        await page.getByRole('button', { name: 'Annual salary' }).click()
        await expect(page.getByRole('button', { name: 'Annual salary' })).toHaveAttribute('aria-pressed', 'true')
        expect(await rowCount(pillContaining(page, 'Monthly take-home'))).toBe(1)
      })

      // One test per selected view: the active segment is wider than the
      // rest, so which one is selected changes the control's total width.
      for (const view of VIEWS) {
        test(`the result's view switcher keeps all three options on one row at ${width}px in ${theme} mode, on ${view}`, async ({
          page,
        }) => {
          await page.setViewportSize({ width, height: 900 })
          await page.goto(LINK)
          await page.evaluate((chosen) => document.documentElement.setAttribute('data-theme', chosen), theme)
          await page.getByLabel('Step progress').getByRole('button', { name: 'Result', exact: true }).click()
          await page.getByText('Copy result link').waitFor()

          const pill = pillContaining(page, 'Table')
          await pill.getByRole('button', { name: view, exact: true }).click()
          await expect(pill.getByRole('button', { name: view, exact: true })).toHaveAttribute('aria-pressed', 'true')
          expect(await rowCount(pill)).toBe(1)
        })
      }
    }
  }

  test('a pay-monthly result keeps its switcher on one row too', async ({ page }) => {
    // The other result shape: the chart's heading and figures differ, and the
    // switcher shares a wrapping flex row with that heading.
    await page.setViewportSize({ width: 360, height: 900 })
    await page.goto(`${LINK.replace('mode=save', 'mode=monthly')}&term=24&growth=6`)
    await page.getByLabel('Step progress').getByRole('button', { name: 'Result', exact: true }).click()
    await page.getByText('Copy result link').waitFor()

    const pill = pillContaining(page, 'Table')
    expect(await rowCount(pill)).toBe(1)

    // And it sits on a row of its own below the heading, rather than being
    // split across rows beside it: the two share a wrapping flex row, so at
    // this width the switcher should have dropped clear of the heading.
    const { headingBottom, pillTop } = await pill.evaluate((el) => {
      const row = el.parentElement as HTMLElement
      const heading = row.firstElementChild as HTMLElement
      return { headingBottom: heading.getBoundingClientRect().bottom, pillTop: el.getBoundingClientRect().top }
    })
    expect(pillTop).toBeGreaterThanOrEqual(headingBottom - 1)
  })

  test('the six-option student-loan plan row still takes a second row at 320px', async ({ page }) => {
    // #291's behaviour, kept: this is the one control that needs wrapping,
    // and it must not overflow instead.
    await goToBudget(page, 320, 'dark')
    await page.getByRole('button', { name: /^About your pay/ }).click()

    const plans = pillContaining(page, 'Plan 2')
    expect(await rowCount(plans)).toBeGreaterThan(1)
    // Still inside the tile, not spilling out of it.
    const spill = await plans.evaluate((el) => {
      const parent = el.parentElement as HTMLElement
      return Math.round(el.getBoundingClientRect().right - parent.getBoundingClientRect().right)
    })
    expect(spill).toBeLessThanOrEqual(1)
  })

  for (const step of ['Budget', 'Result'] as const) {
    test(`the ${step} step does not scroll sideways at 320px`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 900 })
      await page.goto(LINK)
      await page.getByLabel('Step progress').getByRole('button', { name: step, exact: true }).click()
      if (step === 'Result') await page.getByText('Copy result link').waitFor()
      else await page.getByRole('button', { name: /^About your pay/ }).click()

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow).toBeLessThanOrEqual(0)
    })
  }

  test('every compact control is back on one row by 480px, and the desktop toggle is untouched', async ({ page }) => {
    await goToBudget(page, 480, 'dark')
    expect(await rowCount(pillContaining(page, 'Monthly take-home'))).toBe(1)
    // The md pay-how toggle on Details was never affected and still fills its row.
    await page.getByLabel('Step progress').getByRole('button', { name: 'Details', exact: true }).click()
    expect(await rowCount(pillContaining(page, 'Save up for it'))).toBe(1)
  })
})
