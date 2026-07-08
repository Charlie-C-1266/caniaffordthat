import { Footer } from '../components/Footer'
import { ExternalLink } from './article/ExternalLink'
import { Section } from './article/Section'
import { Paragraph as P } from './article/Paragraph'
import { Strong } from './article/Strong'
import { Formula } from './article/Formula'
import { DataTable } from './article/DataTable'
import { Num } from './article/Num'
import { PageHeader } from './article/PageHeader'
import { DepreciationChart } from './DepreciationChart'
import { fmt, paymentForFinance } from '../lib/calculations'
import { SPARE_CASH_COMFORTABLE_RATIO, SPARE_CASH_TIGHT_RATIO } from '../lib/derive'
import {
  DEFAULT_FUEL_PENCE_PER_LITRE,
  EXPENSIVE_CAR_PRICE_THRESHOLD,
  EXPENSIVE_CAR_SUPPLEMENT_ANNUAL,
  GMFV_MARGIN,
  LITRES_PER_GALLON,
  MAINTENANCE_PRESETS,
  MILEAGE_FACTOR_MAX,
  MILEAGE_FACTOR_MIN,
  MILEAGE_VALUE_PER_1000_MILES,
  STANDARD_VED_ANNUAL,
  TERM_RANGES,
  UK_AVERAGE_ANNUAL_MILES,
  estimateBalloon,
  pcpPayment,
  retentionAt,
} from '../lib/vehicle'
import { SOURCES, VEHICLE_SOURCES } from '../lib/sources'

// ---------------------------------------------------------------------------
// The worked example quoted through the page — computed live from the same
// functions the calculator runs, so the documented numbers can't go stale.
// ---------------------------------------------------------------------------
const EXAMPLE = (() => {
  const price = 20_000
  const termMonths = 48
  const aprPct = 9.9
  const balloon = estimateBalloon({ price, ageYears: 0, currentMileage: 0, termMonths, annualMiles: UK_AVERAGE_ANNUAL_MILES })
  return {
    price,
    termMonths,
    aprPct,
    balloon,
    pcpMonthly: pcpPayment(price, balloon, termMonths, aprPct),
    hpMonthly: paymentForFinance(price, termMonths, aprPct),
  }
})()

const pct = (ratio: number) => `${Math.round(ratio * 100)}%`

/**
 * The public "show your working" page for the vehicle calculator: every
 * formula, rate and assumption, quoted live from lib/vehicle.ts so the page
 * and the calculator can never disagree.
 */
