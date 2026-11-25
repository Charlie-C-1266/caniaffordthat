import { test, expect, type Locator, type Page } from '@playwright/test'
import { goToResult } from './helpers'
import { CURRENT_TAX_YEAR } from '../src/lib/taxYears'

// "About your pay" on the Budget step: a student loan and a workplace pension
// change salary mode's take-home, carry through to the "what salary would
// this take?" panel, and survive a shared link.

/** From the landing page to the Budget step for a £1,200 big purchase. */
async function goToBudget(page: Page, search = '') {
  await page.goto(`/${search}`)
  if (search) return
  await page.getByRole('button', { name: 'Go to Big purchase' }).click()
  await page.getByRole('button', { name: 'Get started with Big purchase', exact: true }).click()
  await page.getByPlaceholder('e.g. Wedding, new kitchen, sofa').fill('New sofa')
  const price = page.locator('input[type="number"]').nth(0)
  await price.fill('1200')
  await price.press('Enter')
}

const aboutYourPay = (page: Page) => page.getByRole('button', { name: /^About your pay/ })

test.describe('About your pay', () => {
  test('a student loan and a pension change the take-home salary mode works out', async ({ page }) => {
    await goToBudget(page)
    await page.getByRole('button', { name: 'Annual salary' }).click()
    const salary = page.locator('input[type="number"]').nth(1)
    await salary.fill('35000')
    await expect(page.getByText('£2,393.30')).toBeVisible()

    await expect(aboutYourPay(page)).toHaveAttribute('aria-expanded', 'false')
    await aboutYourPay(page).click()
    await page.getByRole('group', { name: 'Student loan plan' }).getByRole('button', { name: 'Plan 2', exact: true }).click()
    await page.getByRole('group', { name: 'Workplace pension' }).getByRole('button', { name: 'Net pay', exact: true }).click()

    // £35,000, Plan 2, 5% net pay: £2,234.52 a month.
    await expect(page.getByText('STUDENT LOAN', { exact: true })).toBeVisible()
    await expect(page.getByText('PENSION', { exact: true })).toBeVisible()
    await expect(page.getByText('£2,234.52')).toBeVisible()
    await expect(page.getByText(/single PAYE salary, Plan 2 student loan, 5% net pay pension\./).first()).toBeVisible()

    // The flip panel works under the same loan and pension, and says so.
    await salary.press('Enter')
    await page.getByRole('button', { name: 'I have a goal date' }).click()
    await goToResult(page)
    await expect(page.getByText(/Estimate for England, Wales & NI, .* Plan 2 student loan, 5% net pay pension\./)).toBeVisible()
  })

  test('a shared link brings the loan and pension back, with the section open', async ({ page }) => {
    await goToBudget(
      page,
      '?goalId=big&mode=save&saveFlavor=goal&itemPrice=1200&takeHomeMode=salary&grossSalary=35000&takeHome=2234.52&studentPlan=plan2&postgradLoan=0&pensionArrangement=netpay&pensionMode=percent&pensionPercent=5',
    )
    await page.getByLabel('Step progress').getByRole('button', { name: 'Budget', exact: true }).click()

    await expect(aboutYourPay(page)).toHaveAttribute('aria-expanded', 'true')
    await expect(
      page.getByRole('group', { name: 'Student loan plan' }).getByRole('button', { name: 'Plan 2', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText('£2,234.52')).toBeVisible()
  })

  test('in take-home mode the settings leave the typed take-home alone', async ({ page }) => {
    await goToBudget(page)
    const takeHome = page.locator('input[type="number"]').nth(1)
    await takeHome.fill('2000')
    await aboutYourPay(page).click()

    await expect(page.getByText(/Your take-home already has these taken off/)).toBeVisible()
    await page.getByRole('group', { name: 'Student loan plan' }).getByRole('button', { name: 'Plan 1', exact: true }).click()
    await expect(takeHome).toHaveValue('2000')
  })

  // #315: the note and the caption under the payslip worked from the engine's
  // unrounded, uncapped figures, so the panel built to be checked against a
  // real payslip could give two different figures for the same pension one
  // line apart — and the caption named an amount the payslip had capped.
  test('a capped pension reads the same on the PENSION line, in the note and in the caption', async ({ page }) => {
    // £5,000 a month against a £35,000 salary: only £2,916.67 can be applied.
    await goToBudget(
      page,
      '?goalId=big&mode=save&saveFlavor=goal&itemPrice=1200&takeHomeMode=salary&grossSalary=35000' +
        '&pensionArrangement=sacrifice&pensionMode=amount&pensionMonthlyAmount=5000',
    )
    await page.getByLabel('Step progress').getByRole('button', { name: 'Budget', exact: true }).click()

    const pensionRow = page.getByText('PENSION', { exact: true }).locator('xpath=following-sibling::*[1]')
    await expect(pensionRow).toHaveText(/£2,916\.67/)
    await expect(page.getByText(/Going into your pension: £2,916\.67 a month/)).toBeVisible()
    // The caption still says what was asked for — that is what the user typed
    // — but it is no longer left standing as if it were what was applied.
    await expect(
      page.getByText(/£5,000\/month salary sacrifice pension \(capped at £2,916\.67 — all that's left of your pay\)/),
    ).toBeVisible()
  })

  // #317: a £-a-month pension can take everything the payslip has left, so
  // take-home comes out at £0.00. The Budget step then wouldn't advance with
  // nothing on screen to say why, and the result fell back to "fill in a
  // price and take-home pay" — both of which the user had already given.
  test('says why there is no result when the pension takes all the pay', async ({ page }) => {
    await goToBudget(
      page,
      '?goalId=big&mode=save&saveFlavor=goal&itemPrice=1200&takeHomeMode=salary&grossSalary=20000' +
        '&studentPlan=plan1&pensionArrangement=netpay&pensionMode=amount&pensionMonthlyAmount=3000',
    )
    await page.getByLabel('Step progress').getByRole('button', { name: 'Budget', exact: true }).click()

    // The payslip has nothing left, and the step now says so.
    await expect(page.getByText('TAKE-HOME', { exact: true })).toBeVisible()
    await expect(page.getByText(/These deductions take all of this salary/)).toBeVisible()

    // And the result explains it rather than asking for what was already given.
    await page.getByLabel('Step progress').getByRole('button', { name: 'Result', exact: true }).click()
    await expect(page.getByText(/Your pension takes all of the salary you entered/)).toBeVisible()
    await expect(page.getByText(/fill in a price and take-home pay/)).toHaveCount(0)

    // Lowering the pension to something the payslip can afford brings a real result back.
    await page.getByRole('button', { name: 'Back to your budget' }).click()
    const pension = page.getByRole('spinbutton', { name: /Your contribution/ })
    await pension.fill('150')
    await expect(page.getByText(/These deductions take all of this salary/)).toHaveCount(0)

    await page.getByLabel('Step progress').getByRole('button', { name: 'Result', exact: true }).click()
    await expect(page.getByText('Copy result link')).toBeVisible()
    await expect(page.getByText(/Your pension takes all of the salary you entered/)).toHaveCount(0)
  })

  // #318: the caption under the payslip formatted a £-a-month pension with
  // whole-pound rounding, so the panel built to be checked against a real
  // payslip showed two different figures for the same pension, one line apart.
  test('a £-a-month pension reads the same on the PENSION line and in the caption', async ({ page }) => {
    await goToBudget(
      page,
      '?goalId=big&mode=save&saveFlavor=goal&itemPrice=1200&takeHomeMode=salary&grossSalary=35000' +
        '&studentPlan=plan2&postgradLoan=1&pensionArrangement=netpay&pensionMode=amount&pensionMonthlyAmount=150.50',
    )
    await page.getByLabel('Step progress').getByRole('button', { name: 'Budget', exact: true }).click()

    // The payslip line, to the penny...
    const pensionRow = page.getByText('PENSION', { exact: true }).locator('xpath=following-sibling::*[1]')
    await expect(pensionRow).toHaveText(/£150\.50/)
    // ...and the caption below it, which used to say "£151/month". Anchored to
    // its opening words, since the Result step's SalaryFlip carries the same
    // profile wording after "Estimate for" and is in the DOM too.
    await expect(
      page.getByText(/^England, Wales & NI, .* — single PAYE salary, Plan 2 and Postgraduate Loan, £150\.50\/month net pay pension\./),
    ).toBeVisible()
    await expect(page.getByText(/£151\/month/)).toHaveCount(0)
  })

  test('fits a narrow phone without scrolling sideways', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 })
    await goToBudget(page)
    await aboutYourPay(page).click()
    await page.getByRole('group', { name: 'Workplace pension' }).getByRole('button', { name: 'Salary sacrifice', exact: true }).click()

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
  test('a salary-mode link with a wrong take-home shows the payslip figure everywhere (#292)', async ({ page }) => {
    // The link claims £2,393.30 — the no-deductions figure for £35,000 — while
    // a Plan 2 salary with a 5% net-pay pension actually takes home £2,234.52.
    // Before #292 hydration trusted the link, so the Budget step's payslip
    // recomputed and showed £2,234.52 while the verdict and result were worked
    // out on £2,393.30.
    const STALE = '2393.30'
    const DERIVED = '£2,234.52'
    await goToBudget(
      page,
      `?goalId=big&mode=save&saveFlavor=goal&itemName=New+sofa&itemPrice=1200&takeHomeMode=salary&grossSalary=35000&takeHome=${STALE}` +
        '&studentPlan=plan2&postgradLoan=0&pensionArrangement=netpay&pensionMode=percent&pensionPercent=5',
    )
    await page.getByLabel('Step progress').getByRole('button', { name: 'Budget', exact: true }).click()

    // The payslip's TAKE-HOME line, derived from the salary and the profile.
    const payslip = page.locator('div.mono').first()
    await expect(payslip.getByText('TAKE-HOME', { exact: true }).locator('xpath=following-sibling::span')).toHaveText(DERIVED)
    // The stale figure is nowhere on the step.
    await expect(page.getByText('£2,393.30')).toHaveCount(0)

    // And the result agrees: its spare-cash row is the derived take-home, not
    // the link's, since no outgoings are set.
    await goToResult(page)
    await expect(page.getByText('SPARE CASH', { exact: true }).locator('xpath=following-sibling::span')).toHaveText('£2,235')
    await expect(page.getByText('£2,393')).toHaveCount(0)
  })
})

// #296: three paths real users and shared links take had no browser test — the
// "£ a month" pension mode, the postgraduate loan, and the new fields' guards
// against hostile or stale link values. The design doc (§9) asks for "a
// student-loan path and a pension path through Budget to the result"; only the
// percentage, undergraduate-only version of each was in place.
//
// Tests only. Every edge case below was probed against dev first, and all of
// them already behave correctly — nothing here records a bug.

/** The payslip box on the Budget step. */
const payslip = (page: Page) => page.locator('div.mono').first()

/** `£2,916.67` or `−⁠£149.53` as a number, minus sign and word-joiner included. */
const asNumber = (text: string) => Number(text.replace(/[^\d.]/g, '')) * (/[−-]/.test(text) ? -1 : 1)

/**
 * The payslip's lines must add up to the take-home it shows — the #293/#294
 * invariant, checked end to end. The lines are rounded together precisely so
 * this holds to the penny.
 */
async function expectPayslipAddsUp(box: Locator) {
  // One read of the settled box rather than a round trip per row. Only
  // label/value pairs count, which skips the box's own heading.
  const pairs = await box.locator('> div').evaluateAll((rows) =>
    rows.flatMap((row) => {
      const spans = row.querySelectorAll(':scope > span')
      return spans.length === 2 ? [[spans[0].textContent ?? '', spans[1].textContent ?? '']] : []
    }),
  )
  const lines = pairs.map(([label, value]) => ({ label, value: asNumber(value) }))

  expect(lines.length, 'the payslip has lines to add up').toBeGreaterThanOrEqual(2)
  const total = lines.at(-1)
  expect(total?.label).toBe('TAKE-HOME')

  const summed = lines.slice(0, -1).reduce((running, line) => running + line.value, 0)
  expect(summed, 'salary less every deduction equals take-home').toBeCloseTo(total?.value ?? Number.NaN, 2)
}

/** The labels of the payslip's deduction lines, in order. */
async function payslipLabels(box: Locator): Promise<string[]> {
  const labels = await box.locator('> div > span:first-child').allTextContents()
  return labels.filter((label) => label !== '')
}

test.describe('About your pay: the £-a-month pension', () => {
  test('takes a monthly amount, shows it on the payslip, and keeps the slider when switching back', async ({ page }) => {
    await goToBudget(page)
    await page.getByRole('button', { name: 'Annual salary' }).click()
    await page.locator('input[type="number"]').nth(1).fill('35000')
    await aboutYourPay(page).click()

    await page.getByRole('group', { name: 'Workplace pension' }).getByRole('button', { name: 'Salary sacrifice', exact: true }).click()

    // The percentage slider is the default; note where it sits before switching.
    const slider = page.getByRole('slider', { name: 'Your contribution' })
    await expect(slider).toBeVisible()
    const percentBefore = await slider.inputValue()

    // The hint recommends this mode to auto-enrolment members, and nothing
    // has ever driven it in a browser.
    await page.getByRole('button', { name: '£ a month' }).click()
    await expect(slider).toHaveCount(0)

    const amountField = page.getByLabel('Your contribution')
    await expect(amountField).toBeVisible()
    await amountField.fill('150')

    // £35,000 under salary sacrifice, £150 a month: the pension line is the
    // amount itself, and the payslip adds up to the take-home shown.
    await expect(payslip(page).getByText('PENSION', { exact: true })).toBeVisible()
    await expect(payslip(page).getByText('−\u2060£150.00')).toBeVisible()
    await expectPayslipAddsUp(payslip(page))
    await expect(page.getByText(/£150\/month salary sacrifice pension/).first()).toBeVisible()

    // Switching back brings the slider, still where it was.
    await page.getByRole('button', { name: '% of salary' }).click()
    await expect(slider).toHaveValue(percentBefore)
  })

  test('an amount of 0 and an empty amount both mean no pension yet', async ({ page }) => {
    // Nothing is taken until an amount is typed: there is nothing to take.
    await goToBudget(
      page,
      '?goalId=big&mode=save&saveFlavor=goal&itemPrice=1200&takeHomeMode=salary&grossSalary=35000' +
        '&pensionArrangement=netpay&pensionMode=amount&pensionMonthlyAmount=0',
    )
    await page.getByLabel('Step progress').getByRole('button', { name: 'Budget', exact: true }).click()

    await expect(payslip(page).getByText('PENSION', { exact: true })).toHaveCount(0)
    await expect(page.getByText(/no student loan or pension/).first()).toBeVisible()
    await expectPayslipAddsUp(payslip(page))

    // And clearing the field by hand does the same.
    await page.getByLabel('Your contribution').fill('')
    await expect(payslip(page).getByText('PENSION', { exact: true })).toHaveCount(0)
    await expectPayslipAddsUp(payslip(page))
  })

  test('an amount bigger than the monthly pay floors take-home at £0.00, never negative', async ({ page }) => {
    // £12,000 a year is £1,000 a month; a £5,000-a-month pension cannot take
    // more than there is.
    await goToBudget(
      page,
      '?goalId=big&mode=save&saveFlavor=goal&itemPrice=1200&takeHomeMode=salary&grossSalary=12000' +
        '&pensionArrangement=netpay&pensionMode=amount&pensionMonthlyAmount=5000',
    )
    await page.getByLabel('Step progress').getByRole('button', { name: 'Budget', exact: true }).click()

    await expect(payslip(page).getByText('SALARY', { exact: true })).toBeVisible()
    const takeHome = payslip(page).getByText('TAKE-HOME', { exact: true }).locator('xpath=following-sibling::span')
    await expect(takeHome).toHaveText('£0.00')
    expect(asNumber((await takeHome.textContent()) ?? '')).toBeGreaterThanOrEqual(0)

    // The pension is capped at the pay, not shown taking more than exists.
    await expect(payslip(page).getByText('−\u2060£1,000.00')).toBeVisible()
    await expectPayslipAddsUp(payslip(page))
  })
})

test.describe('About your pay: the postgraduate loan', () => {
  test('stacks on top of an undergraduate plan, as its own payslip line', async ({ page }) => {
    await goToBudget(page)
    await page.getByRole('button', { name: 'Annual salary' }).click()
    await page.locator('input[type="number"]').nth(1).fill('35000')
    await aboutYourPay(page).click()

    await page.getByRole('group', { name: 'Student loan plan' }).getByRole('button', { name: 'Plan 2', exact: true }).click()
    await page.getByRole('group', { name: 'Postgraduate Loan' }).getByRole('button', { name: 'Yes', exact: true }).click()

    // Two separate lines, not one combined repayment.
    await expect(payslip(page).getByText('STUDENT LOAN', { exact: true })).toBeVisible()
    await expect(payslip(page).getByText('POSTGRADUATE LOAN', { exact: true })).toBeVisible()
    await expect(page.getByText(/Plan 2 and Postgraduate Loan/).first()).toBeVisible()
    await expectPayslipAddsUp(payslip(page))
  })

  test('applies on its own with plan None', async ({ page }) => {
    await goToBudget(page)
    await page.getByRole('button', { name: 'Annual salary' }).click()
    await page.locator('input[type="number"]').nth(1).fill('35000')
    await aboutYourPay(page).click()

    await page.getByRole('group', { name: 'Postgraduate Loan' }).getByRole('button', { name: 'Yes', exact: true }).click()
    await expect(page.getByRole('group', { name: 'Student loan plan' }).getByRole('button', { name: 'None', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await expect(payslip(page).getByText('POSTGRADUATE LOAN', { exact: true })).toBeVisible()
    await expect(payslip(page).getByText('STUDENT LOAN', { exact: true })).toHaveCount(0)
    // The caption names the loan that was applied, and only that one.
    await expect(page.getByText(/single PAYE salary, Postgraduate Loan, no pension/).first()).toBeVisible()
    await expectPayslipAddsUp(payslip(page))
  })

  test('takes nothing below its threshold, and shows no £0.00 line', async ({ page }) => {
    // The postgraduate loan starts at £21,000; £18,000 is under it.
    expect(CURRENT_TAX_YEAR.postgraduateLoan.threshold).toBe(21_000)
    await goToBudget(
      page,
      '?goalId=big&mode=save&saveFlavor=goal&itemPrice=1200&takeHomeMode=salary&grossSalary=18000&studentPlan=none&postgradLoan=1',
    )
    await page.getByLabel('Step progress').getByRole('button', { name: 'Budget', exact: true }).click()

    // The payslip hides lines that take nothing, so there is no £0.00 row.
    await expect(payslip(page).getByText('POSTGRADUATE LOAN', { exact: true })).toHaveCount(0)
    expect(await payslipLabels(payslip(page))).toEqual(['SALARY', 'INCOME TAX', 'NATIONAL INSURANCE', 'TAKE-HOME'])
    await expectPayslipAddsUp(payslip(page))
  })
})
