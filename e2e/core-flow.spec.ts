import { test, expect } from '@playwright/test'
import { goToTimeframe, goToResult } from './helpers'

test.describe('core flow', () => {
  test('intro screen loads with the expected headline and helper text', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /within reach/i })).toBeVisible()
    await expect(page.getByText('Scroll to begin')).toBeVisible()
  })

  test('mode-select shows both cards, and picking one advances to item+price', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Saving up' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Paying monthly' })).toBeVisible()

    await page.getByRole('button', { name: 'Saving up' }).click()
    await expect(page.getByPlaceholder('e.g. New sofa')).toBeVisible()
  })

  test('entering a price and pressing Enter advances to the budget step', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Saving up' }).click()

    await page.getByPlaceholder('e.g. New sofa').fill('New sofa')
    const priceInput = page.locator('input[type="number"]').nth(0)
    await priceInput.fill('1200')
    await priceInput.press('Enter')

    await expect(page.getByText("What's coming in")).toBeVisible()
    await expect(page.getByText('Housing (rent/mortgage)')).toBeVisible()
  })

  test('budget fields default to £0 and take-home + Enter advances to timeframe', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Saving up' }).click()
    await page.getByPlaceholder('e.g. New sofa').fill('New sofa')
    const priceInput = page.locator('input[type="number"]').nth(0)
    await priceInput.fill('1200')
    await priceInput.press('Enter')

    const housingInput = page.locator('input[type="number"]').nth(2)
    await expect(housingInput).toHaveValue('0')

    const takeHomeInput = page.locator('input[type="number"]').nth(1)
    await takeHomeInput.fill('2000')
    await takeHomeInput.press('Enter')

    await expect(page.getByText('How do you want')).toBeVisible()
  })

  test('full flow reaches a result with the expected verdict and breakdown', async ({ page }) => {
    await goToTimeframe(page, { itemName: 'New sofa', itemPrice: '1200', takeHome: '2000' })
    // Switch to goal-date flavor (default goalMonths=12, 0% growth) for a
    // deterministic £1,200/12 = £100/mo, rather than duration mode's
    // months-to-save headline, whose expected date shifts with "now".
    await page.getByRole('button', { name: 'I have a goal date' }).click()

    await goToResult(page)

    await expect(page.getByText(/Yes — it's within reach/)).toBeVisible()
    await expect(page.getByRole('heading', { name: '£100/mo' })).toBeVisible()
    await expect(page.getByText(/New sofa — £1,200/)).toBeVisible()
  })
})
