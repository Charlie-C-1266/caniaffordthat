import { Footer } from '../components/Footer'
import { ExternalLink } from './article/ExternalLink'
import { Section } from './article/Section'
import { Paragraph as P } from './article/Paragraph'
import { Strong } from './article/Strong'
import { DataTable } from './article/DataTable'
import { PageHeader } from './article/PageHeader'
import { HELPFUL_LINKS, SOURCE_LIST } from '../lib/sources'

/** A methodology page we've published, listed in "The full working, per calculator". */
const METHODOLOGY_PAGES = [
  {
    label: 'How the vehicle calculator works',
    href: '/methodology/vehicle/',
    blurb: 'Cash, PCP, HP and loan maths, the depreciation curve behind estimated balloons, fuel and road-tax figures.',
  },
]

/**
 * The public sources & ethos page: what the site is for, the principles it's
 * built on, every source behind the numbers (annotated with what each one
 * backs), the per-calculator methodology pages, and a growing list of
 * genuinely useful UK money-guidance resources.
 */
export function SourcesPage() {
  return (
    <>
      <main style={{ maxWidth: 780, margin: '0 auto', padding: '36px 28px 40px' }}>
        <PageHeader />

        <h1 style={{ fontSize: 'var(--fs-h1-md)', lineHeight: 1.1, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 14px' }}>
          Our sources &amp; ethos
        </h1>
        <P>
          Can I Afford That? answers one question — is this within reach? — with a straight yes or no, backed by real
          numbers. This page is where those numbers come from: the UK guidance behind every threshold, the principles the
          site is built on, and where to go for proper help beyond a calculator.
        </P>

        <Section title="What this site is for">
          <P>
            Big-purchase maths is easy to get wrong and easy to be misled about — a monthly payment always <em>looks</em>{' '}
            affordable in a showroom. The aim here is a two-minute, judgement-free way to see a purchase the way a
            careful friend would: what it really costs each month, how that sits against the money you actually have
            spare, and what you'd be signing up to.
          </P>
        </Section>

        <Section title="How we work">
          <DataTable
            head={['Principle', 'What it means in practice']}
            rows={[
              [
                'Free and impartial',
                'No sign-up, no ads, no affiliate links, nothing to sell. We make nothing from what you decide, so the verdict has no reason to flatter you.',
              ],
              [
                'Show your working',
                'Every threshold is grounded in published UK guidance (the table below), and each calculator gets a methodology page publishing its full formulas and assumptions.',
              ],
              [
                'UK-first',
                'Pounds, UK finance products as they\'re actually sold (PCP, HP), UK tax rates, and UK guidance bodies — not translated American rules of thumb.',
              ],
              [
                'Estimates, not advice',
                'Everything is illustrative. Real offers depend on your circumstances — for significant decisions, speak to a qualified financial adviser.',
              ],
              [
                'Your numbers stay yours',
                'There\'s no backend: the maths runs in your browser and nothing you type is sent to or stored by us (we use anonymous page-view analytics only). "Copy result link" encodes your figures in the link itself, so share those links thoughtfully.',
              ],
              [
                'Open source',
                <>
                  The whole site is public — read the code, check the maths, or raise an issue on{' '}
                  <ExternalLink href="https://github.com/Charlie-C-1266/caniaffordthat">GitHub</ExternalLink>.
                </>,
              ],
            ]}
          />
        </Section>

        <Section title="The sources behind the numbers">
          <P>
            Every threshold and rate in the calculators traces back to one of these — the same list as the{' '}
            <Strong>"Our sources"</Strong> button in the app, with what each one actually backs:
          </P>
          <DataTable
            head={['Source', 'What we use it for']}
            rows={SOURCE_LIST.map((source) => [
              <ExternalLink key="l" href={source.url}>{source.label}</ExternalLink>,
              source.usedFor,
            ])}
          />
        </Section>

        <Section title="The full working, per calculator">
          <P>Each calculator publishes its complete methodology — every formula, rate and assumption — on its own page:</P>
          <ul style={{ margin: '0 0 14px', paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {METHODOLOGY_PAGES.map((page) => (
              <li key={page.href} style={{ fontSize: 'var(--fs-body)', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                <a href={page.href} style={{ color: 'var(--text-secondary)', textDecoration: 'underline' }}>
                  {page.label}
                </a>{' '}
                — {page.blurb}
              </li>
            ))}
          </ul>
          <P>More will appear here as each calculator's accuracy pass lands.</P>
        </Section>

        <Section title="Helpful reading">
          <P>
            Not citations — just places we'd genuinely send a friend for wider money knowledge, or for proper help when a
            calculator isn't the right tool:
          </P>
          <DataTable
            head={['Resource', 'Why it\'s worth a look']}
            rows={HELPFUL_LINKS.map((link) => [
              <ExternalLink key="l" href={link.url}>{link.label}</ExternalLink>,
              link.blurb,
            ])}
          />
          <P>
            This list will grow. Got a resource that belongs here? Email{' '}
            <ExternalLink href="mailto:hello@caniaffordthat.co.uk?subject=Helpful%20reading%20suggestion">
              hello@caniaffordthat.co.uk
            </ExternalLink>{' '}
            — suggestions are very welcome.
          </P>
        </Section>
      </main>
      <Footer />
    </>
  )
}
