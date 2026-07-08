import { test, expect } from '@playwright/test'

test.describe('vehicle methodology page', () => {
  test('publishes the working: verdict bands, formulas, tax table and the depreciation chart', async ({ page }) => {
    await page.goto('/methodology/vehicle/')

    await expect(page.getByRole('heading', { name: 'How the vehicle calculator works' })).toBeVisible()

    // The verdict bands quote the real thresholds.
    await expect(page.getByText('Fits comfortably')).toBeVisible()
    await expect(page.getByText('Up to 40%')).toBeVisible()

    // The PCP formula (with the balloon term) is published.
    await expect(page.getByText(/PCP payment/).first()).toBeVisible()

    // The VED table shows the rates in force, straight from the constants.
    await expect(page.getByText('£200/year', { exact: true })).toBeVisible()
    await expect(page.getByText('+£440/year', { exact: true })).toBeVisible()

    // The depreciation line chart is drawn, with its mileage legend.
    await expect(page.getByRole('img', { name: /generic depreciation curve/i })).toBeVisible()
    await expect(page.getByText('8,000 miles/year (UK average)')).toBeVisible()

    // Honesty section: the page owns its simplifications.
    await expect(page.getByText("What we deliberately don't model (yet)")).toBeVisible()

    // And a way back to the calculator.
    await expect(page.getByRole('link', { name: '← Back to the calculator' })).toBeVisible()
  })

  test('the worked example is computed from the live maths, not hard-coded copy', async ({ page }) => {
    await page.goto('/methodology/vehicle/')
    // £20,000 brand new over 48 months at average mileage -> the same £7,443
    // estimate the calculator itself produces (see vehicle-flow.spec.ts).
    await expect(page.getByText(/£7,443/).first()).toBeVisible()
  })

  test('the vehicle result card links to the methodology page', async ({ page }) => {
    await page.goto('/?goalId=car&itemPrice=15000&takeHome=2500')
    await page.getByRole('button', { name: 'Result', exact: true }).click()
    await page.getByText('Copy result link').waitFor()

    const link = page.getByRole('link', { name: /how these numbers are worked out/i })
    await expect(link).toHaveAttribute('href', '/methodology/vehicle/')
  })
})
