import { test, expect } from '@playwright/test'

// The emergency fund is the one goal with no price: its target is derived from
// cover-months x essential spend, and those essentials are captured in the
// Details step rather than Budget (see design/adr/0004). This pins that path.
test.describe('emergency fund', () => {
  test('derives a target from essentials in Details and reaches a result without a price', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: 'Go to Emergency fund' }).click()
    await page.getByRole('button', { name: 'Get started with Emergency fund', exact: true }).click()

    // No mode toggle for the save-only emergency fund.
    await expect(page.getByRole('button', { name: 'Pay monthly' })).toHaveCount(0)

    // Essentials live here in Details. Housing is the first money field on this
    // step; £1,000 x the default 3 months cover -> a £3,000 target, which sits
    // in MoneyHelper's recommended 3–6 month band.
    const housing = page.locator('input[type="number"]').nth(0)
    await housing.fill('1000')
    await expect(page.getByText(/That's £3,000/)).toBeVisible()
    await expect(page.getByText('Within the recommended 3–6 months.')).toBeVisible()

    // Budget step only needs take-home for the emergency fund. Target it by its
    // label — the Details essentials are earlier number inputs on the page.
    await page.getByRole('button', { name: 'Budget', exact: true }).click()
    const takeHome = page.getByText('Take-home pay / month').locator('xpath=following-sibling::div//input')
    await takeHome.fill('3000')

    await page.getByRole('button', { name: 'Result', exact: true }).click()
    await expect(page.getByText('Copy result link')).toBeVisible()
    await expect(page.getByText(/Emergency fund — £3,000/)).toBeVisible()
    await expect(page.getByText('Time to build your fund')).toBeVisible()
  })

  test('honours the "I have a goal date" plan flavor and reframes the result', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: 'Go to Emergency fund' }).click()
    await page.getByRole('button', { name: 'Get started with Emergency fund', exact: true }).click()

    await page.locator('input[type="number"]').nth(0).fill('1000') // housing -> £3,000 target

    await page.getByRole('button', { name: 'Budget', exact: true }).click()
    await page.getByText('Take-home pay / month').locator('xpath=following-sibling::div//input').fill('3000')

    // Plan step: switch from the default duration flavor to a fixed goal date.
    // Before the fix this toggle had no effect on the emergency result.
    await page.getByRole('button', { name: 'Plan', exact: true }).click()
    await page.getByRole('button', { name: 'I have a goal date' }).click()
    await page.getByPlaceholder('MM-YYYY').fill('12-2030')

    await page.getByRole('button', { name: 'Result', exact: true }).click()
    // The result now reframes as the monthly saving needed to hit the cushion by
    // the chosen date, rather than "Time to build your fund".
    await expect(page.getByText('Monthly saving needed')).toBeVisible()
    await expect(page.getByRole('heading', { name: /£[\d,]+\/mo/ })).toBeVisible()
    await expect(page.getByText(/reaches your cushion by December 2030/)).toBeVisible()
  })
})
