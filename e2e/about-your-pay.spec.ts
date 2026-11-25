import { test, expect, type Page } from '@playwright/test'
import { goToResult } from './helpers'

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
})
