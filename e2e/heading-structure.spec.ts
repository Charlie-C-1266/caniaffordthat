import { test, expect, type Page } from '@playwright/test'
import { goToPlan, goToResult } from './helpers'

/*
 * The calculator is one scrolling page, so it gets one h1 — the landing
 * question — with every step's question and the result headline as an h2
 * under it. Before #168 each step rendered its own h1, so a holiday flow with
 * a result showing presented five unrelated "heading level 1" entries to
 * anyone navigating by headings.
 *
 * Counted in a real browser because that is where the heading outline is
 * actually consumed, and because two of the questions carry a soft line break
 * (a U+2028 in the Budget copy, a <br> in the Plan one) that only a browser
 * normalises when computing the accessible name.
 */
const LANDING_QUESTION = 'What are you saving for?'

/** Every heading on the page, as "h<level> <accessible name>" in document order. */
async function outline(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')].map(
      (el) => `${el.tagName.toLowerCase()} ${(el.textContent ?? '').replace(/\s+/g, ' ').trim()}`,
    ),
  )
}

const h1s = (page: Page) => page.getByRole('heading', { level: 1 })

test.describe('calculator heading structure', () => {
  test('the landing page has exactly one h1 — the question that opens the flow', async ({ page }) => {
    await page.goto('/')

    await expect(h1s(page)).toHaveCount(1)
    await expect(h1s(page)).toHaveText(LANDING_QUESTION)
  })

  test('a save flow mid-way through still has exactly one h1', async ({ page }) => {
    await goToPlan(page)

    await expect(h1s(page)).toHaveCount(1)
    await expect(h1s(page)).toHaveText(LANDING_QUESTION)
    // The questions that used to be h1s are now h2s, and the browser
    // normalises the Budget copy's U+2028 and the Plan question's <br>.
    // goToPlan drives the Big purchase goal, whose price headline this is.
    await expect(page.getByRole('heading', { level: 2, name: "What's the total cost?" })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: "What's coming in, and going out?" })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'How do you want to plan it?' })).toBeVisible()
  })

  test('a result showing adds an h2, not a fifth h1', async ({ page }) => {
    await goToPlan(page)
    await goToResult(page)

    await expect(h1s(page)).toHaveCount(1)
    // The headline is a figure, so it is matched by shape — the copy belongs
    // to ResultHeadline.
    await expect(page.getByRole('heading', { level: 2, name: /months? —/ })).toBeVisible()

    // The whole outline, so a heading at a level that skips one (an h3 with
    // no h2 above it) fails here too, not just a stray h1.
    const levels = (await outline(page)).map((entry) => entry.split(' ')[0])
    expect(levels.filter((level) => level === 'h1')).toHaveLength(1)
    expect(levels.every((level) => level === 'h1' || level === 'h2')).toBe(true)
  })

  test("the vehicle flow's two bespoke questions are h2s as well", async ({ page }) => {
    // Driven directly rather than through goToPlan: that helper is written
    // around the Big purchase goal's field placeholders, and the vehicle flow
    // has its own Details step (as e2e/vehicle-flow.spec.ts does too).
    await page.goto('/')
    await page.getByRole('button', { name: 'Go to Vehicle' }).click()
    await page.getByRole('button', { name: 'Get started with Vehicle', exact: true }).click()
    await page.getByPlaceholder('e.g. Volkswagen Golf').fill('VW Golf')
    await page.locator('input[type="number"]').nth(0).fill('22000')

    await expect(h1s(page)).toHaveCount(1)
    await expect(h1s(page)).toHaveText(LANDING_QUESTION)
    await expect(page.getByRole('heading', { level: 2, name: 'How much is the car?' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'How are you buying it?' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'What will it cost to keep on the road?' })).toBeVisible()
  })

  test('the headings keep the sizes they had as h1s', async ({ page }) => {
    await goToPlan(page)

    // Demoting an element changes the UA's default font-size (2em -> 1.5em),
    // so this is the one way the change could have been visible. Each heading
    // sets its size inline from a token, and this checks the computed value
    // really is that token's — not a UA default that happens to look close.
    const sizes = await page.evaluate(() => ({
      h1: getComputedStyle(document.querySelector('h1')!).fontSize,
      h1Token: getComputedStyle(document.documentElement).getPropertyValue('--fs-h1-md').trim(),
      h2Weight: getComputedStyle(document.querySelector('h2')!).fontWeight,
    }))

    expect(sizes.h1).toBe(sizes.h1Token)
    // 800, the inline weight — not the UA's `bold` (700).
    expect(sizes.h2Weight).toBe('800')

    // And every h2 carries an explicit size rather than inheriting one.
    const h2Sizes = await page.locator('h2').evaluateAll((els) => els.map((el) => getComputedStyle(el).fontSize))
    expect(h2Sizes.length).toBeGreaterThan(0)
    for (const size of h2Sizes) expect(Number.parseFloat(size)).toBeGreaterThanOrEqual(24)
  })
})

test.describe('docs pages keep their single h1', () => {
  for (const [name, path] of [
    ['sources', '/sources/'],
    ['salary methodology', '/methodology/salary/'],
    ['vehicle methodology', '/methodology/vehicle/'],
  ] as const) {
    test(`${name}`, async ({ page }) => {
      await page.goto(path)
      // These were already right; this stops the calculator's change being
      // copied across to them by mistake.
      await expect(h1s(page)).toHaveCount(1)
    })
  }
})
