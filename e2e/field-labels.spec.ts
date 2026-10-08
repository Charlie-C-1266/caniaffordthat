import { test, expect, type Page } from '@playwright/test'
import { goToPlan } from './helpers'

// FieldLabel used to render a bare <label> with no htmlFor, and none of its
// consumers gave the paired <input> an id — so the label and input were only
// *visually* adjacent and a screen reader announced the field unnamed.
// Playwright's getByLabel resolves through exactly the same association a
// screen reader uses, so these tests fail on the old markup and pass once the
// htmlFor/id pair is wired up. One field of each kind is covered here:
// LabeledMoneyField, LabeledUnitField, and the goal-date MonthYearInput.

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
