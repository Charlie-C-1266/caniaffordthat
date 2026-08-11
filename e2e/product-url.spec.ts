import { test, expect } from '@playwright/test'

// The paste-a-product-link field. The dev server the e2e suite runs against has
// no `/api/parse-product` function (it's Vercel-only), so the happy path mocks
// the endpoint with route interception, and the degradation path leaves it
// unmocked to prove a missing endpoint falls back cleanly to manual entry —
// exactly what a static or self-hosted (Docker/nginx) build sees.

const urlField = /https:\/\/www\.currys\.co\.uk/

async function openBigPurchaseDetails(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Go to Big purchase' }).click()
  await page.getByRole('button', { name: 'Get started with Big purchase', exact: true }).click()
}

test.describe('paste a product link', () => {
  test('a successful parse autofills the name and price', async ({ page }) => {
    await page.route('**/api/parse-product**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          name: 'Sony WH-1000XM6 Headphones',
          price: '299.00',
          currency: 'GBP',
          image: null,
          source: 'json-ld',
          retailer: 'currys.co.uk',
        }),
      }),
    )

    await openBigPurchaseDetails(page)
    await page.getByPlaceholder(urlField).fill('https://www.currys.co.uk/products/sony-wh1000xm6')

    await expect(page.getByText('Filled in from currys.co.uk')).toBeVisible()
    await expect(page.getByPlaceholder('e.g. Wedding, new kitchen, sofa')).toHaveValue('Sony WH-1000XM6 Headphones')
    await expect(page.locator('input[type="number"]').nth(0)).toHaveValue(/299/)
  })

  test('a missing/failing endpoint falls back quietly to manual entry', async ({ page }) => {
    // No route mock: the dev server returns no JSON function here.
    await openBigPurchaseDetails(page)
    await page.getByPlaceholder(urlField).fill('https://www.example.com/some/product')

    await expect(page.getByText(/Couldn't read that page/)).toBeVisible()
    // Nothing the user hadn't typed gets filled in.
    await expect(page.getByPlaceholder('e.g. Wedding, new kitchen, sofa')).toHaveValue('')
    await expect(page.locator('input[type="number"]').nth(0)).toHaveValue('')
  })

  test('the link field is not offered for the emergency fund', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Go to Emergency fund' }).click()
    await page.getByRole('button', { name: 'Get started with Emergency fund', exact: true }).click()

    await expect(page.getByText('How big a cushion?')).toBeVisible()
    await expect(page.getByPlaceholder(urlField)).toHaveCount(0)
  })
})