export function VehicleMethodologyPage() {
  return (
    <>
      <main style={{ maxWidth: 780, margin: '0 auto', padding: '36px 28px 40px' }}>
        <PageHeader accentColor="var(--accent-finance)" />

        <h1 style={{ fontSize: 'var(--fs-h1-md)', lineHeight: 1.1, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 14px' }}>
          How the vehicle calculator works
        </h1>
        <P>
          The vehicle calculator gives a plain yes-or-no on whether a car fits your budget. This page is the full working
          behind that verdict: every formula, every rate, and every assumption — with the UK guidance each one is based
          on. The numbers below aren't a copy of the code; they're read from it, so what you see here is exactly what the
          calculator runs.
        </P>
        <P>
          Everything is an estimate for illustration, not financial advice or a quote — real offers depend on your credit
          profile, the exact car, and the lender.
        </P>

        <Section title="The verdict: total monthly cost vs spare cash">
          <P>
            A car costs you two ways at once: any finance payment, and the running costs that don't stop when the engine
            does. We add them together and compare the total to your <Strong>spare cash</Strong> — take-home pay minus
            the monthly outgoings you enter on the budget step.
          </P>
          <Formula>{`total monthly cost = finance payment + fuel + maintenance + insurance + road tax
verdict: affordable when total monthly cost ≤ spare cash`}</Formula>
          <P>How comfortably it fits uses the same bands as the rest of the site:</P>
          <DataTable
            head={['Share of your spare cash', 'How we describe it']}
            rows={[
              [<>Up to {pct(SPARE_CASH_COMFORTABLE_RATIO)}</>, 'Fits comfortably'],
              [<>{pct(SPARE_CASH_COMFORTABLE_RATIO)}–{pct(SPARE_CASH_TIGHT_RATIO)}</>, 'Fits, but takes a good chunk'],
              [<>Over {pct(SPARE_CASH_TIGHT_RATIO)}</>, "Fits, but it's tight"],
              ['Over 100%', "No — that's a stretch"],
            ]}
          />
          <P>
            The {pct(SPARE_CASH_COMFORTABLE_RATIO)} and {pct(SPARE_CASH_TIGHT_RATIO)} cutoffs are converted from two UK
            rules of thumb — the savings bucket of{' '}
            <ExternalLink href={SOURCES.fiftyThirtyTwenty.url}>Halifax's 50/30/20 split</ExternalLink> and{' '}
            <ExternalLink href={SOURCES.rentAffordability.url}>MoneyHelper's 30%-of-income ceiling</ExternalLink> for a
            single major commitment — restated as shares of spare cash rather than shares of income.
          </P>
        </Section>

        <Section title="The four ways of paying">
          <P>
            The purchase step models the four ways cars are actually bought in the UK. For every financed method,{' '}
            <Strong>P</Strong> is the amount financed (price minus your deposit or part-exchange), <Strong>i</Strong> is
            the monthly interest rate (APR ÷ 12), and <Strong>n</Strong> is the term in months.
          </P>
          <DataTable
            head={['Method', 'What we compute', 'Term range']}
            rows={[
              [
                'Cash',
                'No borrowing: the price (less part-exchange) is due on the day, and only running costs count monthly.',
                '—',
              ],
              [
                'Hire purchase (HP)',
                <>
                  Standard amortisation — equal payments that clear the balance, so the car is yours after the final one (
                  <ExternalLink href={SOURCES.hirePurchase.url}>MoneyHelper's HP guide</ExternalLink>).
                </>,
                <Num key="hp">{TERM_RANGES.hp.min}–{TERM_RANGES.hp.max} mo</Num>,
              ],
              [
                'Personal loan',
                'The same amortisation as HP, but you borrow separately and own the car from day one.',
                <Num key="loan">{TERM_RANGES.loan.min}–{TERM_RANGES.loan.max} mo</Num>,
              ],
              [
                'PCP',
                <>
                  Payments only bridge the gap down to the balloon (GMFV), and interest accrues on the <em>whole</em>{' '}
                  balance including the balloon (<ExternalLink href={SOURCES.pcp.url}>MoneyHelper's PCP guide</ExternalLink>).
                </>,
                <Num key="pcp">{TERM_RANGES.pcp.min}–{TERM_RANGES.pcp.max} mo</Num>,
              ],
            ]}
          />
          <Formula>{`HP / loan payment = P × i ÷ (1 − (1 + i)⁻ⁿ)
PCP payment     = (P − B × (1 + i)⁻ⁿ) × i ÷ (1 − (1 + i)⁻ⁿ)   where B = the balloon`}</Formula>
          <P>
            That balloon term is why PCP payments look cheaper but the borrowing costs more: on a{' '}
            <Strong>{fmt(EXAMPLE.price)}</Strong> car over {EXAMPLE.termMonths} months at {EXAMPLE.aprPct}% APR, HP works
            out at <Strong>{fmt(EXAMPLE.hpMonthly)}/month</Strong> and owns the car outright, while a PCP with a{' '}
            {fmt(EXAMPLE.balloon)} balloon is <Strong>{fmt(EXAMPLE.pcpMonthly)}/month</Strong> — but the {fmt(EXAMPLE.balloon)}{' '}
            is still owed at the end if you want to keep it. The result screen shows the keep-the-car total and the full
            interest cost for whichever deal you set up.
          </P>
        </Section>

        <Section title="Estimating the final payment (the balloon / GMFV)">
          <P>
            On a PCP, the lender guarantees the car's value at the end of the agreement — the GMFV. If you have a quote,
            we use your figure exactly. If you don't, we estimate one from a <Strong>generic depreciation curve</Strong>:
          </P>
          <DataTable
            head={['Rule', 'Value we use']}
            rows={[
              ['First year', <>a car keeps <Num>{Math.round(retentionAt(1) * 100)}%</Num> of its as-new value</>],
              ['Each later year', <>it keeps <Num>{Math.round((retentionAt(2) / retentionAt(1)) * 100)}%</Num> of the previous year's value</>],
              [
                'Mileage adjustment',
                <>
                  ±<Num>{MILEAGE_VALUE_PER_1000_MILES * 100}%</Num> of value per 1,000 miles above or below average-for-age
                  ({UK_AVERAGE_ANNUAL_MILES.toLocaleString('en-GB')} miles/year), capped between{' '}
                  <Num>{Math.round(MILEAGE_FACTOR_MIN * 100)}%</Num> and <Num>{Math.round(MILEAGE_FACTOR_MAX * 100)}%</Num>
                </>,
              ],
              [
                'Lender margin',
                <>
                  the guaranteed figure is set at <Num>{Math.round(GMFV_MARGIN * 100)}%</Num> of the projected value —
                  lenders guarantee a little under what they expect the car to fetch
                </>,
              ],
            ]}
          />
          <P>
            That puts about <Strong>{Math.round((1 - retentionAt(3)) * 100)}%</Strong> of the value gone after three years
            at average mileage — inside the ranges UK motoring guidance quotes (
            <ExternalLink href={SOURCES.depreciation.url}>the AA's depreciation guide</ExternalLink>: 15–35% in year one,
            50–60% by year three). Because the price you're paying <em>today</em> already reflects the car's age and miles,
            we project the <em>ratio</em> of the curve at the end of the term to the curve now — not an absolute read.
          </P>
          <div
            style={{
              background: 'var(--tile-bg)',
              borderRadius: 'var(--radius-glass-sm)',
              padding: '18px 18px 14px',
              marginBottom: 14,
            }}
          >
            <div
              style={{
                fontSize: 'var(--fs-label)',
                fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--text-secondary-dim)',
                marginBottom: 12,
              }}
            >
              Value retained (% of as-new price) — the curve we use
            </div>
            <DepreciationChart />
          </div>
          <P>
            Worked example: a brand-new <Strong>{fmt(EXAMPLE.price)}</Strong> car on a {EXAMPLE.termMonths}-month PCP at
            average mileage projects to a <Strong>{fmt(EXAMPLE.balloon)}</Strong> final payment.
          </P>
          <P>
            <Strong>This is deliberately generic.</Strong> Real depreciation varies hugely by make, model, condition and
            market — a curve can't know that a specific car holds value unusually well or badly. That's why any result
            built on an estimated balloon says so, right on the result card, and why a real quote always takes priority
            when you have one.
          </P>
        </Section>

        <Section title="Running costs">
          <P>Fuel is worked out from three numbers you can adjust — miles per year, the car's real-world mpg, and the pump price:</P>
          <Formula>{`fuel £/month = miles per year ÷ 12 ÷ mpg × ${LITRES_PER_GALLON} litres/gallon × pence per litre ÷ 100`}</Formula>
          <DataTable
            head={['Input', 'Default', 'Why']}
            rows={[
              [
                'Miles per year',
                <Num key="v">{UK_AVERAGE_ANNUAL_MILES.toLocaleString('en-GB')}</Num>,
                'A widely used round figure for UK average annual mileage — adjust to how you actually drive.',
              ],
              [
                'Fuel price',
                <Num key="v">{DEFAULT_FUEL_PENCE_PER_LITRE}p/litre</Num>,
                <>
                  A static, editable default — pump prices move, so check today's on{' '}
                  <ExternalLink href={SOURCES.fuelWatch.url}>RAC Fuel Watch</ExternalLink> and type it in.
                </>,
              ],
              [
                'Maintenance',
                <Num key="v">£{MAINTENANCE_PRESETS[1].monthly}/month</Num>,
                'Servicing, MOT, tyres and repairs. The presets below are rough monthly budgets, not quotes.',
              ],
              ['Insurance', <Num key="v">£0/year</Num>, 'Premiums vary too much to guess — enter your quote or renewal figure.'],
            ]}
          />
          <DataTable
            head={['Maintenance preset', 'Monthly budget', 'Suits']}
            rows={MAINTENANCE_PRESETS.map((preset) => [preset.label, <Num key="m">£{preset.monthly}</Num>, preset.blurb])}
          />
          <P>
            No UK body publishes an official maintenance figure, so the presets are our own deliberately round budgets:
            a year at each level ({MAINTENANCE_PRESETS.map((p) => fmt(p.monthly * 12)).join(' / ')}) is sized to cover an
            annual service, the MOT fee, and a realistic share of tyres and wear-and-tear repairs for that kind of car.
            They're starting points to overwrite, not quotes.
          </P>
        </Section>

        <Section title="Road tax (VED)">
          <P>
            Road tax uses <ExternalLink href={SOURCES.vedRates.url}>GOV.UK's published rates</ExternalLink> (2026-27),
            spread across the year in your monthly total:
          </P>
          <DataTable
            head={['Charge', 'Rate we use', 'When it applies']}
            rows={[
              [
                'Standard rate',
                <Num key="v">£{STANDARD_VED_ANNUAL}/year</Num>,
                'Most cars first registered after April 2017. Prefilled but editable, if your car differs.',
              ],
              [
                'Expensive-car supplement',
                <Num key="v">+£{EXPENSIVE_CAR_SUPPLEMENT_ANNUAL}/year</Num>,
                <>
                  Cars with a list price over {fmt(EXPENSIVE_CAR_PRICE_THRESHOLD)}, charged in years 2–6. Added
                  automatically when you tell us the car is brand new and it's over the threshold.
                </>,
              ],
            ]}
          />
        </Section>

        <Section title="What we deliberately don't model (yet)">
          <P>Being upfront about the edges of the model matters as much as the model:</P>
          <DataTable
            head={['Simplification', 'What it means for you']}
            rows={[
              [
                'First-year VED',
                'Brand-new cars pay a one-off CO2-based first-year rate that can differ a lot from the standard rate; we use the standard rate throughout.',
              ],
              [
                'Nearly-new £40k cars',
                `The £${EXPENSIVE_CAR_SUPPLEMENT_ANNUAL} supplement attaches to the car for years 2–6 even second-hand; we only add it automatically for brand-new cars — add it to the tax field yourself for a nearly-new one.`,
              ],
              [
                'Price vs list price',
                "The over-£40k test legally uses the manufacturer's list price; we use the price you enter, which can differ after discounts.",
              ],
              [
                'Electric cars',
                'The fuel formula is petrol/diesel (mpg at the pump). For an EV, set mpg-based fuel to zero and fold charging into maintenance or insurance fields for now.',
              ],
              [
                'Option-to-purchase fees',
                'HP agreements often add a small (~£10) fee to the final payment; we leave it out as noise at this scale.',
              ],
            ]}
          />
        </Section>

        <Section title="Sources">
          <P>The UK guidance and official rates everything above is built on:</P>
          <ul style={{ margin: '0 0 14px', paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {VEHICLE_SOURCES.map((source) => (
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
            <ExternalLink href="mailto:hello@caniaffordthat.co.uk?subject=Vehicle%20methodology">
              hello@caniaffordthat.co.uk
            </ExternalLink>{' '}
            — corrections are very welcome.
          </P>
        </Section>
      </main>
      <Footer />
    </>
  )
}
