import { test, expect, type Page } from '@playwright/test'
import { goToPlan } from './helpers'

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

    // The visible question *is* the <h1>, so the name has to follow the goal's
    // priceHeadline rather than a separate hand-written label.
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
