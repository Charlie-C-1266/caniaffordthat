import { test, expect, type Page } from '@playwright/test'
import { CURRENT_TAX_YEAR } from '../src/lib/taxYears'
import { STUDENT_LOAN_PLANS, STUDENT_PLAN_LABELS } from '../src/lib/payProfile'
import { takeHomeBreakdown } from '../src/lib/salary'
import { fmt, fmtPence } from '../src/lib/calculations'
import type { PayProfile, PensionInput } from '../src/lib/deductions'

test.describe('vehicle methodology page', () => {
  test('publishes the working: verdict bands, formulas, tax table and the depreciation chart', async ({ page }) => {
    await page.goto('/methodology/vehicle/')

    await expect(page.getByRole('heading', { name: 'How the vehicle calculator works' })).toBeVisible()

    // The verdict bands quote the real thresholds.
    await expect(page.getByText('Fits comfortably')).toBeVisible()
    await expect(page.getByText('Up to 20%')).toBeVisible()

    // The PCP formula (with the balloon term) is published.
    await expect(page.getByText(/PCP payment/).first()).toBeVisible()

    // The VED table shows the rates in force, straight from the constants.
    await expect(page.getByText('£200/year', { exact: true })).toBeVisible()
    await expect(page.getByText('+£440/year', { exact: true })).toBeVisible()

    // The depreciation line chart is drawn, with its mileage legend.
    await expect(page.getByRole('img', { name: /generic depreciation curve/i })).toBeVisible()
    await expect(page.getByText('8,000 miles/year (UK average)')).toBeVisible()

    // Honesty section: the page owns its simplifications.
    await expect(page.getByText("What we deliberately don't model (yet)")).toBeVisible()

    // And a way back to the calculator.
    await expect(page.getByRole('link', { name: '← Back to the calculator' })).toBeVisible()
  })

  test('the worked example is computed from the live maths, not hard-coded copy', async ({ page }) => {
    await page.goto('/methodology/vehicle/')
    // £20,000 brand new over 48 months at average mileage -> the same £7,443
    // estimate the calculator itself produces (see vehicle-flow.spec.ts).
    await expect(page.getByText(/£7,443/).first()).toBeVisible()
  })

  test('the vehicle result card links to the methodology page', async ({ page }) => {
    await page.goto('/?goalId=car&itemPrice=15000&takeHome=2500')
    await page.getByRole('button', { name: 'Result', exact: true }).click()
    await page.getByText('Copy result link').waitFor()

    const link = page.getByRole('link', { name: /how these numbers are worked out/i })
    await expect(link).toHaveAttribute('href', '/methodology/vehicle/')
  })
})

