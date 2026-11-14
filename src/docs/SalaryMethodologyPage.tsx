import { ExternalLink } from './article/ExternalLink'
import { Section } from './article/Section'
import { Paragraph as P } from './article/Paragraph'
import { Strong } from './article/Strong'
import { Formula } from './article/Formula'
import { DataTable } from './article/DataTable'
import { Num } from './article/Num'
import { DocPage } from './article/DocPage'
import { ModelLimitations } from './article/ModelLimitations'
import { MethodologySources } from './article/MethodologySources'
import { fmt, fmtPence } from '../lib/calculations'
import type { PayProfile, PensionInput } from '../lib/deductions'
import { STUDENT_LOAN_PLANS, STUDENT_PLAN_LABELS } from '../lib/payProfile'
import { incomeTaxOn, nationalInsuranceOn, netFromGross, grossFromNet, marginalNetRate, takeHomeBreakdown } from '../lib/salary'
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

/** "13 November 2026" from "2026-11-13", read as a calendar date wherever the reader is. */
const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

// Student loans and pensions, worked through at one salary. Every figure is
// computed by the engine, like everything else on this page.
const LOAN_EXAMPLE = (() => {
  const gross = 35000
  const plan2: PayProfile = { studentPlan: 'plan2', postgradLoan: false, pension: null }
  const repaid = takeHomeBreakdown(gross, TY, plan2).studentLoan
  return { gross, threshold: TY.studentLoanPlans.plan2.threshold, repaid }
})()

const PENSION_EXAMPLE = (() => {
  const gross = 35000
  const percent = 5
  const withPension = (pension: PensionInput | null) => takeHomeBreakdown(gross, TY, { studentPlan: 'plan2', postgradLoan: false, pension })
  const fivePercent = (arrangement: 'sacrifice' | 'netpay'): PensionInput => ({ arrangement, mode: 'percent', percent, monthlyAmount: 0 })
  return {
    gross,
    percent,
    none: withPension(null),
    sacrifice: withPension(fivePercent('sacrifice')),
    netpay: withPension(fivePercent('netpay')),
  }
})()

// A 5% contribution at £35,000 on the whole salary, against the same 5% on
// auto-enrolment's qualifying earnings only.
const QUALIFYING = (() => {
  const { lower, upper } = TY.qualifyingEarnings
  const gross = 35000
  const onWhole = 0.05 * gross
  const onBand = 0.05 * (Math.min(gross, upper) - lower)
  return { lower, upper, gross, onWhole, onBand }
})()

const pctOf = (rate: number) => `${Math.round(rate * 100)}%`

