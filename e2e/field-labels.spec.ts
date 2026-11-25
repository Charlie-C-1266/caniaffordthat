import { test, expect, type Page } from '@playwright/test'
import { goToPlan, goToResult } from './helpers'

// FieldLabel used to render a bare <label> with no htmlFor, and none of its
// consumers gave the paired <input> an id — so the label and input were only
// *visually* adjacent and a screen reader announced the field unnamed.
// Playwright's getByLabel resolves through exactly the same association a
// screen reader uses, so these tests fail on the old markup and pass once the
// htmlFor/id pair is wired up. One field of each kind is covered here:
// LabeledMoneyField, LabeledUnitField, and the goal-date MonthYearInput.
//
// #94 deliberately left the four "bare" hero fields out of that pass, so the
// app's most important inputs — the price every flow asks for, take-home pay,
// annual salary and the goal title — stayed unnamed. The second describe block
// below covers those.

/** Asserts a field is reachable by its accessible name and is the input that actually takes the value. */
async function expectLabelledField(page: Page, label: string, typed: string) {
  const field = page.getByLabel(label, { exact: true })
  await expect(field).toHaveCount(1)
  await field.fill(typed)
  await expect(field).toHaveValue(typed)
}

test.describe('field label association', () => {
  test('a LabeledMoneyField is reachable by its label text', async ({ page }) => {
    await goToPlan(page)
    // Scoped to the progress rail: the result panel has its own "Budget" toggle.
    await page.getByLabel('Step progress').getByRole('button', { name: 'Budget', exact: true }).click()

    await expectLabelledField(page, 'Housing (rent/mortgage)', '850')
  })

  test('the goal-date field is reachable by its label text', async ({ page }) => {
    await goToPlan(page)
    await page.getByRole('button', { name: 'I have a goal date' }).click()

    const goalDate = page.getByLabel('Goal date (MM-YYYY)', { exact: true })
    await expect(goalDate).toHaveCount(1)
    // Same element the rest of the goal-date suite drives by placeholder.
    await expect(goalDate).toHaveAttribute('placeholder', 'MM-YYYY')
  })

  test('a LabeledUnitField is reachable by its label text', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Go to Vehicle' }).click()
    await page.getByRole('button', { name: 'Get started with Vehicle', exact: true }).click()

    await page.getByPlaceholder('e.g. Volkswagen Golf').fill('VW Golf')
    await page.locator('input[type="number"]').nth(0).fill('22000')
    await page.getByRole('button', { name: 'Running costs', exact: true }).click()

    await expectLabelledField(page, 'Miles you drive / year', '9000')
  })
})

test.describe('hero field accessible names', () => {
  test("the price field is named by the goal's own headline", async ({ page }) => {
    await page.goto('/?goalId=holiday')

    // The visible question *is* the step's heading, so the name has to follow
    // the goal's priceHeadline rather than a separate hand-written label.
    await expectLabelledField(page, 'How much is the trip?', '4000')
  })

  test('the price headline names exactly one field, not the whole step', async ({ page }) => {
    await page.goto('/?goalId=holiday')

    const priced = page.getByLabel('How much is the trip?', { exact: true })
    await expect(priced).toHaveCount(1)
    await expect(priced).toHaveAttribute('type', 'number')
  })

  test('the goal title field is reachable by its label', async ({ page }) => {
    await page.goto('/?goalId=holiday')

    const title = page.getByLabel(/^Goal title/)
    await expect(title).toHaveCount(1)
    await title.fill('Two weeks in Italy')
    await expect(title).toHaveValue('Two weeks in Italy')
    // Previously only the placeholder gave it any name at all.
    await expect(title).toHaveAttribute('placeholder', 'e.g. Two weeks in Italy')
  })

  test('take-home pay is reachable by its visible label', async ({ page }) => {
    await page.goto('/?goalId=holiday&itemPrice=4000')

    await expectLabelledField(page, 'Take-home pay / month', '2600')
  })

  test('salary mode renames the same field to the salary label', async ({ page }) => {
    await page.goto('/?goalId=holiday&itemPrice=4000&takeHomeMode=salary')

    await expectLabelledField(page, 'Annual salary (before tax)', '42000')
    // The take-home label belongs to the input that isn't showing.
    await expect(page.getByLabel('Take-home pay / month', { exact: true })).toHaveCount(0)
  })

  test('every input on the calculator page has an accessible name', async ({ page }) => {
    await page.goto('/?goalId=holiday&itemPrice=4000&takeHome=2600')
    await expect(page.locator('#root')).not.toBeEmpty()

    // The regression this guards is a field reachable only by sighted
    // adjacency, so it asks the question across the whole page rather than
    // field by field: any input a screen reader would announce unnamed fails.
    const unnamed = await page.evaluate(() =>
      [...document.querySelectorAll('input')]
        .filter((input) => {
          if (input.getAttribute('aria-label')) return false
          const labelledBy = input.getAttribute('aria-labelledby')
          if (labelledBy?.split(/\s+/).some((id) => document.getElementById(id)?.textContent?.trim())) return false
          return !(input.id && document.querySelector(`label[for="${CSS.escape(input.id)}"]`))
        })
        .map((input) => `${input.type}:${input.placeholder || input.value}`),
    )

    expect(unnamed).toEqual([])
  })
})

