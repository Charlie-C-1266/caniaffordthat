import { test, expect, type Page } from '@playwright/test'
import { PENSION_PERCENT_RANGE } from '../src/lib/sliderRanges'
import { takeHomeBreakdown } from '../src/lib/salary'
import { monthlyPayslipLines } from '../src/lib/payslip'
import { fmtPence } from '../src/lib/calculations'

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

// #296: #127 proved hydration never shows a value the UI couldn't produce, but
// only for the older fields. The pay-profile fields #291 added each have
// guards in `urlState.ts` that are unit-tested and never run end to end. A
// link naming relief at source is the likeliest of these, since the design doc
// lists it as a deliberate fallback.
//
// Tests only. Every case below was probed against dev first and already
// behaves correctly — nothing here records a bug.

/**
 * Opens a salary-mode link and lands on the Budget step, where "About your
 * pay" lives. No `takeHome` is carried: since #292 hydration works it out
 * from the salary and the sanitised pay profile, so the flow reaches a result
 * without one and a hostile profile can't hide behind a stored figure.
 */
async function openPayLink(page: Page, params: string) {
  await page.goto(`/?goalId=big&mode=save&saveFlavor=goal&itemPrice=1200&takeHomeMode=salary&grossSalary=35000&${params}`)
  await page.getByLabel('Step progress').getByRole('button', { name: 'Budget', exact: true }).click()
  const box = page.locator('div.mono').first()
  await expect(box.getByText('SALARY', { exact: true })).toBeVisible()
  return box
}

/**
 * The take-home a £35,000 salary reaches with nothing taken but tax and NI
 * (£2,393.30 in 2026/27), worked out the way the payslip's TAKE-HOME row is,
 * so the April tax-year refresh updates it along with the page.
 */
const NO_DEDUCTIONS_TAKE_HOME = fmtPence(monthlyPayslipLines(takeHomeBreakdown(35_000)).takeHome / 100)

test.describe('a shared link cannot smuggle in a pay profile the UI would refuse', () => {
  test('relief at source falls back to no pension, leaving take-home untouched', async ({ page }) => {
    // The one arrangement the site deliberately does not offer yet.
    const box = await openPayLink(page, 'pensionArrangement=ras&pensionMode=percent&pensionPercent=5')

    await expect(box.getByText('PENSION', { exact: true })).toHaveCount(0)
    await expect(box.getByText(NO_DEDUCTIONS_TAKE_HOME)).toBeVisible()
    await expect(page.getByText(/no student loan or pension/).first()).toBeVisible()

    // It must not be offered as a choice either, and it must not force the
    // section open by itself.
    await expect(page.getByRole('group', { name: 'Workplace pension' }).getByRole('button', { name: 'Relief at source' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^About your pay/ })).toHaveAttribute('aria-expanded', 'false')
  })

  for (const [name, params] of [
    ['an unknown pension arrangement', 'pensionArrangement=bogus'],
    ['an unknown student loan plan', 'studentPlan=plan9'],
    ['a non-boolean postgraduate loan', 'postgradLoan=yes'],
  ] as const) {
    test(`ignores ${name}`, async ({ page }) => {
      const box = await openPayLink(page, params)

      await expect(box.getByText(NO_DEDUCTIONS_TAKE_HOME)).toBeVisible()
      await expect(page.getByText(/no student loan or pension/).first()).toBeVisible()
    })
  }

  for (const [name, percent, expected] of [
    ['above the range', '999', PENSION_PERCENT_RANGE.max],
    ['below the range', '-5', PENSION_PERCENT_RANGE.min],
  ] as const) {
    test(`clamps a pension percentage ${name} into the slider's own bounds`, async ({ page }) => {
      await openPayLink(page, `pensionArrangement=netpay&pensionMode=percent&pensionPercent=${percent}`)

      // The slider shows the clamped value, and so does the caption beside it.
      await expect(page.getByRole('slider', { name: 'Your contribution' })).toHaveValue(String(expected))
      await expect(page.getByText(`${expected}% of salary`).first()).toBeVisible()
      await expect(page.getByText(new RegExp(`${expected}% net pay pension`)).first()).toBeVisible()
    })
  }

  for (const [name, amount] of [
    ['a negative amount', '-100'],
    ['non-numeric junk', 'abc'],
  ] as const) {
    test(`rejects ${name} for the monthly pension, as the other money fields are held`, async ({ page }) => {
      const box = await openPayLink(page, `pensionArrangement=netpay&pensionMode=amount&pensionMonthlyAmount=${amount}`)

      // Sanitised to the default, so nothing is taken — exactly what an empty
      // amount means.
      await expect(box.getByText('PENSION', { exact: true })).toHaveCount(0)
      await expect(box.getByText(NO_DEDUCTIONS_TAKE_HOME)).toBeVisible()
      await expect(page.getByLabel('Your contribution')).toHaveValue('')
    })
  }

  for (const [name, params] of [
    ['relief at source', 'pensionArrangement=ras&pensionMode=percent&pensionPercent=5'],
    ['an unknown arrangement', 'pensionArrangement=bogus'],
    ['an unknown plan', 'studentPlan=plan9'],
    ['a non-boolean loan flag', 'postgradLoan=yes'],
    ['an out-of-range percentage', 'pensionArrangement=netpay&pensionMode=percent&pensionPercent=999'],
    ['a negative percentage', 'pensionArrangement=netpay&pensionMode=percent&pensionPercent=-5'],
    ['a negative amount', 'pensionArrangement=netpay&pensionMode=amount&pensionMonthlyAmount=-100'],
    ['junk for an amount', 'pensionArrangement=netpay&pensionMode=amount&pensionMonthlyAmount=abc'],
    ['an unknown pension mode', 'pensionArrangement=netpay&pensionMode=sideways&pensionPercent=5'],
  ] as const) {
    test(`leaves no NaN, no negative figure and no console error for ${name}`, async ({ page }) => {
      const errors: string[] = []
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text())
      })
      page.on('pageerror', (error) => errors.push(String(error)))

      await openPayLink(page, params)
      const budgetText = await page.locator('body').innerText()
      expect(budgetText, 'the Budget step shows no NaN').not.toContain('NaN')
      // The payslip's deductions use a true minus sign (U+2212) joined to the
      // figure, so a hyphen-minus before a £ would be a real negative.
      expect(budgetText, 'the Budget step shows no negative money figure').not.toMatch(/-£/)

      // On to the result, where the same figures are spent.
      await page.getByLabel('Step progress').getByRole('button', { name: 'Result', exact: true }).click()
      await page.getByText('Copy result link').waitFor()
      const resultText = await page.locator('body').innerText()
      expect(resultText, 'the result shows no NaN').not.toContain('NaN')
      expect(resultText, 'the result shows no negative money figure').not.toMatch(/-£/)

      expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([])
    })
  }
})
