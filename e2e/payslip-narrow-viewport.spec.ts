import { test, expect, type Locator, type Page } from '@playwright/test'

// #291 put an itemised monthly payslip on the Budget step. At 320px — the width
// WCAG 1.4.10 Reflow is tested at, and still used by small phones — its rows
// didn't fit: labels and amounts touched with no space between them
// (`POSTGRADUATE-£61.00`), and the National Insurance and Postgraduate Loan
// amounts ran past the right edge of the grey box.
//
// The page itself never scrolls sideways, which is why the existing
// "fits a narrow phone" check in about-your-pay.spec.ts (360px, document
// scrollWidth only) didn't catch it. These tests measure the rows themselves.
//
// The payslip exists so people can check it against a real payslip to the
// penny, so a clipped or jammed-up amount defeats the point of the feature.

/** The deduction lines, longest labels included, with a pension in £-a-month mode. */
const ALL_LINES =
  '/?goalId=big&mode=save&saveFlavor=goal&itemPrice=1200&takeHomeMode=salary&grossSalary=35000&takeHome=2000' +
  '&studentPlan=plan2&postgradLoan=1&pensionArrangement=sacrifice&pensionMode=amount&pensionMonthlyAmount=150'

/** The widest amounts: at £150,000 the monthly income tax runs to four digits before the pence. */
const HIGH_SALARY = ALL_LINES.replace('grossSalary=35000', 'grossSalary=150000')

/** No loan and no pension, so the box is down to salary, tax, NI and the total. */
const FEWEST_LINES =
  '/?goalId=big&mode=save&saveFlavor=goal&itemPrice=1200&takeHomeMode=salary&grossSalary=35000&takeHome=2000' +
  '&studentPlan=none&postgradLoan=0&pensionArrangement=none'

/** The 12px gap BreakdownRow sets, less half a pixel of slack for sub-pixel layout. */
const MIN_GAP = 11.5

type Rect = { x: number; y: number; width: number; height: number }
type MeasuredRow = { name: string; label: Rect; value: Rect }

/** Opens a share link and jumps to the Budget step, where the payslip renders. */
async function goToPayslip(page: Page, url: string) {
  await page.goto(url)
  // Scoped to the progress rail: the result panel has its own "Budget" toggle.
  await page.getByLabel('Step progress').getByRole('button', { name: 'Budget', exact: true }).click()
  const box = page.locator('div.mono').first()
  await expect(box.getByText('SALARY', { exact: true })).toBeVisible()
  return box
}

/**
 * Measures a breakdown box and its label/value rows in one pass, skipping the
 * box's own "Each month" heading (which is a single child, not a pair).
 *
 * Every read here is against an already-settled page, so they go out together
 * rather than one row at a time.
 */
async function measure(box: Locator): Promise<{ box: Rect; rows: MeasuredRow[] }> {
  const boxRect = await box.boundingBox()
  if (!boxRect) throw new Error('expected the breakdown box to be laid out')

  const rowCount = await box.locator('> div').count()
  const measured = await Promise.all(
    Array.from({ length: rowCount }, async (_unused, index): Promise<MeasuredRow | null> => {
      const spans = box.locator('> div').nth(index).locator('> span')
      if ((await spans.count()) !== 2) return null
      const [name, label, value] = await Promise.all([spans.nth(0).textContent(), spans.nth(0).boundingBox(), spans.nth(1).boundingBox()])
      if (!label || !value) throw new Error(`expected ${name} to be laid out`)
      return { name: name ?? '', label, value }
    }),
  )

  return { box: boxRect, rows: measured.filter((row): row is MeasuredRow => row !== null) }
}

/** The box must contain every amount, and no label may touch the amount beside it. */
function expectRowsFit({ box, rows }: { box: Rect; rows: MeasuredRow[] }, expectedRows?: number) {
  if (expectedRows !== undefined) expect(rows).toHaveLength(expectedRows)
  expect(rows.length).toBeGreaterThan(0)

  for (const { name, label, value } of rows) {
    // Every amount sits fully inside the grey box, horizontally.
    expect(value.x, `${name}: value starts inside the box`).toBeGreaterThanOrEqual(box.x)
    expect(value.x + value.width, `${name}: value ends inside the box`).toBeLessThanOrEqual(box.x + box.width + 0.5)

    // The label's right edge is left of the value's left edge, by at least the gap.
    expect(value.x - (label.x + label.width), `${name}: gap between label and value`).toBeGreaterThanOrEqual(MIN_GAP)
  }
}

