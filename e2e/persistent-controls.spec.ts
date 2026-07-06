import { test, expect } from '@playwright/test'
import { goToPlan } from './helpers'

test.describe('persistent controls', () => {
  test('"Start over" resets entered data and returns to the intro screen', async ({ page }) => {
    await goToPlan(page, { itemName: 'New sofa', itemPrice: '1200', takeHome: '2000' })

    await page.getByRole('button', { name: 'Start over' }).click()

    await expect(page.getByRole('heading', { name: 'What are you saving for?' })).toBeVisible()

    // Re-pick the goal and confirm the price is actually back to blank, not
    // just visually scrolled to the top.
    await page.getByRole('button', { name: 'Go to Big purchase' }).click()
    await page.getByRole('button', { name: 'Choose Big purchase', exact: true }).click()
    await expect(page.locator('input[type="number"]').nth(0)).toHaveValue('')
  })

  test('"Our sources" opens a panel with links, and closes on an outside click', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: 'Our sources' }).click()
    await expect(page.getByText('What our thresholds are based on')).toBeVisible()

    const links = page.locator('a[href*="moneyhelper.org.uk"], a[href*="halifax.co.uk"]')
    await expect(links).toHaveCount(5)

    // Click somewhere clearly outside the panel.
    await page.mouse.click(20, 500)
    await expect(page.getByText('What our thresholds are based on')).not.toBeVisible()
  })
})
