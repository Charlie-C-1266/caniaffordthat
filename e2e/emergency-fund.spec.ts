import { test, expect } from '@playwright/test'

// The emergency fund is the one goal with no price: its target is derived from
// cover-months x essential spend, and those essentials are captured in the
// Details step rather than Budget (see design/adr/0004). This pins that path.
test.describe('emergency fund', () => {
  test('derives a target from essentials in Details and reaches a result without a price', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: 'Go to Emergency fund' }).click()
    await page.getByRole('button', { name: 'Choose Emergency fund', exact: true }).click()

    // No mode toggle for the save-only emergency fund.
    await expect(page.getByRole('button', { name: 'Pay monthly' })).toHaveCount(0)

    // Essentials live here in Details. Housing is the first money field on this
    // step; £1,000 x the default 6 months cover -> a £6,000 target.
    const housing = page.locator('input[type="number"]').nth(0)
    await housing.fill('1000')
    await expect(page.getByText(/That's £6,000/)).toBeVisible()

    // Budget step only needs take-home for the emergency fund. Target it by its
    // label — the Details essentials are earlier number inputs on the page.
    await page.getByRole('button', { name: 'Budget', exact: true }).click()
    const takeHome = page.getByText('Take-home pay / month').locator('xpath=following-sibling::div//input')
    await takeHome.fill('3000')

    await page.getByRole('button', { name: 'Result', exact: true }).click()
    await expect(page.getByText('Copy result link')).toBeVisible()
    await expect(page.getByText(/Emergency fund — £6,000/)).toBeVisible()
  })
})
