import { test, expect, type Locator, type Page } from '@playwright/test'

// #346: the keyboard focus ring is drawn just outside each control, on the
// page or card behind it, so it must contrast *that* background by at least
// 3:1 (WCAG 2.4.7 and 1.4.11). It used to be the control's own text colour,
// which vanished on filled buttons and on buttons with no colour set.

type Rgba = [number, number, number, number]

/** Parses a computed `rgb()`/`rgba()` colour. */
function parseColour(value: string): Rgba {
  const parts = value.match(/[\d.]+/g)?.map(Number) ?? []
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1]
}

/** `top` painted over an opaque `bottom`. */
function over(top: Rgba, bottom: Rgba): Rgba {
  const a = top[3]
  return [top[0] * a + bottom[0] * (1 - a), top[1] * a + bottom[1] * (1 - a), top[2] * a + bottom[2] * (1 - a), 1]
}

function linearChannel(c: number): number {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

/** WCAG relative luminance. */
function luminance([r, g, b]: Rgba): number {
  return 0.2126 * linearChannel(r) + 0.7152 * linearChannel(g) + 0.0722 * linearChannel(b)
}

/** WCAG contrast ratio between two opaque colours. */
function contrastRatio(a: Rgba, b: Rgba): number {
  const [lighter, darker] = [luminance(a), luminance(b)].toSorted((x, y) => y - x)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Focuses the control as a keyboard user would and checks its ring: the
 * outline's colour against the effective background behind it. That
 * background is every ancestor's background colour composited from the page
 * up, starting from the element itself when the ring is inset (a negative
 * offset, as on the docs' scrollers) and from its parent otherwise.
 */
async function expectVisibleRing(page: Page, control: Locator) {
  // A key press first marks the last interaction as keyboard, so the
  // programmatic focus below matches :focus-visible the way a Tab would.
  await page.keyboard.press('Shift')
  await control.focus()
  const reading = await control.evaluate((element) => {
    const style = getComputedStyle(element)
    const backgrounds: string[] = []
    const start = parseFloat(style.outlineOffset) < 0 ? element : element.parentElement
    for (let node: Element | null = start; node; node = node.parentElement) {
      backgrounds.push(getComputedStyle(node).backgroundColor)
    }
    return {
      focusVisible: element.matches(':focus-visible'),
      outlineStyle: style.outlineStyle,
      outlineColor: style.outlineColor,
      backgrounds,
    }
  })

  // The canvas behind <html> is white when nothing above it is painted.
  const background = reading.backgrounds.toReversed().reduce<Rgba>((below, layer) => over(parseColour(layer), below), [255, 255, 255, 1])
  const ring = over(parseColour(reading.outlineColor), background)

  expect(reading.focusVisible).toBe(true)
  expect(reading.outlineStyle).toBe('solid')
  expect(contrastRatio(ring, background)).toBeGreaterThanOrEqual(3)
}

for (const theme of ['dark', 'light'] as const) {
  test.describe(`focus ring contrast (${theme} theme)`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme })
    })

    test('the carousel dot and "Get started" show a ring that contrasts the page', async ({ page }) => {
      await page.goto('/')
      await expectVisibleRing(page, page.getByRole('button', { name: 'Go to Vehicle' }))
      // Focusing a dot brings its goal to the front, so its "Get started" is the Vehicle one.
      await expectVisibleRing(page, page.getByRole('button', { name: 'Get started with Vehicle', exact: true }))
    })

    test('the progress rail, the active segmented option and "Pick another goal" show a ring that contrasts the page', async ({ page }) => {
      await page.goto('/')
      await page.getByRole('button', { name: 'Go to Vehicle' }).click()
      await page.getByRole('button', { name: 'Get started with Vehicle', exact: true }).click()
      await page.getByPlaceholder('e.g. Volkswagen Golf').fill('VW Golf')
      await page.locator('input[type="number"]').nth(0).fill('22000')

      await expectVisibleRing(page, page.getByRole('button', { name: 'Goal', exact: true }))

      await page.getByRole('button', { name: 'Paying for it', exact: true }).click()
      const estimate = page.getByRole('button', { name: 'Estimate it for me' })
      await expect(estimate).toHaveAttribute('aria-pressed', 'true')
      await expectVisibleRing(page, estimate)

      await page.getByRole('button', { name: 'Budget', exact: true }).click()
      await page.getByLabel('Take-home pay / month').fill('2000')
      await page.getByRole('button', { name: 'Result', exact: true }).click()
      await page.getByText('Copy result link').waitFor()
      await expectVisibleRing(page, page.getByRole('button', { name: 'Pick another goal' }))
    })

    test('the docs header logo link and a scrolling table show a ring that contrasts the page', async ({ page }) => {
      // At 360px the salary page's tables overflow, which puts their
      // scrollers in the tab order (#314).
      await page.setViewportSize({ width: 360, height: 800 })
      await page.goto('/methodology/salary/')
      await expectVisibleRing(page, page.locator('header a[href="/"]').first())
      await expectVisibleRing(page, page.locator('.doc-scroller[tabindex="0"]').first())
    })
  })
}

test('a mouse click shows no focus ring', async ({ page }) => {
  await page.goto('/')
  const dot = page.getByRole('button', { name: 'Go to Vehicle' })
  await dot.click()
  await expect(dot).toBeFocused()
  const reading = await dot.evaluate((element) => ({
    focusVisible: element.matches(':focus-visible'),
    outlineStyle: getComputedStyle(element).outlineStyle,
  }))
  expect(reading).toEqual({ focusVisible: false, outlineStyle: 'none' })
})
