import { test, expect } from '@playwright/test'
import { goToPlan, goToResult } from './helpers'

test.describe('reverse "what salary?" flip panel', () => {
  test('the result shows the salary a plan would take, and the gap to current pay', async ({ page }) => {
    await goToPlan(page, { itemName: 'New sofa', itemPrice: '1200', takeHome: '2000' })
    // Goal-date flavour gives a deterministic fixed monthly saving.
    await page.getByRole('button', { name: 'I have a goal date' }).click()
    await goToResult(page)

    // The flip panel: its heading, the required-salary rows, and the estimate note.
    await expect(page.getByText(/what salary would this take/i)).toBeVisible()
    await expect(page.getByText('SALARY NEEDED')).toBeVisible()
    await expect(page.getByText('YOUR SALARY (EST.)')).toBeVisible()
    // A £1,200 goal saved over 12 months is a small monthly commitment, so on a
    // £2,000/month take-home the plan is already covered.
    await expect(page.getByText(/already earn enough/i)).toBeVisible()
    await expect(page.getByText(/2026\/27/)).toBeVisible()
  })

  test('in salary mode the panel shows the salary typed, not an estimate of it', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Go to Big purchase' }).click()
    await page.getByRole('button', { name: 'Get started with Big purchase', exact: true }).click()
    await page.getByPlaceholder('e.g. Wedding, new kitchen, sofa').fill('New sofa')
    const price = page.locator('input[type="number"]').nth(0)
    await price.fill('1200')
    await price.press('Enter')

    await page.getByRole('button', { name: 'Annual salary' }).click()
    const salary = page.locator('input[type="number"]').nth(1)
    // £45,250 would show as "£45,300" if it were worked back out of take-home.
    await salary.fill('45250')
    await salary.press('Enter')
    await page.getByRole('button', { name: 'I have a goal date' }).click()
    await goToResult(page)

    await expect(page.getByText('YOUR SALARY', { exact: true })).toBeVisible()
    await expect(page.getByText('YOUR SALARY (EST.)')).toHaveCount(0)
    await expect(page.getByText('£45,250/yr')).toBeVisible()
    await expect(page.getByText(/already earn enough/i)).toBeVisible()
  })
})
