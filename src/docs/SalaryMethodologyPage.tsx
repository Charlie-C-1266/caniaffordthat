import { Footer } from '../components/Footer'
import { ExternalLink } from './article/ExternalLink'
import { Section } from './article/Section'
import { Paragraph as P } from './article/Paragraph'
import { Strong } from './article/Strong'
import { Formula } from './article/Formula'
import { DataTable } from './article/DataTable'
import { Num } from './article/Num'
import { PageHeader } from './article/PageHeader'
import { fmt } from '../lib/calculations'
import { incomeTaxOn, nationalInsuranceOn, netFromGross, grossFromNet, marginalNetRate } from '../lib/salary'
import { CURRENT_TAX_YEAR } from '../lib/taxYears'
import { SALARY_SOURCES, SOURCES } from '../lib/sources'

// ---------------------------------------------------------------------------
// Every band and worked figure below is read live from lib/salary.ts and
// lib/taxYears.ts, so the page and the calculator can never disagree.
// ---------------------------------------------------------------------------
const TY = CURRENT_TAX_YEAR

// The income-tax bands are stored on *taxable* income; restate the familiar
// gross thresholds people recognise (the higher-rate threshold is the
// allowance plus the basic-rate band).
const BASIC_BAND = TY.incomeTaxBands[0]
const HIGHER_BAND = TY.incomeTaxBands[1]
const ADDITIONAL_BAND = TY.incomeTaxBands[2]
const HIGHER_RATE_THRESHOLD = TY.personalAllowance + BASIC_BAND.upTo // £50,270
const ADDITIONAL_RATE_THRESHOLD = HIGHER_BAND.upTo // £125,140
const TAPER_END = TY.taperThreshold + TY.personalAllowance / TY.taperRate // £125,140

// NI bands.
const NI_LOWER = TY.niBands[0].upTo // £12,570 (primary threshold)
const NI_UPPER = TY.niBands[1].upTo // £50,270 (upper earnings limit)
const NI_MAIN_RATE = TY.niBands[1].rate
const NI_UPPER_RATE = TY.niBands[2].rate

const pct = (rate: number) => `${Math.round(rate * 100)}%`

// A worked forward example (gross → take-home) and a reverse one (a required
// take-home → the salary behind it), both computed with the real functions.
const FORWARD = (() => {
  const gross = 50000
  return { gross, tax: incomeTaxOn(gross), ni: nationalInsuranceOn(gross), net: netFromGross(gross) }
})()

const REVERSE = (() => {
  const takeHomeMonthly = 2900
  const annual = takeHomeMonthly * 12
  const gross = grossFromNet(annual)
  return { takeHomeMonthly, annual, gross }
})()

// A £110k example, squarely in the personal-allowance taper band, for the
// "£100k tax trap" section.
const TAPER = (() => {
  const gross = 110000
  const kept = marginalNetRate(gross)
  return { gross, kept, perPound: 1 / kept }
})()

/** Rounds a salary to the nearest £100 for the "about £X" figures the panel shows. */
const roundSalary = (n: number) => Math.round(n / 100) * 100

