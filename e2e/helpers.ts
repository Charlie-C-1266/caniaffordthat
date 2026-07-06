import type { Page } from '@playwright/test'

/**
 * Advances from the goal-picker landing through the tailored Details and budget,
 * landing on the plan/timeframe step — the shared setup every other test starts
 * from. Uses Enter-to-advance (deterministic, no timer waits) rather than the
 * debounce-based auto-advance, which is already covered by useDebouncedAdvance's
 * own unit tests.
 *
 * Defaults to the "Big purchase" goal, whose name placeholder is "e.g. Wedding, new kitchen, sofa"
 * and which supports both save and finance, so a single helper covers both modes.
 */
export async function goToPlan(
  page: Page,
  options: {
    mode?: 'save' | 'monthly'
    goal?: string
    itemName?: string
    itemPrice?: string
    takeHome?: string
  } = {},
) {
  const { mode = 'save', goal = 'Big purchase', itemName = 'New sofa', itemPrice = '1200', takeHome = '2000' } = options

  await page.goto('/')

  // Focus the goal in the carousel (via its dot) then start with it.
  await page.getByRole('button', { name: `Go to ${goal}` }).click()
  await page.getByRole('button', { name: `Get started with ${goal}`, exact: true }).click()

  if (mode === 'monthly') await page.getByRole('button', { name: 'Pay monthly' }).click()

  await page.getByPlaceholder('e.g. Wedding, new kitchen, sofa').fill(itemName)
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

/** From the plan step, jumps straight to the result via the progress rail. */
export async function goToResult(page: Page) {
  await page.getByRole('button', { name: 'Result', exact: true }).click()
  await page.getByText('Copy result link').waitFor()
}
