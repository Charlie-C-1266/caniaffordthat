import { test, expect } from '@playwright/test'
import { goToPlan, goToResult } from './helpers'

test.describe('reverse "what salary?" flip panel', () => {
  test('the result shows the salary a plan would take, and the gap to current pay', async ({ page }) => {
    await goToPlan(page, { itemName: 'New sofa', itemPrice: '1200', takeHome: '2000' })
    // Goal-date flavor gives a deterministic fixed monthly saving.
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
})
