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

// #319: clamping held every shared number inside its slider's bounds but not
// onto its steps, so a link could carry a value the slider itself refuses. The
// browser pins the thumb to the nearest step, so the control disagreed with
// the label beside it and with the figures in the result — and a fractional
// `term` was quoted as a deal no lender offers.
test.describe("a shared link cannot carry a value between a slider's steps", () => {
  /** The reproduction link from #319: a 0.5-stepped pension and APR, and a whole-month term, all given fractions. */
  const OFF_STEP_LINK =
    '/?goalId=holiday&itemPrice=3000&takeHome=2500&takeHomeMode=takehome&mode=monthly' +
    '&studentPlan=plan2&pensionArrangement=netpay&pensionMode=percent' +
    '&pensionPercent=5.1234567&term=13.37&growth=3.14159'

  /** The three sliders the link targets, with the on-step value each has to land on. */
  const SNAPPED = [
    { name: 'Your contribution', value: '5', readOut: '5% of salary' },
    { name: 'Term length', value: '13', readOut: '13 months' },
    { name: 'Interest rate (APR)', value: '3', readOut: '3%' },
  ] as const

  for (const { name, value, readOut } of SNAPPED) {
    test(`the "${name}" slider, its read-out and its thumb all agree`, async ({ page }) => {
      await page.goto(OFF_STEP_LINK)

      const slider = page.getByRole('slider', { name })
      // The thumb's own value, which the browser already snapped to the step...
      await expect(slider).toHaveValue(value)
      // ...now matches the read-out beside it, which is what used to drift.
      await expect(slider).toHaveAttribute('aria-valuetext', readOut)
      await expect(page.getByText(readOut, { exact: true }).first()).toBeVisible()

      // Stated as the general rule too, so this keeps holding if the wording
      // changes: the number in the read-out is the number the slider holds.
      const thumb = await slider.inputValue()
      const text = await slider.getAttribute('aria-valuetext')
      expect(text?.replace(/[^\d.]/g, '')).toBe(thumb)
    })
  }

  test('no off-step figure reaches the result', async ({ page }) => {
    await page.goto(OFF_STEP_LINK)
    await page.getByRole('button', { name: 'Result', exact: true }).click()
    await page.getByText('Copy result link').waitFor()

    const body = await page.locator('body').innerText()
    // The fractions from the link, which used to be quoted back in the
    // repayment line and the pension caption.
    for (const fraction of ['5.1234567', '13.37', '3.14159']) expect(body).not.toContain(fraction)
    // And nothing else fractional crept in where a whole month belongs.
    expect(body).not.toMatch(/\d+\.\d+ months/)
    expect(body).toContain('13 months')
  })

  test('an on-step link is still honoured exactly as written', async ({ page }) => {
    // The guard against over-zealous snapping: 5.5%, 14 months and 3.5% are
    // all values the sliders can produce, so they must survive untouched.
    await page.goto(
      '/?goalId=holiday&itemPrice=3000&takeHome=2500&takeHomeMode=takehome&mode=monthly' +
        '&pensionArrangement=netpay&pensionMode=percent&pensionPercent=5.5&term=14&growth=3.5',
    )

    await expect(page.getByRole('slider', { name: 'Your contribution' })).toHaveValue('5.5')
    await expect(page.getByRole('slider', { name: 'Term length' })).toHaveValue('14')
    await expect(page.getByRole('slider', { name: 'Interest rate (APR)' })).toHaveValue('3.5')
  })
})