/** The public "show your working" page for the reverse "what salary would I need?" mode. */
export function SalaryMethodologyPage() {
  return (
    <DocPage title="How the “what salary would I need?” flip works">
      <P>
        Every result has a “flip it” panel that turns the question around: instead of “at your income, can you afford it?”, it answers “for
        this, what would you need to earn?”. This page is the full working behind that number — how a plan becomes a take-home target, and
        how we turn that take-home back into a gross salary. The figures below are read live from the same code the calculator runs, so they
        can't drift from what you see.
      </P>
      <P>
        It's an estimate for illustration, not financial advice or a tax calculation for your own return. It assumes a single{' '}
        <Strong>{TY.label}</Strong> PAYE salary in England, Wales or Northern Ireland on the standard tax code. If you tell us about a{' '}
        <Strong>student loan</Strong> or a <Strong>workplace pension</Strong> under &ldquo;About your pay&rdquo; on the Budget step, your
        take-home and the salary a plan needs both allow for it; if you don't, we assume neither. Scotland has its own tax bands and isn't
        modelled yet.
      </P>
      <P>
        Every rate and threshold below was last checked against GOV.UK on <Strong>{longDate(TY.verifiedOn)}</Strong>.
      </P>

      <Section title="Step 1 — from the plan to a take-home target">
        <P>
          First we work out the monthly <Strong>take-home</Strong> the plan needs. Every plan already produces a monthly commitment — a
          saving, a finance payment, or a car's total monthly cost — and your <Strong>spare cash</Strong> is take-home pay minus the
          essential outgoings you entered and minus any regular saving you already do. So the take-home a plan needs is everything already
          committed plus enough spare cash to cover the commitment:
        </P>
        <Formula>{`required take-home = essentials + regular saving + required spare cash`}</Formula>
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
          <Strong>Income tax.</Strong> Everyone gets a tax-free <ExternalLink href={SOURCES.incomeTax.url}>personal allowance</ExternalLink>{' '}
          of {fmt(TY.personalAllowance)}; income above it is taxed in bands:
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

        <Formula>{`take-home = gross − income tax − National Insurance − student loans − pension`}</Formula>
        <P>
          So a <Strong>{fmt(FORWARD.gross)}</Strong> salary with no student loan or pension pays <Num>{fmt(FORWARD.tax)}</Num> income tax
          and <Num>{fmt(FORWARD.ni)}</Num> NI, leaving <Strong>{fmt(FORWARD.net)}</Strong> take-home a year. The next two sections cover the
          other two lines.
        </P>
      </Section>

      <Section title="Student loans">
        <P>
          An undergraduate <ExternalLink href={SOURCES.studentLoanRepayments.url}>student loan</ExternalLink> is repaid at a fixed share of
          your pay over a yearly threshold, which depends on your plan:
        </P>
        <DataTable
          head={['Plan', 'Repaid', 'On pay over']}
          rows={[
            ...STUDENT_LOAN_PLANS.map((plan) => [
              STUDENT_PLAN_LABELS[plan],
              pctOf(TY.studentLoanPlans[plan].rate),
              fmt(TY.studentLoanPlans[plan].threshold),
            ]),
            ['Postgraduate Loan', pctOf(TY.postgraduateLoan.rate), fmt(TY.postgraduateLoan.threshold)],
          ]}
        />
        <P>
          Your plan depends on where and when you applied for funding, not where you live now, which is why Plan 4 (Scotland) works
          alongside the England, Wales and Northern Ireland tax bands here. A Postgraduate Loan is repaid <em>on top of</em> any
          undergraduate plan. If you have more than one undergraduate plan, you make a single repayment, at{' '}
          {pctOf(TY.studentLoanPlans.plan1.rate)} over the lowest of their thresholds, so choose the plan with the lowest one.
        </P>
        <P>
          Repayments are worked out on the same pay your employer works{' '}
          <ExternalLink href={SOURCES.studentLoanEmployers.url}>National Insurance</ExternalLink> out on. So a{' '}
          <Strong>{fmt(LOAN_EXAMPLE.gross)}</Strong> salary on Plan 2 repays {pctOf(TY.studentLoanPlans.plan2.rate)} of the{' '}
          {fmt(LOAN_EXAMPLE.gross - LOAN_EXAMPLE.threshold)} over {fmt(LOAN_EXAMPLE.threshold)}: <Num>{fmtPence(LOAN_EXAMPLE.repaid)}</Num>{' '}
          a year, or <Strong>{fmtPence(LOAN_EXAMPLE.repaid / 12)}</Strong> a month.
        </P>
      </Section>

      <Section title="Workplace pensions">
        <P>
          How much a pension takes from your take-home depends on how it is paid. We offer the two arrangements that come out of pay before
          income tax:
        </P>
        <DataTable
          head={['Arrangement', 'How it is taken', 'Lowers income tax', 'Lowers NI and student loan']}
          rows={[
            [
              'Salary sacrifice',
              <>
                Your <ExternalLink href={SOURCES.salarySacrifice.url}>salary itself is lowered</ExternalLink>
              </>,
              'Yes',
              'Yes',
            ],
            [
              'Net pay',
              <>
                <ExternalLink href={SOURCES.pensionArrangements.url}>Taken from your pay</ExternalLink> before income tax
              </>,
              'Yes',
              <>
                No — <ExternalLink href={SOURCES.pensionNationalInsurance.url}>NI is charged before pension contributions</ExternalLink>
              </>,
            ],
          ]}
        />
        <P>
          On {fmt(PENSION_EXAMPLE.gross)} with Plan 2, a {PENSION_EXAMPLE.percent}% pension takes your monthly take-home from{' '}
          <Num>{fmtPence(PENSION_EXAMPLE.none.takeHome / 12)}</Num> to <Strong>{fmtPence(PENSION_EXAMPLE.sacrifice.takeHome / 12)}</Strong>{' '}
          under salary sacrifice, and <Strong>{fmtPence(PENSION_EXAMPLE.netpay.takeHome / 12)}</Strong> under net pay. Both put{' '}
          {fmtPence(PENSION_EXAMPLE.netpay.intoPension / 12)} a month into the pension; salary sacrifice also saves NI and, by lowering the
          pay the loan is worked out on, student loan. Your employer's own contribution doesn't change your take-home, so it isn't counted.
        </P>
        <P>
          <Strong>What a percentage means.</Strong> We take it as a share of your whole salary. Auto-enrolment minimums are often worked out
          on <ExternalLink href={SOURCES.autoEnrolment.url}>qualifying earnings</ExternalLink> instead: pay between {fmt(QUALIFYING.lower)}{' '}
          and {fmt(QUALIFYING.upper)}. At {fmt(QUALIFYING.gross)}, 5% of the whole salary is {fmt(QUALIFYING.onWhole)} a year, but 5% of
          qualifying earnings is {fmt(QUALIFYING.onBand)}. If your scheme works that way, enter the £ amount from your payslip instead.
        </P>
        <P>
          <Strong>What a monthly amount means.</Strong> The amount taken from your pay each month, as it shows on your payslip. The pension
          never gets more than your whole salary, since{' '}
          <ExternalLink href={SOURCES.pensionTaxRelief.url}>tax relief only covers contributions up to 100% of your earnings</ExternalLink>.
        </P>
        <P>
          <Strong>Relief at source</Strong>, where the pension comes out after tax and your provider adds 20%, isn't offered yet. If that's
          yours and you only pay basic-rate tax, choose net pay and enter the percentage your scheme quotes: the take-home comes out the
          same.
        </P>
      </Section>

      <Section title="Step 3 — inverting it (a search, not algebra)">
        <P>
          Reversing that — take-home back to gross — is where it gets fiddly, because of the taper in the next section. Rather than untangle
          the algebra (which is easy to get subtly wrong), we use the fact that take-home always rises as gross rises, and simply{' '}
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

      <ModelLimitations
        rows={[
          [
            'Scottish tax',
            'Scotland has its own six income-tax bands. We use the England/Wales/NI bands; a Scottish salary will come out a little different.',
          ],
          [
            'Relief at source',
            "Pensions taken after tax, with your provider adding 20%, aren't offered yet. On basic-rate tax, net pay with your scheme's percentage gives the same take-home.",
          ],
          ['Employer contributions', "Your employer's pension contribution doesn't change your take-home, so it isn't shown or counted."],
          [
            'Percentage of whole salary',
            `A pension percentage is taken as a share of your full salary. If your scheme uses qualifying earnings (${fmt(QUALIFYING.lower)} to ${fmt(QUALIFYING.upper)}), enter the £ amount from your payslip instead.`,
          ],
          [
            'Monthly rounding',
            'Employers round each student loan repayment down to the whole pound every payday. We work out the year and divide by 12, so your payslip may be up to £1 a month lower per loan.',
          ],
          [
            'One job, steady pay',
            'Student loan repayments are taken each payday against a weekly or monthly threshold, job by job. We assume one job paying the same every month.',
          ],
          [
            'Low earners in net pay schemes',
            <>
              If you earn less than the personal allowance, a net pay pension gets no tax relief on your payslip. HMRC{' '}
              <ExternalLink href={SOURCES.pensionTaxReliefGuide.url}>pays a top-up after the year</ExternalLink>, which we don't show.
            </>,
          ],
          ['Other salary sacrifice', 'Only pension salary sacrifice is modelled, not cycle-to-work, car or childcare schemes.'],
          [
            'Salary sacrifice from April 2029',
            <>
              <ExternalLink href={SOURCES.salarySacrificeReform.url}>National Insurance will apply</ExternalLink> to pension salary
              sacrifice over £2,000 a year from 6 April 2029. These figures are for {TY.label} and don't include it.
            </>,
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
            'Thresholds that move',
            `Income tax and NI bands are frozen until 2030/31, but Plan 1 and Plan 4 student loan thresholds rise every April, and Plan 5's from April 2027. We refresh every figure, and the ${fmt(
              TY.medianFullTimeSalary,
            )} median, each year; they were last checked on ${longDate(TY.verifiedOn)}.`,
          ],
        ]}
      />

      <MethodologySources
        intro="The official rates, rules and the earnings figure everything above is built on:"
        sources={SALARY_SOURCES}
        emailSubject="Salary methodology"
      />
    </DocPage>
  )
}
