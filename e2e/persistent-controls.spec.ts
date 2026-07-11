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
    await page.getByRole('button', { name: 'Get started with Big purchase', exact: true }).click()
    await expect(page.locator('input[type="number"]').nth(0)).toHaveValue('')
  })

  test('"Our sources" links straight to the sources & ethos page in a new tab', async ({ page }) => {
    await page.goto('/')

    // The old in-app popover is gone — the page carries the full annotated
    // list, so the control is now a plain link (new tab, to keep any figures
    // typed mid-flow).
    const link = page.getByRole('link', { name: 'Our sources' })
    await expect(link).toHaveAttribute('href', '/sources/')
    await expect(link).toHaveAttribute('target', '_blank')
  })
})
