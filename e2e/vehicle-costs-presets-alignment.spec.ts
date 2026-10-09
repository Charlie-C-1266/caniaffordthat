import { test, expect, type Page } from '@playwright/test'

// Two layout defects on the vehicle Running costs step at phone widths: the
// three maintenance preset chips could not wrap, so the last one ran out past
// the tile's rounded edge; and the "Road tax (VED) / year" label wraps onto
// one more line than "Insurance / year", which left the two £ inputs 17px out
// of line with each other. Both are measured here rather than eyeballed.
//
// Every measurement is taken inside a single page.evaluate. Locator.boundingBox
// scrolls its element into view first, so reading two elements with two calls
// on this long page returns coordinates from two different scroll positions —
// which is what makes a naive "are these on the same row?" check unreliable.

const PHONE_WIDTHS = [360, 375] as const
const DESKTOP = { width: 1280, height: 900 }
const PRESET_LABELS = ['Budget £35', 'Average £60', 'Premium £130'] as const

interface Metrics {
  /** Each preset chip, in DOM order. */
  chips: { label: string; top: number; left: number; right: number }[]
  /** The right edge of the content box of the tile the chips sit in. */
  tileContentRight: number
  /** Top edge of the Insurance and Road tax inputs, and their left edges. */
  insurance: { top: number; left: number; height: number }
  ved: { top: number; left: number; height: number }
}

async function measure(page: Page): Promise<Metrics> {
  return page.evaluate(() => {
    const labels = [...document.querySelectorAll('label')]
    const labelled = (text: string) => labels.find((l) => l.textContent?.includes(text))
    const inputFor = (text: string) => labelled(text)?.parentElement?.querySelector('input')

    const insuranceInput = inputFor('Insurance / year')
    const vedInput = inputFor('Road tax (VED)')
    if (!insuranceInput || !vedInput) throw new Error('Insurance/VED inputs not found')

    const chipEls = [...document.querySelectorAll('button')].filter((b) => /^(Budget|Average|Premium) £\d+$/.test(b.textContent ?? ''))
    if (chipEls.length !== 3) throw new Error(`Expected 3 preset chips, found ${chipEls.length}`)

    // Walk up to the padded tile the chips live in.
    let tile: HTMLElement | null = chipEls[0].parentElement
    while (tile && parseFloat(getComputedStyle(tile).paddingLeft) < 20) tile = tile.parentElement
    if (!tile) throw new Error('No padded tile ancestor found for the preset chips')
    const tileRect = tile.getBoundingClientRect()

    // Tops are made document-relative so they stay comparable regardless of
    // where the page happens to be scrolled to; lefts/rights are viewport-
    // relative, which is what "inside the tile" is measured against.
    const insuranceRect = insuranceInput.getBoundingClientRect()
    const vedRect = vedInput.getBoundingClientRect()

    return {
      chips: chipEls.map((el) => {
        const rect = el.getBoundingClientRect()
        return { label: el.textContent ?? '', top: rect.top + window.scrollY, left: rect.left, right: rect.right }
      }),
      tileContentRight: tileRect.right - parseFloat(getComputedStyle(tile).paddingRight),
      insurance: { top: insuranceRect.top + window.scrollY, left: insuranceRect.left, height: insuranceRect.height },
      ved: { top: vedRect.top + window.scrollY, left: vedRect.left, height: vedRect.height },
    }
  })
}

async function goToRunningCosts(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Go to Vehicle' }).click()
  await page.getByRole('button', { name: 'Get started with Vehicle', exact: true }).click()

  await page.getByPlaceholder('e.g. Volkswagen Golf').fill('VW Golf')
  await page.locator('input[type="number"]').nth(0).fill('22000')

  await page.getByRole('button', { name: 'Running costs', exact: true }).click()
  await expect(page.getByText('What will it cost to keep on the road?')).toBeVisible()
}

test.describe('vehicle running costs — preset chips and field alignment', () => {
  for (const width of PHONE_WIDTHS) {
    test(`every maintenance preset chip stays inside the tile at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 812 })
      await goToRunningCosts(page)

      const { chips, tileContentRight } = await measure(page)
      for (const chip of chips) {
        // The regression: "Premium £130" ended 69px past the content box at
        // 360px, and 21px past the tile's own rounded edge.
        expect(chip.right, `"${chip.label}" overflows the tile's content box at ${width}px`).toBeLessThanOrEqual(tileContentRight + 1)
      }
    })

    test(`the Insurance and Road tax inputs line up at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 812 })
      await goToRunningCosts(page)

      const { insurance, ved } = await measure(page)
      // Level with each other, or stacked one per row — the issue accepts
      // either. What must not happen is the 17px offset of top-aligned items.
      const stacked = Math.abs(ved.left - insurance.left) < 1 && ved.top >= insurance.top + insurance.height
      if (!stacked) {
        expect(
          Math.abs(ved.top - insurance.top),
          `the two inputs are ${Math.abs(ved.top - insurance.top)}px out of line at ${width}px`,
        ).toBeLessThanOrEqual(1)
      }
    })

    test(`the page still does not scroll sideways at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 812 })
      await goToRunningCosts(page)

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow).toBeLessThanOrEqual(0)
    })
  }

  test('desktop keeps the three presets on one row and the two fields side by side', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await goToRunningCosts(page)

    const { chips, insurance, ved } = await measure(page)

    // One row, left to right in declaration order.
    expect(chips.map((c) => c.label)).toEqual([...PRESET_LABELS])
    expect(chips[0].left).toBeLessThan(chips[1].left)
    expect(chips[1].left).toBeLessThan(chips[2].left)
    expect(Math.abs(chips[0].top - chips[1].top)).toBeLessThanOrEqual(1)
    expect(Math.abs(chips[1].top - chips[2].top)).toBeLessThanOrEqual(1)

    // Side by side, and level with each other.
    expect(ved.left).toBeGreaterThan(insurance.left)
    expect(Math.abs(ved.top - insurance.top)).toBeLessThanOrEqual(1)
  })

  test('the presets still set the maintenance figure', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 812 })
    await goToRunningCosts(page)

    // "No behaviour change" is the other half of the issue.
    const maintenance = page.getByText('Maintenance / month').locator('xpath=following-sibling::div//input')
    await page.getByRole('button', { name: 'Premium £130' }).click()
    await expect(maintenance).toHaveValue('130')
    await page.getByRole('button', { name: 'Budget £35' }).click()
    await expect(maintenance).toHaveValue('35')
  })
})
