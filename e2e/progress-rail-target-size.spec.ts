import { test, expect, type Page } from '@playwright/test'

// WCAG 2.2 SC 2.5.8 Target Size (Minimum), AA: a pointer target must be at
// least 24×24 CSS px. ProgressRail used to wrap only the visible dot in its
// <button> with `padding: 0`, so a step's hit area *was* the dot — measured on
// dev at 10×10px active and 7×7px inactive. The spacing exception didn't apply
// either: with `gap: 16` and a 7px dot, two inactive dots' centres were 23px
// apart, so 24×24 circles centred on them would overlap.
//
// The dots are the only way to jump between steps, so this has to be measured
// where layout really happens, not in jsdom. ProgressRail.test.tsx pins the
// styling that produces these sizes.

/** WCAG 2.2 SC 2.5.8's minimum, and the value of `--target-size-min`. */
const MIN_TARGET = 24

/** Lands on a flow with the rail showing, having filled enough to reach the later steps. */
async function goToRail(page: Page) {
  await page.goto('/?goalId=big&mode=save&saveFlavor=goal&itemPrice=1200&takeHome=2000')
  const rail = page.getByLabel('Step progress')
  await expect(rail.getByRole('button').first()).toBeVisible()
  return rail
}

type Rect = { x: number; y: number; width: number; height: number }

/** Every rail button's label and bounding box, read in one pass. */
async function railBoxes(page: Page): Promise<{ label: string; box: Rect }[]> {
  const buttons = page.getByLabel('Step progress').getByRole('button')
  const count = await buttons.count()
  expect(count, 'the rail has steps to measure').toBeGreaterThan(0)

  return Promise.all(
    Array.from({ length: count }, async (_unused, index) => {
      const button = buttons.nth(index)
      const [label, box] = await Promise.all([button.getAttribute('aria-label'), button.boundingBox()])
      if (!box) throw new Error(`expected rail button ${index} to be laid out`)
      return { label: label ?? '', box }
    }),
  )
}

/** Each box is big enough to be a target, and no two of them overlap. */
function expectTargetsAreBigAndSeparate(measured: { label: string; box: Rect }[]) {
  for (const { label, box } of measured) {
    expect(box.width, `${label}: target width`).toBeGreaterThanOrEqual(MIN_TARGET)
    expect(box.height, `${label}: target height`).toBeGreaterThanOrEqual(MIN_TARGET)
  }

  // The rail is a single column, so neighbours can only overlap vertically.
  for (let i = 1; i < measured.length; i += 1) {
    const previous = measured[i - 1]
    const current = measured[i]
    expect(current.box.y, `${current.label} starts below ${previous.label}`).toBeGreaterThanOrEqual(previous.box.y + previous.box.height)
  }
}

for (const [name, viewport] of [
  ['desktop', { width: 1280, height: 900 }],
  ['a narrow phone', { width: 360, height: 780 }],
] as const) {
  test.describe(`ProgressRail target size at ${name}`, () => {
    test.use({ viewport })

    test('every step is at least 24×24px, with no two hit areas overlapping', async ({ page }) => {
      await goToRail(page)
      expectTargetsAreBigAndSeparate(await railBoxes(page))
    })

    test('the sizes still hold after the active step moves, where the dot is bigger', async ({ page }) => {
      const rail = await goToRail(page)
      await rail.getByRole('button', { name: 'Budget', exact: true }).click()
      await expect(rail.getByRole('button', { name: 'Budget', exact: true })).toHaveAttribute('aria-current', 'step')

      expectTargetsAreBigAndSeparate(await railBoxes(page))
    })

    test('clicking a button away from its dot still selects that step', async ({ page }) => {
      const rail = await goToRail(page)
      const plan = rail.getByRole('button', { name: 'Plan', exact: true })
      const box = await plan.boundingBox()
      if (!box) throw new Error('expected the Plan button to be laid out')

      // The top-left corner of the hit area: inside the button, but well clear
      // of the 7px dot centred in it. On dev there was no button here to hit.
      await plan.click({ position: { x: 2, y: 2 } })
      await expect(plan).toHaveAttribute('aria-current', 'step')
    })

    test('the dots themselves are unchanged: 7px inactive, 10px active', async ({ page }) => {
      const rail = await goToRail(page)
      const active = rail.getByRole('button', { name: 'Goal', exact: true }).locator('> span')
      const inactive = rail.getByRole('button', { name: 'Result', exact: true }).locator('> span')

      const [activeBox, inactiveBox] = await Promise.all([active.boundingBox(), inactive.boundingBox()])
      if (!activeBox || !inactiveBox) throw new Error('expected both dots to be laid out')

      // --dot-size-active / --dot-size-inactive, untouched by #286.
      expect(activeBox.width).toBeCloseTo(10, 1)
      expect(activeBox.height).toBeCloseTo(10, 1)
      expect(inactiveBox.width).toBeCloseTo(7, 1)
      expect(inactiveBox.height).toBeCloseTo(7, 1)

      // Visibly smaller than the target around them — the point of the change.
      expect(activeBox.width).toBeLessThan(MIN_TARGET)
    })

    test('the focus ring is not clipped at the viewport edge', async ({ page }) => {
      const rail = await goToRail(page)
      const goal = rail.getByRole('button', { name: 'Goal', exact: true })
      await goal.focus()
      await expect(goal).toBeFocused()

      const box = await goal.boundingBox()
      if (!box) throw new Error('expected the Goal button to be laid out')

      // The button, now 24px wide rather than 10px, still sits fully inside
      // the viewport with room for an outline drawn around it.
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
      expect(viewport.width - (box.x + box.width), 'room to the right of the rail for a focus ring').toBeGreaterThanOrEqual(3)

      // And focusing it doesn't push the page sideways.
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow).toBeLessThanOrEqual(0)
    })
  })
}

test.describe('ProgressRail target size on the longer vehicle rail', () => {
  test('all six vehicle steps are big enough and separate', async ({ page }) => {
    // The vehicle flow has six steps rather than five, so the rail is at its
    // tallest — the case where bigger buttons are most likely to collide.
    await page.goto('/')
    await page.getByRole('button', { name: 'Go to Vehicle' }).click()
    await page.getByRole('button', { name: 'Get started with Vehicle', exact: true }).click()

    const measured = await railBoxes(page)
    expect(measured.map((step) => step.label)).toEqual(['Goal', 'Details', 'Paying for it', 'Running costs', 'Budget', 'Result'])
    expectTargetsAreBigAndSeparate(measured)
  })
})