test.describe('salary methodology page', () => {
  test('publishes the working: the tax and NI bands, the £100k taper, and the honesty section', async ({ page }) => {
    await page.goto('/methodology/salary/')

    await expect(page.getByRole('heading', { name: /what salary would I need/i })).toBeVisible()

    // The income-tax bands quote the real thresholds, straight from the constants.
    await expect(page.getByText('£12,570 to £50,270').first()).toBeVisible()
    await expect(page.getByText('Over £125,140').first()).toBeVisible()

    // The £100k allowance-taper section is called out.
    await expect(page.getByText(/£100,000 .*tax trap/i)).toBeVisible()

    // Honesty section, and a way back.
    await expect(page.getByText("What we deliberately don't model (yet)")).toBeVisible()
    await expect(page.getByRole('link', { name: '← Back to the calculator' })).toBeVisible()
  })

  test('the worked example is computed from the live maths, not hard-coded copy', async ({ page }) => {
    await page.goto('/methodology/salary/')
    // A £50,000 salary -> £39,520 take-home, straight from netFromGross.
    await expect(page.getByText(/£39,520/).first()).toBeVisible()
  })

  test('the result card links to the salary methodology page', async ({ page }) => {
    await page.goto('/?goalId=big&itemPrice=15000&takeHome=2500')
    await page.getByRole('button', { name: 'Result', exact: true }).click()
    await page.getByText('Copy result link').waitFor()

    const link = page.getByRole('link', { name: /how this is worked out/i })
    await expect(link).toHaveAttribute('href', '/methodology/salary/')
  })

  test('the docs tables name each row for assistive tech, and the first column still looks unchanged', async ({ page }) => {
    // #285: the first column was styled as the row's name but emitted as a
    // plain `<td>`, and the headers had no `scope`, so moving across a row in
    // a screen reader read values with no row context (WCAG 1.3.1).
    //
    // Worth checking in a real browser as well as in jsdom: `<th>` has its own
    // UA defaults (`text-align: center`, `font-weight: bold`), so only a
    // computed style proves the reset holds and the column looks as it did.
    await page.goto('/methodology/salary/')

    const tables = page.getByRole('table')
    const tableCount = await tables.count()
    expect(tableCount).toBeGreaterThan(0)

    const perTable = await Promise.all(
      Array.from({ length: tableCount }, async (_unused, index) => {
        const table = tables.nth(index)
        const [bodyRows, rowHeaders, scopes, headerScopes] = await Promise.all([
          table.locator('tbody tr').count(),
          table.getByRole('rowheader').count(),
          table.getByRole('rowheader').evaluateAll((cells) => cells.map((cell) => cell.getAttribute('scope'))),
          table.getByRole('columnheader').evaluateAll((cells) => cells.map((cell) => cell.getAttribute('scope'))),
        ])
        return { bodyRows, rowHeaders, scopes, headerScopes }
      }),
    )

    for (const { bodyRows, rowHeaders, scopes, headerScopes } of perTable) {
      expect(bodyRows).toBeGreaterThan(0)
      // One row header per body row, every one scoped to its row.
      expect(rowHeaders).toBe(bodyRows)
      expect(scopes.every((scope) => scope === 'row')).toBe(true)
      expect(headerScopes.every((scope) => scope === 'col')).toBe(true)
    }

    // The first column's own appearance: left-aligned and the same weight and
    // colour it had as a `<td>`, not the browser's centred bold `<th>`.
    const firstRowHeader = tables.first().getByRole('rowheader').first()
    await expect(firstRowHeader).toHaveCSS('text-align', 'left')
    await expect(firstRowHeader).toHaveCSS('font-weight', '700')

    const [rowHeaderColour, cellColour] = await Promise.all([
      firstRowHeader.evaluate((el) => getComputedStyle(el).color),
      tables
        .first()
        .getByRole('cell')
        .first()
        .evaluate((el) => getComputedStyle(el).color),
    ])
    // The row name is the primary text colour; the values beside it are dimmer.
    expect(rowHeaderColour).not.toBe(cellColour)
  })
})

// #295 / design doc §9: the student-loan and pension working #291 published has
// no browser coverage. The unit tests (MethodologyPages.test.tsx) render the
// page in jsdom; they never load the built multi-page entry point, so a broken
// `methodology/salary/index.html` or a CSS rule that hid these sections would
// pass CI. That matters because of the rule the design doc sets: no figure
// reaches the UI before its source and working are on the site.
//
// Every expected figure is built from the same `taxYears.ts` data the page
// renders, so the April refresh updates both sides together. (The e2e project
// can import from `src/` — `tsconfig.node.json` with `bundler` resolution —
// so no literals are needed.)
const TY = CURRENT_TAX_YEAR

/** The page's own `pctOf`: SalaryMethodologyPage.tsx. */
const pctOf = (rate: number) => `${Math.round(rate * 100)}%`

/** The page's own `longDate`: SalaryMethodologyPage.tsx. */
const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

/** The page's `LOAN_EXAMPLE`, recomputed from the engine. */
const LOAN_EXAMPLE = (() => {
  const gross = 35_000
  const plan2: PayProfile = { studentPlan: 'plan2', postgradLoan: false, pension: null }
  return { gross, repaid: takeHomeBreakdown(gross, TY, plan2).studentLoan }
})()

/** A 5%-of-salary pension under one of the two offered arrangements. */
const fivePercent = (arrangement: 'sacrifice' | 'netpay'): PensionInput => ({
  arrangement,
  mode: 'percent',
  percent: 5,
  monthlyAmount: 0,
})

/** The page's `PENSION_EXAMPLE`, recomputed from the engine. */
const PENSION_EXAMPLE = (() => {
  const gross = 35_000
  const withPension = (pension: PensionInput | null) => takeHomeBreakdown(gross, TY, { studentPlan: 'plan2', postgradLoan: false, pension })
  return { none: withPension(null), sacrifice: withPension(fivePercent('sacrifice')), netpay: withPension(fivePercent('netpay')) }
})()

