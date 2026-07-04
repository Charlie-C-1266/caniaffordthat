import type { Page } from '@playwright/test'

/**
 * Advances from the intro screen through mode-select, item+price, and budget,
 * landing on the timeframe step — the shared setup every other test starts
 * from. Uses Enter-to-advance (deterministic, no timer waits) rather than the
 * debounce-based auto-advance, which is already covered by
 * useDebouncedAdvance's own unit tests.
 */
export async function goToTimeframe(
  page: Page,
  options: { mode?: 'Saving up' | 'Paying monthly'; itemName?: string; itemPrice?: string; takeHome?: string } = {},
) {
  const { mode = 'Saving up', itemName = 'New sofa', itemPrice = '1200', takeHome = '2000' } = options

  await page.goto('/')
  await page.getByRole('button', { name: mode }).click()

  await page.getByPlaceholder('e.g. New sofa').fill(itemName)
  const priceInput = page.locator('input[type="number"]').nth(0)
  await priceInput.fill(itemPrice)
  await priceInput.press('Enter')

  const takeHomeInput = page.locator('input[type="number"]').nth(1)
  await takeHomeInput.fill(takeHome)
  await takeHomeInput.press('Enter')

  // Common to both mode branches (save's "How do you want to plan it?" vs
  // finance's "Term and rate?"), so this wait works regardless of `mode`.
  await page.getByText(/Scroll for your result/).waitFor()
}

/** From the timeframe step, jumps straight to the result via the progress rail. */
export async function goToResult(page: Page) {
  await page.getByRole('button', { name: 'Result', exact: true }).click()
  await page.getByText('Copy result link').waitFor()
}
