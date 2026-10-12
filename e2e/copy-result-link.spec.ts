import { test, expect } from '@playwright/test'
import { goToPlan, goToResult } from './helpers'

/*
 * The result card's share action reports its outcome by swapping the button's
 * label, which a screen reader does not notice. These check the polite live
 * region that announces it instead — in a real browser, where the clipboard
 * API and the visually-hidden styles both actually exist.
 */
test.describe('copy result link announcement', () => {
  test('the live region is present and empty before the button is clicked', async ({ page }) => {
    await goToPlan(page)
    await goToResult(page)

    const status = page.getByRole('status')
    await expect(status).toHaveCount(1)
    // Already in the DOM, so the later text change is a change the browser
    // can announce rather than a freshly inserted node.
    await expect(status).toHaveText('')
  })

  test('a successful copy is announced, then the region empties again', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await goToPlan(page)
    await goToResult(page)

    const status = page.getByRole('status')
    await page.getByRole('button', { name: 'Copy result link' }).click()

    await expect(status).toHaveText('Link copied')
    // The visible label still says its own thing — the announcement is a
    // sibling, not part of the button's name.
    await expect(page.getByRole('button', { name: 'Link copied ✓' })).toBeVisible()

    // The 2s label window ends and takes the announcement with it.
    await expect(status).toHaveText('', { timeout: 4000 })
    await expect(page.getByRole('button', { name: 'Copy result link' })).toBeVisible()
  })

  test('a failed copy is announced too — the message most worth hearing', async ({ page }) => {
    await goToPlan(page)
    await goToResult(page)

    // Break both paths the clipboard helper tries: the async API and the
    // legacy execCommand fallback. Without this the copy simply succeeds in
    // Chromium, and the failure branch is unreachable from e2e.
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: () => Promise.reject(new Error('denied')),
        },
      })
      document.execCommand = () => false
    })

    await page.getByRole('button', { name: 'Copy result link' }).click()

    await expect(page.getByRole('status')).toHaveText("Couldn't copy the link — try again")
    await expect(page.getByRole('button', { name: "Couldn't copy — try again" })).toBeVisible()
  })

  test('the announcement is in the accessibility tree but takes up no visible space', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await goToPlan(page)
    await goToResult(page)

    await page.getByRole('button', { name: 'Copy result link' }).click()
    const status = page.getByRole('status')
    await expect(status).toHaveText('Link copied')

    // Clipped to a 1px box rather than hidden with display/visibility, which
    // would drop it out of the accessibility tree and silence it.
    const box = await status.boundingBox()
    expect(box?.width).toBeLessThanOrEqual(1)
    expect(box?.height).toBeLessThanOrEqual(1)
    const { display, visibility } = await status.evaluate((el) => {
      const s = getComputedStyle(el)
      return { display: s.display, visibility: s.visibility }
    })
    expect(display).not.toBe('none')
    expect(visibility).toBe('visible')

    // And it is reachable by role, which is what an assistive technology
    // walking the tree would find.
    await expect(status).toHaveAttribute('role', 'status')
  })
})