/** Every loan row the table must carry: the four undergraduate plans plus the postgraduate loan. */
const LOAN_ROWS = [
  ...STUDENT_LOAN_PLANS.map((plan) => ({
    name: STUDENT_PLAN_LABELS[plan],
    rate: pctOf(TY.studentLoanPlans[plan].rate),
    threshold: fmt(TY.studentLoanPlans[plan].threshold),
  })),
  { name: 'Postgraduate Loan', rate: pctOf(TY.postgraduateLoan.rate), threshold: fmt(TY.postgraduateLoan.threshold) },
]

/**
 * The loan table, found by a column header only it has. Scoped this way rather
 * than by position, so adding a table to the page can't silently point these
 * assertions at the wrong one.
 */
const loanTable = (page: Page) => page.getByRole('table').filter({ has: page.getByRole('columnheader', { name: 'On pay over' }) })

/** The pension-arrangements table, likewise. */
const pensionTable = (page: Page) => page.getByRole('table').filter({ has: page.getByRole('columnheader', { name: 'Arrangement' }) })

/**
 * A table's row carrying the given name.
 *
 * Matched on the row's text rather than a `rowheader`, deliberately: this
 * checks the published content, not the table markup. That markup is #285's
 * concern (the first column became a `<th scope="row">`), and its own tests
 * pin it.
 */
const rowNamed = (table: ReturnType<typeof loanTable>, name: string) => table.getByRole('row').filter({ hasText: name })

