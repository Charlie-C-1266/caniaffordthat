import { test, expect } from '@playwright/test'
import { goToPlan, goToResult } from './helpers'

// "Paying monthly" mode with 0% APR gives a clean, deterministic
// contribution = price / term for each scenario below. The result-screen
// background communicates the verdict: green when affordable, red when not
// (see design/adr/0007).
const AFFORDABLE_GREEN = 'rgb(46, 213, 115)'
const NOT_AFFORDABLE_RED = 'rgb(255, 92, 92)'

test.describe('affordability verdict tiers', () => {
  test('comfortable case: green background, "comfortably" copy', async ({ page }) => {
    // £100/mo against £2,000 spare cash = 5% -> comfortable
    await goToPlan(page, { mode: 'monthly', itemPrice: '1200', takeHome: '2000' })
    await goToResult(page)

    await expect(page.getByText(/Yes — it's within reach/)).toBeVisible()
    await expect(page.getByText(/comfortably/)).toBeVisible()
    await expect(page.getByTestId('result-panel')).toHaveCSS('background-color', AFFORDABLE_GREEN)
  })

  test('tight case: still green/affordable, but "tight" copy', async ({ page }) => {
    // £900/mo against £1,000 spare cash = 90% -> tight, but still fits
    await goToPlan(page, { mode: 'monthly', itemPrice: '10800', takeHome: '1000' })
    await goToResult(page)

    await expect(page.getByText(/Yes — it's within reach/)).toBeVisible()
    await expect(page.getByText(/tight/)).toBeVisible()
    await expect(page.getByTestId('result-panel')).toHaveCSS('background-color', AFFORDABLE_GREEN)
  })

  test('not-affordable case: red background, "No" verdict', async ({ page }) => {
    // £1,000/mo against £500 spare cash -> exceeds it
    await goToPlan(page, { mode: 'monthly', itemPrice: '12000', takeHome: '500' })
    await goToResult(page)

    await expect(page.getByText(/No — that's a stretch/)).toBeVisible()
    await expect(page.getByText(/more than your spare cash/)).toBeVisible()
    await expect(page.getByTestId('result-panel')).toHaveCSS('background-color', NOT_AFFORDABLE_RED)
  })
})
