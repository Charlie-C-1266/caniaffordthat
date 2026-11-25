import { test, expect } from '@playwright/test'
import { goToPlan, goToResult } from './helpers'

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

  test('masks typed input to the MM-YYYY shape, dropping other characters', async ({ page }) => {
    await goToPlan(page)
    await page.getByRole('button', { name: 'I have a goal date' }).click()

    const goalDateInput = page.getByPlaceholder('MM-YYYY')
    await goalDateInput.fill('')

    // Letters and separators are rejected; digits get the hyphen auto-inserted.
    await goalDateInput.pressSequentially('1a2/2027xyz')
    await expect(goalDateInput).toHaveValue('12-2027')
  })

  test('inserts the hyphen after the second digit and lets backspace delete past it', async ({ page }) => {
    await goToPlan(page)
    await page.getByRole('button', { name: 'I have a goal date' }).click()

    const goalDateInput = page.getByPlaceholder('MM-YYYY')
    await goalDateInput.fill('')

    // The hyphen appears as soon as the two-digit month is entered.
    await goalDateInput.pressSequentially('08')
    await expect(goalDateInput).toHaveValue('08-')

    // Backspace removes the auto-inserted hyphen rather than re-adding it.
    await page.keyboard.press('Backspace')
    await expect(goalDateInput).toHaveValue('08')
    await page.keyboard.press('Backspace')
    await expect(goalDateInput).toHaveValue('0')
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

  test('ignores a goal date earlier than the minimum (next month), and says so', async ({ page }) => {
    await goToPlan(page)
    await page.getByRole('button', { name: 'I have a goal date' }).click()

    const goalDateInput = page.getByPlaceholder('MM-YYYY')
    const validValue = await goalDateInput.inputValue()

    // Deliberately a past/too-early date — should not commit.
    await goalDateInput.fill('01-2020')
    await expect(goalDateInput).toHaveValue('01-2020') // draft still shows what was typed

    // #287: it used to be dropped in silence, which fails WCAG 2.2 SC 3.3.1
    // Error Identification — the page showed one date and calculated with
    // another, and nothing said so.
    const message = page.getByRole('status').filter({ hasText: /Pick a month from/ })
    await expect(message).toBeVisible()
    await expect(goalDateInput).toHaveAttribute('aria-invalid', 'true')
    // The message is the field's own description, so it is read with it.
    await expect(goalDateInput).toHaveAccessibleDescription(/Pick a month from/)

    await page.keyboard.press('Tab') // blur snaps back since it never committed
    await expect(goalDateInput).toHaveValue(validValue)
    // The snap-back restores a valid date, so the message goes with it.
    await expect(page.getByText(/Pick a month from/)).toHaveCount(0)
    expect(await goalDateInput.getAttribute('aria-invalid')).toBeNull()
  })

  test('a corrected date clears the message and the result follows the new date', async ({ page }) => {
    await goToPlan(page)
    await page.getByRole('button', { name: 'I have a goal date' }).click()

    const goalDateInput = page.getByPlaceholder('MM-YYYY')

    // Month 13 doesn't exist: a different message from the range one.
    await goalDateInput.fill('13-2030')
    await expect(page.getByRole('status').filter({ hasText: 'Enter a month between 01 and 12.' })).toBeVisible()
    await expect(goalDateInput).toHaveAttribute('aria-invalid', 'true')

    // Correcting it clears the message and commits.
    await goalDateInput.fill('12-2030')
    await expect(page.getByText(/Enter a month between/)).toHaveCount(0)
    await expect(page.getByText(/Pick a month from/)).toHaveCount(0)
    expect(await goalDateInput.getAttribute('aria-invalid')).toBeNull()

    // And the result is worked out from the date that is actually on screen.
    await goToResult(page)
    await expect(page.getByText(/December 2030/).first()).toBeVisible()
  })
})