test.describe('salary methodology page: student loans and pensions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/methodology/salary/')
  })

  test('publishes both sections', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Student loans' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Workplace pensions' })).toBeVisible()
  })

  test('the loan table shows every plan with its live rate and threshold', async ({ page }) => {
    // Driven off STUDENT_LOAN_PLANS, so adding a plan makes this test check it
    // too — or fail loudly if the page stops rendering one.
    expect(LOAN_ROWS.length).toBe(STUDENT_LOAN_PLANS.length + 1)

    const rows = await Promise.all(
      LOAN_ROWS.map(async (expected) => {
        const row = rowNamed(loanTable(page), expected.name)
        await expect(row, `${expected.name} has a row`).toHaveCount(1)
        return { expected, text: (await row.textContent()) ?? '' }
      }),
    )

    for (const { expected, text } of rows) {
      expect(text, `${expected.name} rate`).toContain(expected.rate)
      expect(text, `${expected.name} threshold`).toContain(expected.threshold)
    }
  })

  test('the Plan 2 worked example shows the live monthly repayment', async ({ page }) => {
    await expect(page.getByText(fmtPence(LOAN_EXAMPLE.repaid / 12)).first()).toBeVisible()
    await expect(page.getByText(fmt(LOAN_EXAMPLE.gross)).first()).toBeVisible()
  })

  test('the pension example shows three different take-home figures, sacrifice ahead of net pay', async ({ page }) => {
    const monthly = {
      none: PENSION_EXAMPLE.none.takeHome / 12,
      sacrifice: PENSION_EXAMPLE.sacrifice.takeHome / 12,
      netpay: PENSION_EXAMPLE.netpay.takeHome / 12,
    }

    // The ordering the copy describes, pinned on the engine's own figures:
    // no pension leaves the most take-home, and of the two arrangements
    // salary sacrifice leaves more than net pay.
    expect(monthly.none).toBeGreaterThan(monthly.sacrifice)
    expect(monthly.sacrifice).toBeGreaterThan(monthly.netpay)

    // Three distinct figures, each actually on the page.
    const shown = [fmtPence(monthly.none), fmtPence(monthly.sacrifice), fmtPence(monthly.netpay)]
    expect(new Set(shown).size).toBe(3)
    await Promise.all(shown.map((figure) => expect(page.getByText(figure).first(), figure).toBeVisible()))
  })

  test('says when the figures were last checked against GOV.UK, as a long-form date', async ({ page }) => {
    // Built from `verifiedOn` itself, so changing that date breaks only this
    // assertion and nothing else in the file.
    const checked = longDate(TY.verifiedOn)
    expect(checked, 'a long-form date like "13 November 2026"').toMatch(/^\d{1,2} [A-Z][a-z]+ \d{4}$/)

    await expect(page.getByText(/last checked against GOV.UK on/)).toBeVisible()
    await expect(page.getByText(checked).first()).toBeVisible()
  })

  test('does not offer relief at source yet, which is PR 3 scope', async ({ page }) => {
    // Deliberately fails when relief at source lands, so whoever adds it has
    // to come back here and say what the page should now show.
    await expect(rowNamed(pensionTable(page), 'Relief at source')).toHaveCount(0)
    // The arrangements table offers exactly the two that come out of pay
    // before income tax, plus its header row.
    await expect(pensionTable(page).getByRole('row')).toHaveCount(3)
    await expect(rowNamed(pensionTable(page), 'Salary sacrifice')).toHaveCount(1)
    await expect(rowNamed(pensionTable(page), 'Net pay')).toHaveCount(1)

    // It is still *mentioned*, as the not-offered-yet note — that is the only
    // place it may appear.
    await expect(page.getByText(/Relief at source.*isn.t offered yet/)).toBeVisible()
  })

  test('shows the same sections in dark mode', async ({ page }) => {
    // Matching theme.spec.ts's approach: a theme-only CSS rule must not be
    // able to hide the published working.
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.reload()

    await expect(page.getByRole('heading', { name: 'Student loans' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Workplace pensions' })).toBeVisible()
    await expect(rowNamed(loanTable(page), 'Postgraduate Loan')).toHaveCount(1)
    await expect(page.getByText(longDate(TY.verifiedOn)).first()).toBeVisible()
  })
})

// #314: every wide table and formula on the docs pages is an `overflowX: auto`
// box, and none of them had a tabIndex, a role or a name. Most contain nothing
// focusable, so in browsers that don't make scrollers focusable on their own
// (Safari, older Chromium) the hidden rate and threshold columns were out of
// keyboard reach entirely — WCAG 2.1.1, and axe's
// `scrollable-region-focusable`.
test.describe('the docs pages at a phone width', () => {
  const PHONE = { width: 360, height: 780 }

  /** The pages, with a region each one has that is wide enough to scroll at 360px. */
  const PAGES = [
    { path: '/methodology/salary/', region: 'Income tax bands and rates' },
    { path: '/methodology/vehicle/', region: 'Road tax charges, the rates used and when each applies' },
    { path: '/sources/', region: 'Every source behind the numbers, and what each one backs' },
  ] as const

  for (const { path, region } of PAGES) {
    test(`a wide table on ${path} is reachable by keyboard and scrolls with the arrow keys`, async ({ page }) => {
      await page.setViewportSize(PHONE)
      await page.goto(path)

      const scroller = page.getByRole('region', { name: region })
      await expect(scroller).toBeVisible()

      // It really does overflow here — otherwise the rest proves nothing.
      const overflow = await scroller.evaluate((el) => el.scrollWidth - el.clientWidth)
      expect(overflow).toBeGreaterThan(0)

      // Reachable with the keyboard, and showing a focus ring once there.
      await scroller.focus()
      await expect(scroller).toBeFocused()
      const outlineWidth = await scroller.evaluate((el) => getComputedStyle(el).outlineWidth)
      expect(outlineWidth).not.toBe('0px')

      // And the arrow keys bring the hidden columns into view.
      expect(await scroller.evaluate((el) => el.scrollLeft)).toBe(0)
      await page.keyboard.press('ArrowRight')
      await expect.poll(async () => scroller.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0)
    })
  }

  test('a table that fits adds no extra tab stop on a desktop', async ({ page }) => {
    // The conditional half of the rule: at 1280px the same tables fit, so a
    // reader tabbing through the page should not meet them at all.
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/methodology/salary/')

    const measured = await page.evaluate(() =>
      [...document.querySelectorAll('.doc-scroller')].map((el) => ({
        overflow: el.scrollWidth - el.clientWidth,
        tabIndex: el.getAttribute('tabindex'),
      })),
    )
    expect(measured.length).toBeGreaterThan(0)

    // Focusable exactly when it has something hidden to scroll to, and at
    // this width that is none of them.
    expect(measured.filter(({ overflow }) => overflow > 0)).toEqual([])
    expect(measured.map(({ tabIndex }) => tabIndex)).toEqual(measured.map(() => null))
  })
})
