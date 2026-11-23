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
})

// #314: every wide table and formula on the docs pages is an `overflowX: auto`
// box, and none of them had a tabIndex, a role or a name. Most contain nothing
// focusable, so in browsers that don't make scrollers focusable on their own
// (Safari, older Chromium) the hidden rate and threshold columns were out of
// keyboard reach entirely — WCAG 2.1.1, and axe's
// `scrollable-region-focusable`.
test.describe('the docs pages at a phone width', () => {
  const PHONE = { width: 360, height: 780 }

  /** The pages, with a region each one has that is wide enough to scroll at 360px. */
  const PAGES = [
    { path: '/methodology/salary/', region: 'Income tax bands and rates' },
    { path: '/methodology/vehicle/', region: 'Road tax charges, the rates used and when each applies' },
    { path: '/sources/', region: 'Every source behind the numbers, and what each one backs' },
  ] as const

  for (const { path, region } of PAGES) {
    test(`a wide table on ${path} is reachable by keyboard and scrolls with the arrow keys`, async ({ page }) => {
      await page.setViewportSize(PHONE)
      await page.goto(path)

      const scroller = page.getByRole('region', { name: region })
      await expect(scroller).toBeVisible()

      // It really does overflow here — otherwise the rest proves nothing.
      const overflow = await scroller.evaluate((el) => el.scrollWidth - el.clientWidth)
      expect(overflow).toBeGreaterThan(0)

      // Reachable with the keyboard, and showing a focus ring once there.
      await scroller.focus()
      await expect(scroller).toBeFocused()
      const outlineWidth = await scroller.evaluate((el) => getComputedStyle(el).outlineWidth)
      expect(outlineWidth).not.toBe('0px')

      // And the arrow keys bring the hidden columns into view.
      expect(await scroller.evaluate((el) => el.scrollLeft)).toBe(0)
      await page.keyboard.press('ArrowRight')
      await expect.poll(async () => scroller.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0)
    })
  }

  test('a table that fits adds no extra tab stop on a desktop', async ({ page }) => {
    // The conditional half of the rule: at 1280px the same tables fit, so a
    // reader tabbing through the page should not meet them at all.
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/methodology/salary/')

    const measured = await page.evaluate(() =>
      [...document.querySelectorAll('.doc-scroller')].map((el) => ({
        overflow: el.scrollWidth - el.clientWidth,
        tabIndex: el.getAttribute('tabindex'),
      })),
    )
    expect(measured.length).toBeGreaterThan(0)

    // Focusable exactly when it has something hidden to scroll to, and at
    // this width that is none of them.
    expect(measured.filter(({ overflow }) => overflow > 0)).toEqual([])
    expect(measured.map(({ tabIndex }) => tabIndex)).toEqual(measured.map(() => null))
  })
})