/** The public "show your working" page for the reverse "what salary would I need?" mode. */
export function SalaryMethodologyPage() {
  return (
    <>
      <main style={{ maxWidth: 780, margin: '0 auto', padding: '36px 28px 40px' }}>
        <PageHeader />

        <h1 style={{ fontSize: 'var(--fs-h1-md)', lineHeight: 1.1, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 14px' }}>
          How the “what salary would I need?” flip works
        </h1>
        <P>
          Every result has a “flip it” panel that turns the question around: instead of “at your income, can you afford it?”, it answers
          “for this, what would you need to earn?”. This page is the full working behind that number — how a plan becomes a take-home
          target, and how we turn that take-home back into a gross salary. The figures below are read live from the same code the calculator
          runs, so they can't drift from what you see.
        </P>
        <P>
          It's an estimate for illustration, not financial advice or a tax calculation for your own return. It assumes a single{' '}
          <Strong>{TY.label}</Strong> PAYE salary in England, Wales or Northern Ireland on the standard tax code, with{' '}
          <Strong>no student loan and no pension contributions</Strong> — the two things most likely to make your own payslip differ.
          Scotland has its own tax bands and isn't modelled yet.
        </P>

        <Section title="Step 1 — from the plan to a take-home target">
          <P>
            First we work out the monthly <Strong>take-home</Strong> the plan needs. Every plan already produces a monthly commitment — a
            saving, a finance payment, or a car's total monthly cost — and your <Strong>spare cash</Strong> is take-home pay minus the
            essential outgoings you entered. So the take-home a plan needs is your essentials plus enough spare cash to cover the
            commitment:
          </P>
          <Formula>{`required take-home = essentials + required spare cash`}</Formula>
          <P>Exactly what “required spare cash” means depends on how the plan is judged:</P>
          <DataTable
            head={['Plan type', 'What the salary has to cover']}
            rows={[
              [
                'Paying monthly, or saving to a date',
                'The commitment is a fixed amount, and the verdict is whether it fits your spare cash — so the required spare cash is the commitment itself.',
              ],
              [
                'A car',
                'Same idea: the required spare cash is the total monthly cost of the car (finance plus fuel, maintenance, insurance and tax).',
              ],
              [
                'Saving a share of spare cash',
                'We reverse the affordability rule — the required spare cash is the amount whose chosen save-rate reaches the goal within the 5-year cash-savings horizon the calculator uses.',
              ],
              [
                'Saving a fixed amount each month',
                "There's nothing to reverse — you save the same amount whatever you earn, so the flip panel doesn't appear for this one.",
              ],
            ]}
          />
        </Section>

        <Section title="Step 2 — from take-home back to a gross salary">
          <P>
            The interesting part is undoing PAYE: turning a take-home figure into the gross salary it came from. Going <em>forwards</em>,
            take-home is gross pay minus income tax and employee National Insurance.
          </P>

          <P>
            <Strong>Income tax.</Strong> Everyone gets a tax-free{' '}
            <ExternalLink href={SOURCES.incomeTax.url}>personal allowance</ExternalLink> of {fmt(TY.personalAllowance)}; income above it is
            taxed in bands:
          </P>
          <DataTable
            head={['Band', 'Rate', 'On income']}
            rows={[
              ['Personal allowance', '0%', <>Up to {fmt(TY.personalAllowance)} (see the taper below)</>],
              [
                'Basic rate',
                pct(BASIC_BAND.rate),
                <>
                  {fmt(TY.personalAllowance)} to {fmt(HIGHER_RATE_THRESHOLD)}
                </>,
              ],
              [
                'Higher rate',
                pct(HIGHER_BAND.rate),
                <>
                  {fmt(HIGHER_RATE_THRESHOLD)} to {fmt(ADDITIONAL_RATE_THRESHOLD)}
                </>,
              ],
              ['Additional rate', pct(ADDITIONAL_BAND.rate), <>Over {fmt(ADDITIONAL_RATE_THRESHOLD)}</>],
            ]}
          />

          <P>
            <Strong>National Insurance.</Strong> Employee (Class 1) <ExternalLink href={SOURCES.nationalInsurance.url}>NI</ExternalLink> is
            charged on gross pay, not on income after the allowance:
          </P>
          <DataTable
            head={['Band', 'Rate', 'On gross pay']}
            rows={[
              [
                pct(NI_MAIN_RATE),
                pct(NI_MAIN_RATE),
                <>
                  {fmt(NI_LOWER)} to {fmt(NI_UPPER)}
                </>,
              ],
              [pct(NI_UPPER_RATE), pct(NI_UPPER_RATE), <>Over {fmt(NI_UPPER)}</>],
            ]}
          />

          <Formula>{`take-home = gross − income tax − National Insurance`}</Formula>
          <P>
            So a <Strong>{fmt(FORWARD.gross)}</Strong> salary pays <Num>{fmt(FORWARD.tax)}</Num> income tax and <Num>{fmt(FORWARD.ni)}</Num>{' '}
            NI, leaving <Strong>{fmt(FORWARD.net)}</Strong> take-home a year.
          </P>
        </Section>

        <Section title="Step 3 — inverting it (a search, not algebra)">
          <P>
            Reversing that — take-home back to gross — is where it gets fiddly, because of the taper in the next section. Rather than
            untangle the algebra (which is easy to get subtly wrong), we use the fact that take-home always rises as gross rises, and simply{' '}
            <Strong>search</Strong> for the gross that produces the take-home we want: guess a salary, check its take-home, and halve the
            range each time until it matches to within a penny. A few dozen steps of a calculation that runs in microseconds.
          </P>
          <P>
            That's how the panel gets its figure. To afford a plan needing <Strong>{fmt(REVERSE.takeHomeMonthly)}/month</Strong> take-home (
            {fmt(REVERSE.annual)} a year), you'd need a salary of about <Strong>{fmt(roundSalary(REVERSE.gross))}</Strong> — and the panel
            compares that to the salary behind the take-home <em>you</em> entered, to show the gap as a pay rise.
          </P>
        </Section>

        <Section title="The £100,000 “tax trap”">
          <P>
            Above {fmt(TY.taperThreshold)}, the personal allowance is withdrawn by £1 for every £2 earned, disappearing entirely at{' '}
            {fmt(TAPER_END)}. In that band each extra pound is taxed <em>and</em> quietly makes another 50p of previously tax-free income
            taxable — an effective {pct(0.6)} income-tax rate, {pct(0.62)} once NI is added.
          </P>
          <P>
            The panel flags this when a required salary lands in the band: at around <Strong>{fmt(TAPER.gross)}</Strong> you keep only about{' '}
            <Num>{TAPER.kept.toFixed(2)}</Num> of the next pound, so every extra £1 of take-home the plan needs takes roughly{' '}
            <Strong>£{TAPER.perPound.toFixed(2)}</Strong> of extra salary. It's the kind of detail a payslip hides and a toy calculator
            usually misses.
          </P>
        </Section>

        <Section title="What we deliberately don't model (yet)">
          <P>Being upfront about the edges of the model matters as much as the model:</P>
          <DataTable
            head={['Simplification', 'What it means for you']}
            rows={[
              [
                'Scottish tax',
                'Scotland has its own six income-tax bands. We use the England/Wales/NI bands; a Scottish salary will come out a little different.',
              ],
              [
                'Student loans',
                "A Plan 2 student-loan deduction (9% over its threshold) is larger than NI for many people — leaving it out understates the salary you'd really need.",
              ],
              [
                'Pension contributions',
                'Workplace pension contributions reduce take-home (and sometimes tax); we model gross-to-take-home with no pension, so a real payslip with auto-enrolment will differ.',
              ],
              [
                'One income',
                'The figure is a single salary. Splitting a goal across a household — two allowances, two NI computations — is out of scope.',
              ],
              [
                'Salary only',
                'Employment income on the standard tax code, not dividends, self-employment or benefits-in-kind, which are taxed differently.',
              ],
              [
                'Frozen thresholds',
                `The bands are frozen until 2030/31, so the figures stay put for now — but we refresh them (and the ${fmt(
                  TY.medianFullTimeSalary,
                )} median) each year to be safe.`,
              ],
            ]}
          />
        </Section>

        <Section title="Sources">
          <P>The official rates and the earnings figure everything above is built on:</P>
          <ul style={{ margin: '0 0 14px', paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SALARY_SOURCES.map((source) => (
              <li key={source.url} style={{ fontSize: 'var(--fs-body)', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                <ExternalLink href={source.url}>{source.label}</ExternalLink>
              </li>
            ))}
          </ul>
          <P>
            For the full list behind every calculator — and more on how the site works and why —{' '}
            <a href="/sources/" style={{ color: 'var(--text-secondary)', textDecoration: 'underline' }}>
              see our sources &amp; ethos page
            </a>
            .
          </P>
          <P>
            Spotted something wrong, or a rate that's moved? Email{' '}
            <ExternalLink href="mailto:hello@caniaffordthat.co.uk?subject=Salary%20methodology">hello@caniaffordthat.co.uk</ExternalLink> —
            corrections are very welcome.
          </P>
        </Section>
      </main>
      <Footer />
    </>
  )
}