/*
 * A "?" InfoHint inside a field's <label> used to land in the input's
 * accessible *name*, because a <label for> names its input from the label's
 * whole content. The hint belongs in the description, read after the name or
 * on request, rather than every time focus reaches the field. Checked in a
 * real browser, since only a browser computes the name the way an assistive
 * technology does.
 */
test.describe('a hinted field names itself without the hint', () => {
  test('the VED field is named by its label and described by its hint', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Go to Vehicle' }).click()
    await page.getByRole('button', { name: 'Get started with Vehicle', exact: true }).click()
    await page.getByPlaceholder('e.g. Volkswagen Golf').fill('VW Golf')
    await page.locator('input[type="number"]').nth(0).fill('22000')
    await page.getByRole('button', { name: 'Running costs', exact: true }).click()

    // `exact: true` is the assertion: before the fix this name carried the
    // whole hint paragraph, so the exact match failed.
    const ved = page.getByRole('spinbutton', { name: 'Road tax (VED) / year', exact: true })
    await expect(ved).toBeVisible()

    // The hint is still reachable, as the description.
    const description = await ved.evaluate((input) =>
      (input.getAttribute('aria-describedby') ?? '')
        .split(/\s+/)
        .filter(Boolean)
        .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
        .join(' ')
        .trim(),
    )
    expect(description).toContain('is the standard rate for most cars')
    // The same, computed the way assistive technology does it: an element
    // referenced by aria-describedby is read even though it is hidden.
    await expect(ved).toHaveAccessibleDescription(/is the standard rate for most cars/)
    // And only there. The description element is hidden, so a screen reader
    // reading down the page doesn't hear the hint again after the "?" button.
    const describedBy = await ved.getAttribute('aria-describedby')
    await expect(page.locator(`[id="${describedBy}"]`)).toBeHidden()

    // And the "?" still works: hover opens the tooltip, as it did before.
    const hint = page.getByRole('button', { name: /is the standard rate for most cars/ })
    await expect(hint).toBeVisible()
    await hint.hover()
    await expect(page.getByRole('tooltip')).toBeVisible()
  })
})

// #282: SegmentedControl wrapped its buttons in a plain <div> with no role and
// no accessible name, so a screen reader announced "Save up for it, toggle
// button, pressed" with nothing to say what the choice was about. The groups
// are named by role and name in the unit tests; this is the real-browser check
// that the names resolve the way assistive tech computes them — in particular
// the two that come from visible text via aria-labelledby.
test.describe('segmented control group names', () => {
  test('the pay-mode group is named by the question on screen, and the result view group by its own label', async ({ page }) => {
    await page.goto('/?goalId=big')
    await page.getByRole('button', { name: 'Get started with Big purchase', exact: true }).click()

    // Named from the visible "How do you plan to pay?" text, not a duplicate.
    const payMode = page.getByRole('group', { name: 'How do you plan to pay?' })
    await expect(payMode).toHaveCount(1)
    await expect(payMode.getByRole('button', { name: 'Save up for it' })).toHaveAttribute('aria-pressed', 'true')

    // The name survives changing the selection.
    await payMode.getByRole('button', { name: 'Pay monthly' }).click()
    await expect(page.getByRole('group', { name: 'How do you plan to pay?' })).toHaveCount(1)
  })

  test("the balloon-mode group is named by its heading, with the hint's text left out", async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Go to Vehicle' }).click()
    await page.getByRole('button', { name: 'Get started with Vehicle', exact: true }).click()
    await page.getByPlaceholder('e.g. Volkswagen Golf').fill('VW Golf')
    await page.locator('input[type="number"]').nth(0).fill('22000')

    // PCP is the default method, so the balloon group is on screen. The exact
    // name is the assertion: the InfoHint's "?" button carries the whole hint
    // as its aria-label, and #201 showed how easily that lands in the name.
    const balloon = page.getByRole('group', { name: 'The final payment (balloon / GMFV)' })
    await expect(balloon).toHaveCount(1)
    await expect(balloon.getByRole('button', { name: 'I have a quote' })).toBeVisible()

    // The hint is still there to have been excluded.
    await expect(page.getByRole('button', { name: /the lender guarantees the car/ })).toBeVisible()
  })

  test('every segmented group the main flow renders has an accessible name', async ({ page }) => {
    await goToPlan(page)
    await goToResult(page)

    // Walk every group on the page and require a name — an unnamed one is
    // exactly the bug, and it would otherwise only show up in a screen reader.
    const unnamed = await page.getByRole('group').evaluateAll((groups) =>
      groups
        .filter((group) => {
          const labelledBy = (group.getAttribute('aria-labelledby') ?? '')
            .split(/\s+/)
            .filter(Boolean)
            .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
            .join(' ')
            .trim()
          return !(group.getAttribute('aria-label') ?? '').trim() && !labelledBy
        })
        .map((group) => group.outerHTML.slice(0, 120)),
    )
    expect(unnamed).toEqual([])

    await expect(page.getByRole('group', { name: 'Result view' })).toHaveCount(1)
  })
})