for (const width of [320, 360]) {
  test.describe(`Budget step payslip at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } })

    test('every amount sits inside the box, clear of its label, with all five deduction lines showing', async ({ page }) => {
      const box = await goToPayslip(page, ALL_LINES)

      // SALARY + the five deductions + TAKE-HOME. Asserting the count means a
      // payslip that silently stopped rendering lines can't pass vacuously.
      expectRowsFit(await measure(box), 7)

      // The longest labels — the two that overflowed on dev.
      await expect(box.getByText('NATIONAL INSURANCE', { exact: true })).toBeVisible()
      await expect(box.getByText('POSTGRADUATE LOAN', { exact: true })).toBeVisible()
    })

    test('the widest amounts still fit: a £150,000 salary takes four digits before the pence', async ({ page }) => {
      const box = await goToPayslip(page, HIGH_SALARY)
      expectRowsFit(await measure(box), 7)
      // £150k with a Plan 2 and a postgraduate loan: income tax is well over
      // £1,000 a month, so the amount column is at its widest.
      await expect(box.getByText(/£[1-9],\d{3}\.\d{2}/).first()).toBeVisible()
    })

    test('the TAKE-HOME total row fits, keeping its rule above it', async ({ page }) => {
      const box = await goToPayslip(page, ALL_LINES)
      const { box: boxRect, rows } = await measure(box)
      const total = rows[rows.length - 1]

      expect(total.name).toBe('TAKE-HOME')
      await expect(box.locator('> div').last()).toHaveCSS('border-top-width', '1px')

      expect(total.value.x + total.value.width).toBeLessThanOrEqual(boxRect.x + boxRect.width + 0.5)
      expect(total.value.x - (total.label.x + total.label.width)).toBeGreaterThanOrEqual(MIN_GAP)
    })

    test('fits with only some lines present: no loan and no pension', async ({ page }) => {
      // Nothing may depend on the full set of rows being there.
      const box = await goToPayslip(page, FEWEST_LINES)
      expectRowsFit(await measure(box), 4)
      await expect(box.getByText('STUDENT LOAN', { exact: true })).toHaveCount(0)
      await expect(box.getByText('PENSION', { exact: true })).toHaveCount(0)
    })

    test('the page still does not scroll sideways', async ({ page }) => {
      await goToPayslip(page, ALL_LINES)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow).toBeLessThanOrEqual(0)
    })
  })
}

// BreakdownRow is shared with the result cards, so the same change reaches
// them. Their labels are shorter, so they were never clipped — these pin that
// they aren't knocked out of shape either, which is also what catches the one
// trap in this change: the GOAL and CAR rows carry free text (`<name> — £X`),
// not a figure, so holding them to one line would push them out of the card.
// A long item name is used deliberately for that reason.
const LONG_NAME = '2019 Volkswagen Golf 1.5 TSI Life'

/** The value span beside a given row label. */
const valueBeside = (page: Page, label: string) => page.getByText(label, { exact: true }).locator('xpath=following-sibling::span')

for (const width of [320, 360, 1280]) {
  test.describe(`result card breakdown rows at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } })

    test('the standard card’s rows sit inside their box, long GOAL text included', async ({ page }) => {
      await page.goto(`${ALL_LINES}&itemName=${encodeURIComponent(LONG_NAME)}`)
      await page.getByLabel('Step progress').getByRole('button', { name: 'Result', exact: true }).click()
      await page.getByText('Copy result link').waitFor()

      // Every mono box on the page, the payslip included: nothing anywhere may
      // put a value outside its box.
      const boxCount = await page.locator('div.mono').count()
      expect(boxCount).toBeGreaterThan(0)
      const measurements = await Promise.all(Array.from({ length: boxCount }, (_unused, i) => measure(page.locator('div.mono').nth(i))))

      const withRows = measurements.filter((measurement) => measurement.rows.length > 0)
      expect(withRows.length).toBeGreaterThan(0)
      for (const measurement of withRows) expectRowsFit(measurement)

      // The free-text GOAL value wraps rather than overflowing.
      const goalValue = valueBeside(page, 'GOAL')
      await expect(goalValue).toContainText(LONG_NAME)

      if (width < 768) {
        // Taller than a sibling row's single-line figure, so it has wrapped
        // rather than been held to one line and pushed out of the card.
        // (`line-height` computes to `normal` here, so a one-line value in the
        // same box is the reliable yardstick.)
        const [goalRect, oneLine] = await Promise.all([goalValue.boundingBox(), valueBeside(page, 'SPARE CASH').boundingBox()])
        if (!goalRect || !oneLine) throw new Error('expected the GOAL and SPARE CASH values to be laid out')
        expect(goalRect.height, 'the long GOAL value wraps onto more than one line').toBeGreaterThan(oneLine.height * 1.5)
      }
    })

    test('the vehicle card’s "Monthly costs" and "The deal" rows sit inside their boxes', async ({ page }) => {
      // Driven through the UI rather than a share link, as vehicle-flow.spec.ts
      // does: the vehicle steps own several fields that aren't shared in a link.
      await page.goto('/')
      await page.getByRole('button', { name: 'Go to Vehicle' }).click()
      await page.getByRole('button', { name: 'Get started with Vehicle', exact: true }).click()

      await page.getByPlaceholder('e.g. Volkswagen Golf').fill(LONG_NAME)
      await page.locator('input[type="number"]').nth(0).fill('22000')
      await page.getByLabel('Deposit / part-exchange').fill('2000')

      // PCP with a quoted balloon, so "The deal" box shows every row it can:
      // amount financed, term, APR, the final payment and the total.
      await page.getByRole('button', { name: 'I have a quote' }).click()
      await page.getByLabel('Final payment from your quote').fill('8000')

      await page.getByLabel('Take-home pay / month').fill('2600')
      await page.getByRole('button', { name: 'Result', exact: true }).click()
      await page.getByText('Copy result link').waitFor()

      const boxes = ['Monthly costs', 'The deal'].map((heading) => page.locator('div.mono').filter({ hasText: heading }).last())
      await Promise.all(boxes.map((box) => expect(box).toBeVisible()))
      const measurements = await Promise.all(boxes.map((box) => measure(box)))
      for (const measurement of measurements) expectRowsFit(measurement)

      // The CAR row is the vehicle card's free-text value, and it wraps too.
      await expect(valueBeside(page, 'CAR')).toContainText(LONG_NAME)
    })
  })
}
