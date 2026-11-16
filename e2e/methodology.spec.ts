import { test, expect } from '@playwright/test'

test.describe('vehicle methodology page', () => {
  test('publishes the working: verdict bands, formulas, tax table and the depreciation chart', async ({ page }) => {
    await page.goto('/methodology/vehicle/')

    await expect(page.getByRole('heading', { name: 'How the vehicle calculator works' })).toBeVisible()

    // The verdict bands quote the real thresholds.
    await expect(page.getByText('Fits comfortably')).toBeVisible()
    await expect(page.getByText('Up to 20%')).toBeVisible()

    // The PCP formula (with the balloon term) is published.
    await expect(page.getByText(/PCP payment/).first()).toBeVisible()

    // The VED table shows the rates in force, straight from the constants.
    await expect(page.getByText('£200/year', { exact: true })).toBeVisible()
    await expect(page.getByText('+£440/year', { exact: true })).toBeVisible()

    // The depreciation line chart is drawn, with its mileage legend.
    await expect(page.getByRole('img', { name: /generic depreciation curve/i })).toBeVisible()
    await expect(page.getByText('8,000 miles/year (UK average)')).toBeVisible()

    // Honesty section: the page owns its simplifications.
    await expect(page.getByText("What we deliberately don't model (yet)")).toBeVisible()

    // And a way back to the calculator.
    await expect(page.getByRole('link', { name: '← Back to the calculator' })).toBeVisible()
  })

  test('the worked example is computed from the live maths, not hard-coded copy', async ({ page }) => {
    await page.goto('/methodology/vehicle/')
    // £20,000 brand new over 48 months at average mileage -> the same £7,443
    // estimate the calculator itself produces (see vehicle-flow.spec.ts).
    await expect(page.getByText(/£7,443/).first()).toBeVisible()
  })

  test('the vehicle result card links to the methodology page', async ({ page }) => {
    await page.goto('/?goalId=car&itemPrice=15000&takeHome=2500')
    await page.getByRole('button', { name: 'Result', exact: true }).click()
    await page.getByText('Copy result link').waitFor()

    const link = page.getByRole('link', { name: /how these numbers are worked out/i })
    await expect(link).toHaveAttribute('href', '/methodology/vehicle/')
  })
})

test.describe('salary methodology page', () => {
  test('publishes the working: the tax and NI bands, the £100k taper, and the honesty section', async ({ page }) => {
    await page.goto('/methodology/salary/')

    await expect(page.getByRole('heading', { name: /what salary would I need/i })).toBeVisible()

    // The income-tax bands quote the real thresholds, straight from the constants.
    await expect(page.getByText('£12,570 to £50,270').first()).toBeVisible()
    await expect(page.getByText('Over £125,140').first()).toBeVisible()

    // The £100k allowance-taper section is called out.
    await expect(page.getByText(/£100,000 .*tax trap/i)).toBeVisible()

    // Honesty section, and a way back.
    await expect(page.getByText("What we deliberately don't model (yet)")).toBeVisible()
    await expect(page.getByRole('link', { name: '← Back to the calculator' })).toBeVisible()
  })

  test('the worked example is computed from the live maths, not hard-coded copy', async ({ page }) => {
    await page.goto('/methodology/salary/')
    // A £50,000 salary -> £39,520 take-home, straight from netFromGross.
    await expect(page.getByText(/£39,520/).first()).toBeVisible()
  })

  test('the result card links to the salary methodology page', async ({ page }) => {
    await page.goto('/?goalId=big&itemPrice=15000&takeHome=2500')
    await page.getByRole('button', { name: 'Result', exact: true }).click()
    await page.getByText('Copy result link').waitFor()

    const link = page.getByRole('link', { name: /how this is worked out/i })
    await expect(link).toHaveAttribute('href', '/methodology/salary/')
  })

  test('the docs tables name each row for assistive tech, and the first column still looks unchanged', async ({ page }) => {
    // #285: the first column was styled as the row's name but emitted as a
    // plain `<td>`, and the headers had no `scope`, so moving across a row in
    // a screen reader read values with no row context (WCAG 1.3.1).
    //
    // Worth checking in a real browser as well as in jsdom: `<th>` has its own
    // UA defaults (`text-align: center`, `font-weight: bold`), so only a
    // computed style proves the reset holds and the column looks as it did.
    await page.goto('/methodology/salary/')

    const tables = page.getByRole('table')
    const tableCount = await tables.count()
    expect(tableCount).toBeGreaterThan(0)

    const perTable = await Promise.all(
      Array.from({ length: tableCount }, async (_unused, index) => {
        const table = tables.nth(index)
        const [bodyRows, rowHeaders, scopes, headerScopes] = await Promise.all([
          table.locator('tbody tr').count(),
          table.getByRole('rowheader').count(),
          table.getByRole('rowheader').evaluateAll((cells) => cells.map((cell) => cell.getAttribute('scope'))),
          table.getByRole('columnheader').evaluateAll((cells) => cells.map((cell) => cell.getAttribute('scope'))),
        ])
        return { bodyRows, rowHeaders, scopes, headerScopes }
      }),
    )

    for (const { bodyRows, rowHeaders, scopes, headerScopes } of perTable) {
      expect(bodyRows).toBeGreaterThan(0)
      // One row header per body row, every one scoped to its row.
      expect(rowHeaders).toBe(bodyRows)
      expect(scopes.every((scope) => scope === 'row')).toBe(true)
      expect(headerScopes.every((scope) => scope === 'col')).toBe(true)
    }

    // The first column's own appearance: left-aligned and the same weight and
    // colour it had as a `<td>`, not the browser's centred bold `<th>`.
    const firstRowHeader = tables.first().getByRole('rowheader').first()
    await expect(firstRowHeader).toHaveCSS('text-align', 'left')
    await expect(firstRowHeader).toHaveCSS('font-weight', '700')

    const [rowHeaderColour, cellColour] = await Promise.all([
      firstRowHeader.evaluate((el) => getComputedStyle(el).color),
      tables
        .first()
        .getByRole('cell')
        .first()
        .evaluate((el) => getComputedStyle(el).color),
    ])
    // The row name is the primary text colour; the values beside it are dimmer.
    expect(rowHeaderColour).not.toBe(cellColour)
  })
})
