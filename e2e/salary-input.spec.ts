import { test, expect } from '@playwright/test'

test.describe('salary input mode', () => {
  test('entering an annual salary computes take-home and drives the result', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Go to Big purchase' }).click()
    await page.getByRole('button', { name: 'Get started with Big purchase', exact: true }).click()
    await page.getByPlaceholder('e.g. Wedding, new kitchen, sofa').fill('New sofa')
    const price = page.locator('input[type="number"]').nth(0)
    await price.fill('1200')
    await price.press('Enter')

    // On the Budget step, switch take-home entry to annual salary.
    await page.getByRole('button', { name: 'Annual salary' }).click()
    const salary = page.locator('input[type="number"]').nth(1)
    await salary.fill('40000')

    // The tax engine's forward calc is shown live: £40k gross -> ~£2,693/month.
    await expect(page.getByText(/take-home after tax/i)).toBeVisible()
    await expect(page.getByText('£2,693').first()).toBeVisible()

    // The computed take-home flows into the result like any other.
    await salary.press('Enter')
    await page.getByRole('button', { name: 'I have a goal date' }).click()
    await page.getByRole('button', { name: 'Result', exact: true }).click()
    await page.getByText('Copy result link').waitFor()

    // Spare cash on the result reflects the computed take-home (no outgoings entered).
    await expect(page.getByTestId('result-panel').getByText('£2,693', { exact: true }).first()).toBeVisible()
  })
})
