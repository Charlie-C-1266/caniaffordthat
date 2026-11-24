import { test, expect } from '@playwright/test'

// WCAG 2.2 SC 1.4.13 (Content on Hover or Focus, AA): content shown on hover or
// focus must be dismissible without moving the pointer or focus. Before #284
// InfoHint had no keyboard dismissal at all — a keyboard or screen-magnifier
// user who tabbed onto a hint could only close its popover (up to 260px, sitting
// over the field above) by tabbing away.
//
// InfoHint's own unit tests cover the state machine in jsdom. This spec is the
// real-browser half: a genuine keyboard focus and a genuine Escape keypress,
// through an actual hinted field in the app.
//
// The emergency fund's Details step is the hint used here because it needs no
// typed input to reach: the goal carries a hint beside its heading
// (KIND_PRESENTATION.emergency.details.hint in lib/goals.ts).
const HINT = 'A common rule of thumb is 3–6 months of essential spending set aside.'

test.describe('InfoHint keyboard dismissal', () => {
  test('Escape hides a focus-opened tooltip and leaves focus on the hint', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Go to Emergency fund' }).click()
    await page.getByRole('button', { name: 'Get started with Emergency fund', exact: true }).click()

    const hint = page.getByRole('button', { name: HINT })
    await expect(hint).toBeVisible()
    await expect(page.getByRole('tooltip')).toHaveCount(0)

    // Keyboard focus, not a click: the SC is about content shown on focus.
    await hint.focus()
    await expect(page.getByRole('tooltip')).toHaveText(HINT)
    await expect(hint).toHaveAttribute('aria-expanded', 'true')

    await page.keyboard.press('Escape')

    await expect(page.getByRole('tooltip')).toHaveCount(0)
    await expect(hint).toHaveAttribute('aria-expanded', 'false')
    // Dismissing must not move focus — that is the other half of the SC.
    await expect(hint).toBeFocused()
  })

  test('the hint reopens after an Escape, and Escape closes a hover-opened tooltip too', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Go to Emergency fund' }).click()
    await page.getByRole('button', { name: 'Get started with Emergency fund', exact: true }).click()

    const hint = page.getByRole('button', { name: HINT })
    await hint.focus()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('tooltip')).toHaveCount(0)

    // Escape dismisses the tooltip; it does not suppress the hint from then
    // on. Tab away and back and it opens again, exactly as before.
    await page.keyboard.press('Tab')
    await expect(hint).not.toBeFocused()
    await hint.focus()
    await expect(page.getByRole('tooltip')).toHaveCount(1)

    await page.keyboard.press('Escape')
    await expect(page.getByRole('tooltip')).toHaveCount(0)

    // A hover-opened tooltip leaves focus wherever it already was, so this
    // only passes because the Escape listener is on the document rather than
    // bound to the button. Blur first, so the open below is the hover's doing.
    await page.locator('body').click({ position: { x: 5, y: 5 } })
    await expect(page.getByRole('tooltip')).toHaveCount(0)

    await hint.hover()
    await expect(page.getByRole('tooltip')).toHaveCount(1)
    await expect(hint).not.toBeFocused()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('tooltip')).toHaveCount(0)
  })
})
