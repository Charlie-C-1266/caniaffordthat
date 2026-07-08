import { test, expect } from '@playwright/test'

test.describe('sources & ethos page', () => {
  test('covers the ethos, the annotated source list, methodology links and helpful reading', async ({ page }) => {
    await page.goto('/sources/')

    await expect(page.getByRole('heading', { name: 'Our sources & ethos' })).toBeVisible()

    // The ethos table leads with the free-and-impartial promise.
    await expect(page.getByText('Free and impartial')).toBeVisible()
    await expect(page.getByText(/nothing to sell/)).toBeVisible()

    // Every app source appears, annotated with what it backs.
    await expect(page.getByRole('link', { name: /Halifax — The 50\/30\/20 rule/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /GOV.UK — Vehicle tax rates/ })).toBeVisible()
    await expect(page.getByText(/restated as 40% of spare cash/)).toBeVisible()

    // The per-calculator methodology pages are linked.
    await expect(page.getByRole('link', { name: 'How the vehicle calculator works' })).toHaveAttribute(
      'href',
      '/methodology/vehicle/',
    )

    // The helpful-reading list is seeded and framed as non-citations.
    await expect(page.getByRole('link', { name: 'MoneyHelper', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'StepChange', exact: true })).toBeVisible()
    await expect(page.getByText(/places we'd genuinely send a friend/)).toBeVisible()
  })

  test('the vehicle methodology page cross-links to the sources & ethos page', async ({ page }) => {
    await page.goto('/methodology/vehicle/')
    await expect(page.getByRole('link', { name: /sources & ethos page/ })).toHaveAttribute('href', '/sources/')
  })
})
