/* eslint-disable no-await-in-loop -- each field must be filled and measured before
   the next: filling scrolls the field into view, so measuring them in parallel
   would read boxes from a layout that's still moving. */
import { test, expect, type Locator, type Page } from '@playwright/test'

// The running-costs fuel row packs three unit fields side by side. Each one
// reserves room for its unit suffix ("miles", "mpg", "p/litre"), and on a
// phone that reservation used to be able to eat the field's entire width,
// hiding the value the user had just typed. These tests measure the room
// actually left for digits rather than trusting the layout to look right.

const PHONE = { width: 375, height: 812 }
const DESKTOP = { width: 1280, height: 900 }

/** The three fuel fields, by the label each sits under. */
const FUEL_FIELDS = [
  { label: 'Miles you drive / year', value: '12000' },
  { label: 'Average fuel economy', value: '38' },
  { label: 'Fuel price', value: '148.9' },
] as const

/** The input under a FieldLabel, found by its label text — as in vehicle-flow.spec.ts. */
function labelledInput(page: Page, label: string) {
  return page.getByText(label).locator('xpath=following-sibling::div//input')
}

/** Lands on the vehicle flow's Running costs step with the car named and priced. */
async function goToRunningCosts(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Go to Vehicle' }).click()
  await page.getByRole('button', { name: 'Get started with Vehicle', exact: true }).click()

  await page.getByPlaceholder('e.g. Volkswagen Golf').fill('VW Golf')
  await page.locator('input[type="number"]').nth(0).fill('22000')

  await page.getByRole('button', { name: 'Running costs', exact: true }).click()
  await expect(page.getByText('What will it cost to keep on the road?')).toBeVisible()
}

/** How many columns the fuel grid has resolved to at the current width. */
async function fuelGridColumnCount(page: Page): Promise<number> {
  return labelledInput(page, 'Fuel price').evaluate((el) => {
    let node = el.parentElement
    while (node && getComputedStyle(node).display !== 'grid') node = node.parentElement
    if (!node) throw new Error('No grid ancestor found for the fuel fields')
    return getComputedStyle(node).gridTemplateColumns.split(' ').length
  })
}

interface FieldMetrics {
  /** Width left for the value once the field's own horizontal padding is taken off. */
  contentWidth: number
  /** True when the typed value is wider than the box showing it, i.e. digits are cut off. */
  clipped: boolean
}

async function measure(input: Locator): Promise<FieldMetrics> {
  const box = await input.boundingBox()
  expect(box).not.toBeNull()
  return input.evaluate((el: HTMLInputElement, width: number) => {
    const style = getComputedStyle(el)
    const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
    return { contentWidth: width - padding, clipped: el.scrollWidth > el.clientWidth }
  }, box!.width)
}

test.describe('vehicle running costs at a narrow viewport', () => {
  test('every fuel field still has room to show its typed value at 375px', async ({ page }) => {
    await page.setViewportSize(PHONE)
    await goToRunningCosts(page)

    // Three tracks can't be made to work in ~200px of tile; the grid drops to
    // one at this width so each field gets the room the value needs.
    expect(await fuelGridColumnCount(page)).toBe(1)

    for (const field of FUEL_FIELDS) {
      const input = labelledInput(page, field.label)
      await input.fill(field.value)

      const { contentWidth, clipped } = await measure(input)
      // The regression this guards: "Fuel price" measured 56px wide against
      // its own 56px padding-right, leaving zero px for the digits.
      expect(contentWidth, `${field.label} has no room for its value`).toBeGreaterThan(0)
      expect(clipped, `${field.label} clips "${field.value}"`).toBe(false)
    }
  })

  test('the fuel fields stay usable down to 360px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 })
    await goToRunningCosts(page)

    for (const field of FUEL_FIELDS) {
      const input = labelledInput(page, field.label)
      await input.fill(field.value)
      const { contentWidth } = await measure(input)
      expect(contentWidth, `${field.label} has no room for its value`).toBeGreaterThan(0)
    }
  })

  test('the unit suffix is still visible beside each value, not overlapping it', async ({ page }) => {
    await page.setViewportSize(PHONE)
    await goToRunningCosts(page)

    for (const [index, field] of FUEL_FIELDS.entries()) {
      const input = labelledInput(page, field.label)
      await input.fill(field.value)

      const unit = page.getByText(['miles', 'mpg', 'p/litre'][index], { exact: true }).last()
      await expect(unit).toBeVisible()

      const inputBox = await input.boundingBox()
      const unitBox = await unit.boundingBox()
      expect(inputBox).not.toBeNull()
      expect(unitBox).not.toBeNull()
      // The unit sits clear of the value's box rather than on top of it, and
      // stays right beside it rather than drifting off to the far edge.
      const gap = unitBox!.x - (inputBox!.x + inputBox!.width)
      expect(gap, `${field.label}'s unit overlaps its value`).toBeGreaterThanOrEqual(-1)
      expect(gap, `${field.label}'s unit is detached from its value`).toBeLessThanOrEqual(16)
    }
  })

  test('the desktop layout keeps the three fuel fields on one row', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await goToRunningCosts(page)

    // Asserted off the grid's resolved track list rather than by comparing
    // bounding boxes: filling a field scrolls it into view, so y positions
    // measured one field at a time drift and can't prove "same row".
    expect(await fuelGridColumnCount(page)).toBe(3)

    const xs = []
    for (const field of FUEL_FIELDS) {
      const box = await labelledInput(page, field.label).boundingBox()
      expect(box).not.toBeNull()
      xs.push(box!.x)
    }
    // Left to right, in the order they're declared.
    expect(xs[0]).toBeLessThan(xs[1])
    expect(xs[1]).toBeLessThan(xs[2])
  })
})
