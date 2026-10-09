import { test, expect, type Locator, type Page } from '@playwright/test'

// The project config emulates reduced motion so the auto-rotate timer can't
// race the other specs. This file is the one place that needs the real
// transition, since the bug in #156 was precisely that a move finished
// instantly: under `reduce` a snap and a slide are indistinguishable.
test.use({ reducedMotion: 'no-preference' })

// The card transition in GoalPickerStep.
const SLIDE_MS = 500
// Early enough to be mid-flight, late enough that the browser has definitely
// painted a frame. The curve is a strong ease-out, so by here a sliding card
// is roughly half-way — comfortably clear of both ends.
const MID_FLIGHT_MS = 60

/**
 * Left edge of a card, in page coordinates — the quantity #156 was measured
 * in. Matched on either accessible name the card can carry, since it is
 * sampled both before and after it becomes the focused one.
 */
async function cardX(page: Page, goalName: string): Promise<number> {
  const card = page.getByRole('button', { name: new RegExp(`^(Focus|Continue with) ${goalName}$`) })
  const box = await card.boundingBox()
  if (!box) throw new Error(`card for ${goalName} has no box`)
  return box.x
}

/** Focuses a goal by its dot and waits for the move to settle. */
async function focusAndSettle(page: Page, goalName: string) {
  await page.getByRole('button', { name: `Go to ${goalName}` }).click()
  await page.waitForTimeout(SLIDE_MS + 100)
}

/** The dot for a goal, without clicking it. */
function dot(page: Page, goalName: string): Locator {
  return page.getByRole('button', { name: `Go to ${goalName}` })
}

test.describe('goal carousel slide', () => {
  test('a dot two positions away slides the focused card in rather than snapping (#156)', async ({ page }) => {
    await page.goto('/')

    // Focusing a goal also marks the carousel "engaged", which stops the
    // auto-rotate timer — otherwise it would move the strip mid-measurement.
    await focusAndSettle(page, 'Holiday')

    // Holiday -> Luxury item: two positions, the exact move the issue measured.
    const before = await cardX(page, 'Luxury item')
    await dot(page, 'Luxury item').click()
    await page.waitForTimeout(MID_FLIGHT_MS)
    const midFlight = await cardX(page, 'Luxury item')
    await page.waitForTimeout(SLIDE_MS + 100)
    const settled = await cardX(page, 'Luxury item')

    // It really did travel, so there is a journey to be part-way through.
    expect(Math.abs(before - settled)).toBeGreaterThan(100)

    // The snap this fixes: mid-flight was already the final position.
    expect(midFlight, `mid-flight x ${midFlight} should not have reached the settled ${settled}`).not.toBeCloseTo(settled, 0)
    // Strictly between the two ends, by a clear margin either side.
    const [low, high] = before < settled ? [before, settled] : [settled, before]
    expect(midFlight).toBeGreaterThan(low + 5)
    expect(midFlight).toBeLessThan(high - 5)
  })

  test('a one-step move still slides, exactly as before (#156)', async ({ page }) => {
    // The regression guard on the other half of the fix: single steps were
    // already correct and must stay that way.
    await page.goto('/')
    await focusAndSettle(page, 'Holiday')

    const before = await cardX(page, 'Emergency fund')
    await dot(page, 'Emergency fund').click()
    await page.waitForTimeout(MID_FLIGHT_MS)
    const midFlight = await cardX(page, 'Emergency fund')
    await page.waitForTimeout(SLIDE_MS + 100)
    const settled = await cardX(page, 'Emergency fund')

    expect(Math.abs(before - settled)).toBeGreaterThan(100)
    const [low, high] = before < settled ? [before, settled] : [settled, before]
    expect(midFlight).toBeGreaterThan(low + 5)
    expect(midFlight).toBeLessThan(high - 5)
  })
})
