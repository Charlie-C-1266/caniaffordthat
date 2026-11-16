import { test, expect } from '@playwright/test'
import { SOURCES } from '../src/lib/sources'

test.describe('sources & ethos page', () => {
  test('covers the ethos, the annotated source list, methodology links and helpful reading', async ({ page }) => {
    await page.goto('/sources/')

    await expect(page.getByRole('heading', { name: 'Our sources & ethos' })).toBeVisible()

    // The ethos table leads with the free-and-impartial promise.
    await expect(page.getByText('Free and impartial')).toBeVisible()
    await expect(page.getByText(/nothing to sell/)).toBeVisible()

    // Every app source appears, annotated with what it backs.
    await expect(page.getByRole('link', { name: /Halifax — The 50\/30\/20 rule/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /GOV.UK — Vehicle tax rates/ })).toBeVisible()
    await expect(page.getByText(/applied to take-home pay/)).toBeVisible()

    // The per-calculator methodology pages are linked — every published one, so
    // a visitor landing here first can reach them all.
    await expect(page.getByRole('link', { name: 'How the vehicle calculator works' })).toHaveAttribute('href', '/methodology/vehicle/')
    await expect(page.getByRole('link', { name: 'How the required-salary calculator works' })).toHaveAttribute(
      'href',
      '/methodology/salary/',
    )

    // The helpful-reading list is seeded and framed as non-citations.
    await expect(page.getByRole('link', { name: 'MoneyHelper', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'StepChange', exact: true })).toBeVisible()
    await expect(page.getByText(/places we'd genuinely send a friend/)).toBeVisible()
  })

  test('the vehicle methodology page cross-links to the sources & ethos page', async ({ page }) => {
    await page.goto('/methodology/vehicle/')
    await expect(page.getByRole('link', { name: /sources & ethos page/ })).toHaveAttribute('href', '/sources/')
  })
})

// #295 / design doc §9: #291 added ten SOURCES entries and the share-link
// privacy line, and nothing checks they actually reach the built page. The
// unit test (SourcesPage.test.tsx) renders the page in jsdom and never loads
// `sources/index.html`, so a broken entry point would pass CI — which matters
// because of the rule the design doc sets: no figure reaches the UI before its
// source and working are on the site.
//
// Each citation is asserted by the label and URL in `sources.ts` itself, so a
// changed label or a moved GOV.UK page updates the page and this test together.
test.describe('sources & ethos page: student loan and pension citations', () => {
  const CITATIONS = [
    SOURCES.studentLoanRepayments,
    SOURCES.studentLoanPlans,
    SOURCES.studentLoanEmployers,
    SOURCES.pensionNationalInsurance,
    SOURCES.salarySacrifice,
    SOURCES.pensionArrangements,
    SOURCES.pensionTaxRelief,
    SOURCES.salarySacrificeReform,
  ]

  test('cites every student-loan and pension source as a link to its own URL', async ({ page }) => {
    await page.goto('/sources/')

    // The eight the issue lists: the student-loan repayment, plan and employer
    // guidance pages, HMRC NIM02365, salary sacrifice, workplace pensions,
    // pension tax relief, and salary-sacrifice reform 2029.
    expect(CITATIONS).toHaveLength(8)
    expect(new Set(CITATIONS.map((source) => source.url)).size).toBe(8)

    await Promise.all(
      CITATIONS.map(async (source) => {
        const link = page.getByRole('link', { name: source.label, exact: true })
        await expect(link, source.label).toHaveCount(1)
        await expect(link, source.label).toHaveAttribute('href', source.url)
        // External citations open in a new tab, with the opener guard.
        await expect(link).toHaveAttribute('target', '_blank')
        await expect(link).toHaveAttribute('rel', /noopener/)
      }),
    )
  })

  test('HMRC NIM02365 is cited by its manual reference, not just a bare link', async ({ page }) => {
    // The one citation that is a manual page rather than a guidance page; its
    // reference is what makes it checkable.
    await page.goto('/sources/')

    expect(SOURCES.pensionNationalInsurance.label).toContain('NIM02365')
    await expect(page.getByRole('link', { name: /NIM02365/ })).toHaveCount(1)
  })

  test('says what each new source is used for, alongside its link', async ({ page }) => {
    await page.goto('/sources/')

    await Promise.all(CITATIONS.map((source) => expect(page.getByText(source.usedFor), source.label).toBeVisible()))
  })

  test('the privacy line warns that share links carry loan and pension details', async ({ page }) => {
    await page.goto('/sources/')

    const privacy = page.getByText(/Copy result link.*encodes your figures in the link itself/)
    await expect(privacy).toBeVisible()
    await expect(privacy).toContainText('student loan and pension details')
    // And the standing promise it sits with.
    await expect(page.getByText(/nothing you type is sent to or stored by us/)).toBeVisible()
  })
})
