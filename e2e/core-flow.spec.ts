import { test, expect } from '@playwright/test'
import { goToPlan, goToResult } from './helpers'

test.describe('core flow', () => {
  test('landing is the goal carousel with its value-prop pill', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'What are you saving for?' })).toBeVisible()
    await expect(page.getByText('Free · no sign-up · takes 2 minutes')).toBeVisible()
    // The carousel opens focused on the first selectable goal — Vehicle, now
    // its calculator is live.
    await expect(page.getByRole('button', { name: 'Get started with Vehicle', exact: true })).toBeVisible()
  })

  test('before a goal is chosen, only the carousel + placeholder exist — no budget/plan/result', async ({ page }) => {
    await page.goto('/')

    // The Step 1 placeholder is present as a nudge back to the carousel...
    await expect(page.getByText('Scroll back up and pick a goal to get started')).toBeVisible()
    // ...but the later steps aren't rendered, so they can't be scrolled into.
    await expect(page.getByText("What's coming in")).toHaveCount(0)
    await expect(page.getByText('Copy result link')).toHaveCount(0)
    // The progress rail is trimmed to the two reachable steps.
    await expect(page.getByRole('button', { name: 'Budget', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Result', exact: true })).toHaveCount(0)
  })

  test('goal picker shows goals, and choosing one advances to tailored details', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'What are you saving for?' })).toBeVisible()

    await page.getByRole('button', { name: 'Go to Big purchase' }).click()
    await page.getByRole('button', { name: 'Get started with Big purchase', exact: true }).click()

    await expect(page.getByPlaceholder('e.g. Wedding, new kitchen, sofa')).toBeVisible()
  })

  test('Mortgage is shown as coming soon and cannot be chosen', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Go to Mortgage' }).click()
    await expect(page.getByRole('button', { name: 'Coming soon', exact: true })).toBeDisabled()
  })

  test('the carousel wraps: going back from the first goal lands on the last', async ({ page }) => {
    await page.goto('/')
    // Focus the first card, Vehicle (clicking also stops the auto-rotate).
    await page.getByRole('button', { name: 'Go to Vehicle' }).click()
    await expect(page.getByRole('button', { name: 'Get started with Vehicle', exact: true })).toBeVisible()

    // Left from the first goal wraps to the last, Mortgage.
    await page.getByRole('button', { name: 'Previous goal' }).click()
    await expect(page.getByRole('button', { name: 'Mortgage (coming soon)' })).toBeVisible()

    // Right from the last wraps back to the first.
    await page.getByRole('button', { name: 'Next goal' }).click()
    await expect(page.getByRole('button', { name: 'Get started with Vehicle', exact: true })).toBeVisible()
  })

  test('entering a price and pressing Enter advances to the budget step', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Go to Big purchase' }).click()
    await page.getByRole('button', { name: 'Get started with Big purchase', exact: true }).click()

    await page.getByPlaceholder('e.g. Wedding, new kitchen, sofa').fill('New sofa')
    const priceInput = page.locator('input[type="number"]').nth(0)
    await priceInput.fill('1200')
    await priceInput.press('Enter')

    await expect(page.getByText("What's coming in")).toBeVisible()
    await expect(page.getByText('Housing (rent/mortgage)')).toBeVisible()
    // The plain "Transport" label is a vehicle-goal-only relabel — every
    // other goal keeps the generic outgoing field untouched.
    await expect(page.getByText('Transport', { exact: true })).toBeVisible()
  })

  test('budget fields default to £0 and take-home + Enter advances to the plan step', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Go to Big purchase' }).click()
    await page.getByRole('button', { name: 'Get started with Big purchase', exact: true }).click()
    await page.getByPlaceholder('e.g. Wedding, new kitchen, sofa').fill('New sofa')
    const priceInput = page.locator('input[type="number"]').nth(0)
    await priceInput.fill('1200')
    await priceInput.press('Enter')

    const housingInput = page.locator('input[type="number"]').nth(2)
    await expect(housingInput).toHaveValue('0')

    const takeHomeInput = page.locator('input[type="number"]').nth(1)
    await takeHomeInput.fill('2000')
    await takeHomeInput.press('Enter')

    await expect(page.getByText('How do you want')).toBeVisible()
  })

  test('the share-of-spare-cash slider shows the £/month it represents', async ({ page }) => {
    await goToPlan(page, { itemPrice: '1200', takeHome: '2000' })
    // Default 25% of £2,000 spare cash (no outgoings) = £500/mo, shown live.
    await expect(page.getByText('25% · £500/mo')).toBeVisible()

    // Accessibility: the slider is named and announces the formatted value,
    // not just the bare number, to assistive tech.
    const slider = page.getByRole('slider', { name: "Share of spare cash you'll save" })
    await expect(slider).toHaveAttribute('aria-valuetext', '25% · £500/mo')
  })

  test('the duration flow accepts a fixed monthly amount as an alternative to the % slider', async ({ page }) => {
    await goToPlan(page, { itemPrice: '1200', takeHome: '2000' })

    // Swap the % slider for a typed fixed amount, and set £300/month.
    await page.getByRole('button', { name: 'Fixed amount' }).click()
    const amountInput = page.getByText('Monthly saving', { exact: true }).locator('xpath=following-sibling::div//input')
    await amountInput.fill('300')

    await goToResult(page)
    // £1,200 target at the typed £300/mo (0% growth) -> 4 months, driven by the
    // fixed amount rather than the 25% rate.
    await expect(page.getByText(/Saving £300\/month, you'll reach £1,200/)).toBeVisible()
  })

  test('full flow reaches a result with the expected verdict and breakdown', async ({ page }) => {
    await goToPlan(page, { itemName: 'New sofa', itemPrice: '1200', takeHome: '2000' })
    // Switch to goal-date flavor (default goalMonths=12, 0% growth) for a
    // deterministic £1,200/12 = £100/mo, rather than duration mode's
    // months-to-save headline, whose expected date shifts with "now".
    await page.getByRole('button', { name: 'I have a goal date' }).click()

    await goToResult(page)

    await expect(page.getByText(/Yes — it's within reach/)).toBeVisible()
    await expect(page.getByRole('heading', { name: '£100/mo' })).toBeVisible()
    await expect(page.getByText(/New sofa — £1,200/)).toBeVisible()

    // The projection chart is labelled: a title and a time x-axis that starts
    // at "now" (the money y-axis and end date are asserted via the breakdown).
    await expect(page.getByText('Savings balance over time')).toBeVisible()
    await expect(page.getByText('Now', { exact: true })).toBeVisible()
  })
})
