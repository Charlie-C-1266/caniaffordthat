import { test, expect, type Locator, type Page } from '@playwright/test'
import { goToPlan } from './helpers'

// The brand mark and the top-right controls are both `position: fixed` and
// anchored to opposite corners, so nothing stops them growing into each other
// at narrow widths. 360px is the narrowest width this app supports; the rest
// bracket the breakpoint (600px) where the compact header layout kicks in.
const NARROW_WIDTHS = [360, 375, 414, 480, 560]

/** Each top-right control, checked individually — the row's own box can clear the brand mark while a child still doesn't. */
function topRightControls(page: Page): [string, Locator][] {
  return [
    ['Our sources', page.getByRole('link', { name: 'Our sources' })],
    ['theme toggle', page.getByTestId('theme-toggle')],
    ['Start over', page.getByRole('button', { name: 'Start over' })],
  ]
}

async function expectNoOverlapWithBrandMark(page: Page) {
  const controls = topRightControls(page)
  const [brand, ...boxes] = await Promise.all(
    [page.getByTestId('brand-mark'), ...controls.map(([, locator]) => locator)].map((l) => l.boundingBox()),
  )

  expect(brand, 'brand mark should be rendered').not.toBeNull()
  if (!brand) return

  boxes.forEach((box, i) => {
    const name = controls[i][0]
    expect(box, `${name} should be rendered`).not.toBeNull()
    if (!box) return

    const overlapsHorizontally = brand.x < box.x + box.width && box.x < brand.x + brand.width
    const overlapsVertically = brand.y < box.y + box.height && box.y < brand.y + brand.height

    expect(
      overlapsHorizontally && overlapsVertically,
      `brand mark [${brand.x}..${brand.x + brand.width}] overlaps "${name}" [${box.x}..${box.x + box.width}]`,
    ).toBe(false)
  })
}

test.describe('persistent header at narrow viewports', () => {
  for (const width of NARROW_WIDTHS) {
    test(`brand mark and top-right controls don't overlap at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 812 })
      await page.goto('/')
      await page.getByTestId('brand-mark').waitFor()

      await expectNoOverlapWithBrandMark(page)
    })
  }

  test('stays clear of the controls on a later step, not just the landing screen', async ({ page }) => {
    // Both clusters are `fixed`, so they persist across every step — a layout
    // that only clears on the landing screen would still collide mid-flow.
    await page.setViewportSize({ width: 375, height: 812 })
    await goToPlan(page)

    await expectNoOverlapWithBrandMark(page)
  })

  test('the controls still work once the compact layout is in effect', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.setViewportSize({ width: 375, height: 812 })
    await goToPlan(page)

    // The wordmark is dropped below the breakpoint, but the Alpha badge stays
    // (this is the build most casual visitors land on) and all three controls
    // remain usable.
    const brandMark = page.getByTestId('brand-mark')
    await expect(brandMark.getByText('Can I Afford That?')).toBeHidden()
    await expect(brandMark.getByText('Alpha')).toBeVisible()

    await expect(page.getByRole('link', { name: 'Our sources' })).toHaveAttribute('href', '/sources/')

    await page.getByTestId('theme-toggle').click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')

    await page.getByRole('button', { name: 'Start over' }).click()
    await expect(page.getByRole('heading', { name: 'What are you saving for?' })).toBeVisible()
  })

  test('the desktop header keeps its full wordmark and spacing', async ({ page }) => {
    // Guards the other direction: the compact layout must not leak upward into
    // the supported desktop widths.
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/')

    const brandMark = page.getByTestId('brand-mark')
    await expect(brandMark.getByText('Can I Afford That?')).toBeVisible()
    expect((await brandMark.boundingBox())?.x).toBe(26)

    await expectNoOverlapWithBrandMark(page)
  })
})
