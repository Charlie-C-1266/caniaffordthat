import { test, expect, type Page } from '@playwright/test'

/**
 * The input under a FieldLabel, found by its label text — the vehicle tiles
 * are label-heavy, and this beats brittle nth() indexing across six steps.
 */
function labelledInput(page: Page, label: string) {
  return page.getByText(label).locator('xpath=following-sibling::div//input')
}

/**
 * Lands on the vehicle Details step with the car named and priced. Uses the
 * carousel dot first so the auto-rotate can't move focus mid-test.
 */
async function startVehicle(page: Page, { price = '22000', deposit = '' }: { price?: string; deposit?: string } = {}) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Go to Vehicle' }).click()
  await page.getByRole('button', { name: 'Get started with Vehicle', exact: true }).click()

  await page.getByPlaceholder('e.g. Volkswagen Golf').fill('VW Golf')
  await page.locator('input[type="number"]').nth(0).fill(price)
  if (deposit) await labelledInput(page, 'Deposit / part-exchange').fill(deposit)
}

/** Fills the Budget step's take-home field and jumps to the result via the rail. */
async function budgetAndResult(page: Page, takeHome = '2000') {
  await labelledInput(page, 'Take-home pay / month').fill(takeHome)
  await page.getByRole('button', { name: 'Result', exact: true }).click()
  await page.getByText('Copy result link').waitFor()
}

test.describe('vehicle flow', () => {
  test('the car gets its own six-step flow on the progress rail', async ({ page }) => {
    await startVehicle(page)
    for (const label of ['Goal', 'Details', 'Paying for it', 'Running costs', 'Budget', 'Result']) {
      await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible()
    }
    // The generic Plan step is replaced by the two vehicle steps.
    await expect(page.getByRole('button', { name: 'Plan', exact: true })).toHaveCount(0)
  })

  test('PCP with a quoted balloon: only the gap is repaid monthly, and the deal box shows the keep-the-car total', async ({ page }) => {
    await startVehicle(page, { price: '22000', deposit: '2000' })

    // Paying for it: PCP is the default method; switch the balloon to a quote.
    await expect(page.getByRole('button', { name: /^PCP/ })).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('slider', { name: 'Interest rate (APR)' }).press('Home') // 0% for round numbers
    await page.getByRole('button', { name: 'I have a quote' }).click()
    await labelledInput(page, 'Final payment from your quote').fill('8000')

    // Running costs: leave only the £60/month maintenance default standing.
    await labelledInput(page, 'Miles you drive / year').fill('0')
    await labelledInput(page, 'Road tax (VED) / year').fill('0')

    await budgetAndResult(page)

    // £20,000 financed less the £8,000 balloon over 48 months = £250/month,
    // plus £60 maintenance = £310 total.
    await expect(page.getByText("Yes — it's within reach.")).toBeVisible()
    await expect(page.getByRole('heading', { name: '£310/mo' })).toBeVisible()
    await expect(page.getByText('PCP PAYMENT')).toBeVisible()
    await expect(page.getByText('£250', { exact: true })).toBeVisible()
    await expect(page.getByText('FINAL PAYMENT', { exact: true })).toBeVisible()
    await expect(page.getByText('£8,000', { exact: true })).toBeVisible()
    await expect(page.getByText('TOTAL IF YOU KEEP IT').locator('xpath=following-sibling::span')).toHaveText('£22,000')

    // The car's deposit was captured in Details, so Budget never asks twice.
    await expect(page.getByText('Already saved toward this')).toHaveCount(0)
  })

  test('PCP with an estimated balloon: the preview, deal box and caveat all carry the depreciation estimate', async ({ page }) => {
    await startVehicle(page, { price: '20000' })

    // Paying for it: the default "Estimate it for me" branch, brand new at
    // average mileage, 0% APR. 48-month term -> £7,443 via the generic curve.
    await page.getByRole('slider', { name: 'Interest rate (APR)' }).press('Home')
    await page.getByRole('slider', { name: 'How old is the car now?' }).press('Home')
    await expect(page.getByText(/plan around a £7,443 final payment/)).toBeVisible()

    await budgetAndResult(page, '3000')

    await expect(page.getByText('FINAL PAYMENT (EST.)')).toBeVisible()
    // Scoped to the result panel — the purchase step's preview shows it too.
    await expect(page.getByTestId('result-panel').getByText('£7,443', { exact: true })).toBeVisible()
    // The default 8,000 miles at 40mpg and 140p/litre ≈ £106/month on fuel.
    await expect(page.getByText('FUEL', { exact: true })).toBeVisible()
    await expect(page.getByText('£106', { exact: true })).toBeVisible()
    // The output warns the balloon is a generic-curve estimate, not a quote.
    const resultPanel = page.getByTestId('result-panel')
    await expect(resultPanel.getByText(/generic depreciation curve/)).toBeVisible()
    await expect(resultPanel.getByText(/GMFV/)).toBeVisible()
  })

  test('cash: no monthly finance cost, the upfront figure is called out, and the cushion caveat shows', async ({ page }) => {
    await startVehicle(page, { price: '10000', deposit: '2000' })

    await page.getByRole('button', { name: /^Cash/ }).click()
    await expect(page.getByText(/£8,000.*on the day/)).toBeVisible()

    // Running costs: zero everything but the £60/month maintenance default.
    await labelledInput(page, 'Miles you drive / year').fill('0')
    await labelledInput(page, 'Road tax (VED) / year').fill('0')

    await budgetAndResult(page)

    await expect(page.getByRole('heading', { name: '£60/mo' })).toBeVisible()
    await expect(page.getByText('DUE UPFRONT').locator('xpath=following-sibling::span')).toHaveText('£8,000')
    await expect(page.getByText(/emergency cushion/)).toBeVisible()
    await expect(page.getByText('PCP PAYMENT')).toHaveCount(0)
  })

  test('Budget relabels Transport for the vehicle goal so it reads as additive, not double-counted', async ({ page }) => {
    await startVehicle(page, { price: '22000', deposit: '2000' })
    await page.getByRole('button', { name: 'Running costs', exact: true }).click()
    await page.getByRole('button', { name: 'Budget', exact: true }).click()

    // The car's own fuel/insurance/tax/finance are itemised on earlier steps,
    // so the shared Transport outgoing is relabelled to make clear it's for
    // anything else — not a second place to enter this car's costs.
    await expect(page.getByText('Transport (other than this car)')).toBeVisible()
    await expect(page.getByText('Transport', { exact: true })).toHaveCount(0)
  })

  test('a brand-new car over £40k gets the tax supplement added automatically', async ({ page }) => {
    await startVehicle(page, { price: '45000' })
    await page.getByRole('button', { name: /^Cash/ }).click()

    // Running costs asks the car's age here (cash never asked it earlier).
    await page.getByRole('slider', { name: 'How old is the car?' }).press('Home')
    await expect(page.getByText(/we've added the £440\/year/i)).toBeVisible()

    await budgetAndResult(page, '4000')

    await expect(page.getByText(/£440\/year supplement/)).toBeVisible()
    // £200 VED + £440 supplement = £640/year ≈ £53/month on the tax row.
    await expect(page.getByText('£53', { exact: true })).toBeVisible()
  })
})
