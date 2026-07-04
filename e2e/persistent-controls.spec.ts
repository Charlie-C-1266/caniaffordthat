import { test, expect } from '@playwright/test'
import { goToTimeframe } from './helpers'

test.describe('persistent controls', () => {
  test('"Start over" resets entered data and returns to the intro screen', async ({ page }) => {
    await goToTimeframe(page, { itemName: 'New sofa', itemPrice: '1200', takeHome: '2000' })

    await page.getByRole('button', { name: 'Start over' }).click()

    await expect(page.getByText('Scroll to begin')).toBeVisible()

    // Scroll back down to item+price and confirm it's actually back to blank,
    // not just visually scrolled to the top.
    await page.getByRole('button', { name: 'Item', exact: true }).click()
    await expect(page.getByPlaceholder('e.g. New sofa')).toHaveValue('')
  })

  test('"Our sources" opens a panel with links, and closes on an outside click', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: 'Our sources' }).click()
    await expect(page.getByText('What our thresholds are based on')).toBeVisible()

    const links = page.locator('a[href*="moneyhelper.org.uk"], a[href*="halifax.co.uk"]')
    await expect(links).toHaveCount(4)

    // Click somewhere clearly outside the panel.
    await page.mouse.click(20, 500)
    await expect(page.getByText('What our thresholds are based on')).not.toBeVisible()
  })
})
