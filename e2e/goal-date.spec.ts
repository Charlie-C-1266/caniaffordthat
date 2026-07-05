import { test, expect } from '@playwright/test'
import { goToPlan } from './helpers'

// Regression coverage for the bug where the native <input type="month">
// couldn't be cleared — typing into it reverted to a fallback value instead
// of accepting a new date. Replaced with MonthYearInput (plain "MM-YYYY"
// text field); these tests pin down that fix.
test.describe('goal-date field', () => {
  test('shows a default MM-YYYY value and can be fully cleared and retyped', async ({ page }) => {
    await goToPlan(page)
    await page.getByRole('button', { name: 'I have a goal date' }).click()

    const goalDateInput = page.getByPlaceholder('MM-YYYY')
    await expect(goalDateInput).toHaveValue(/^\d{2}-\d{4}$/)

    await goalDateInput.fill('')
    await expect(goalDateInput).toHaveValue('')

    await goalDateInput.fill('03-2028')
    await expect(goalDateInput).toHaveValue('03-2028')
  })

  test('reverts to the last valid value on blur if left invalid or empty', async ({ page }) => {
    await goToPlan(page)
    await page.getByRole('button', { name: 'I have a goal date' }).click()

    const goalDateInput = page.getByPlaceholder('MM-YYYY')
    const validValue = await goalDateInput.inputValue()

    await goalDateInput.fill('')
    await page.keyboard.press('Tab') // blur

    await expect(goalDateInput).toHaveValue(validValue)
  })

  test('ignores a goal date earlier than the minimum (next month)', async ({ page }) => {
    await goToPlan(page)
    await page.getByRole('button', { name: 'I have a goal date' }).click()

    const goalDateInput = page.getByPlaceholder('MM-YYYY')
    const validValue = await goalDateInput.inputValue()

    // Deliberately a past/too-early date — should not commit.
    await goalDateInput.fill('01-2020')
    await expect(goalDateInput).toHaveValue('01-2020') // draft still shows what was typed

    await page.keyboard.press('Tab') // blur snaps back since it never committed
    await expect(goalDateInput).toHaveValue(validValue)
  })
})
