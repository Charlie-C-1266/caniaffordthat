import { test, expect, type Page } from '@playwright/test'

// A "Copy result link" URL is user-editable input. MoneyInput refuses a
// negative at the keystroke and on paste, clamping it to "0" so the figure on
// screen can never disagree with the one the maths uses. These tests open
// hand-crafted links to prove hydration holds the same line, rather than
// loading a value the UI itself would have rejected.

/** The price field on the Details step, and the take-home field on Budget — the same ordering helpers.ts relies on. */
function priceInput(page: Page) {
  return page.locator('input[type="number"]').nth(0)
}

function takeHomeInput(page: Page) {
  return page.locator('input[type="number"]').nth(1)
}

/** Opens a shared link and scrolls to the Details step, where the price field lives. */
async function openSharedLink(page: Page, search: string) {
  await page.goto(search)
  await page.getByRole('button', { name: 'Details', exact: true }).click()
  await expect(page.getByText("What's the total cost?")).toBeVisible()
}

test.describe('a shared link cannot smuggle in a value the UI would refuse', () => {
  test('a negative price shows as empty, not as -500', async ({ page }) => {
    await openSharedLink(page, '/?goalId=big&itemPrice=-500&takeHome=2500')

    // The headline case from #127: the field used to display -500 while num()
    // fed 0 into every figure on the result screen.
    await expect(priceInput(page)).toHaveValue('')
    // The valid field in the same link is untouched.
    await expect(takeHomeInput(page)).toHaveValue('2500')
  })

  test('non-numeric junk shows as empty rather than being displayed', async ({ page }) => {
    await openSharedLink(page, '/?goalId=big&itemPrice=abc&takeHome=1e999')

    await expect(priceInput(page)).toHaveValue('')
    await expect(takeHomeInput(page)).toHaveValue('')
  })

  test('a valid link still hydrates every field unchanged', async ({ page }) => {
    // The guard against over-zealous sanitising: this must keep working.
    await openSharedLink(page, '/?goalId=big&itemName=New+sofa&itemPrice=1200.50&takeHome=2500&housing=800')

    await expect(priceInput(page)).toHaveValue('1200.50')
    await expect(takeHomeInput(page)).toHaveValue('2500')
    await expect(page.getByPlaceholder('e.g. Wedding, new kitchen, sofa')).toHaveValue('New sofa')
  })

  test('an over-long goal title is capped rather than stretching the layout', async ({ page }) => {
    const long = 'x'.repeat(400)
    await openSharedLink(page, `/?goalId=big&itemName=${long}&itemPrice=1200&takeHome=2500`)

    const name = page.getByPlaceholder('e.g. Wedding, new kitchen, sofa')
    const value = await name.inputValue()
    expect(value.length).toBeLessThanOrEqual(60)
    expect(value.length).toBeGreaterThan(0)

    // And the capped title doesn't force the page sideways on a phone.
    await page.setViewportSize({ width: 375, height: 812 })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('the goal-title field will not accept more than the cap by typing either', async ({ page }) => {
    await openSharedLink(page, '/?goalId=big&itemPrice=1200&takeHome=2500')

    const name = page.getByPlaceholder('e.g. Wedding, new kitchen, sofa')
    await name.fill('z'.repeat(200))
    // maxLength on the input is what keeps the two paths consistent.
    expect((await name.inputValue()).length).toBe(60)
  })
})
