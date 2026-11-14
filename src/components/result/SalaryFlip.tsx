import { fmt } from '../../lib/calculations'
import { salaryFlip, type CurrentPay } from '../../lib/reverse'
import { CURRENT_TAX_YEAR, type TaxYear } from '../../lib/taxYears'
import { BreakdownBox } from './BreakdownBox'
import { BreakdownRow } from './BreakdownRow'
import { TotalRow } from './TotalRow'

// The reverse "what would I need to earn?" panel. The forward tool answers "at
// your income, can you afford it?"; this flips it to "for this, what salary
// would it take?" — the genuinely shareable output ("you'd need a £58k salary
// for this car"). Reads the plan's required take-home (computed per-mode
// upstream) and inverts UK income tax + NI to a gross salary.
//
// The user's own salary is shown as typed in salary mode, and estimated from
// their take-home otherwise. When more than one salary gives that take-home,
// the estimate is left out rather than guessed: the panel still says whether
// the plan fits, because that compares take-home, but not what they earn or
// the pay rise in between.

interface SalaryFlipProps {
  /** Monthly take-home the plan needs to be affordable. */
  requiredTakeHomeMonthly: number
  /** The user's pay now, as the Budget step captured it — see `currentPayOf`. */
  current: CurrentPay
  /** Accent used for the flipped salary figure — the mode accent on a "Yes", a neutral tone on a "No". */
  accentColor: string
  /** The tax year to work in. Defaults to the current one; a parameter so a test can render a take-home that more than one salary gives. */
  year?: TaxYear
}

/** Rounds a gross salary to the nearest £100 — a "you'd need about £X" figure shouldn't imply pound-precision. */
function roundSalary(n: number): number {
  return Math.round(n / 100) * 100
}

/** What the panel says under the headline, and in its closing breakdown row. */
interface FlipWording {
  subheadline: string
  /** The user's salary row, or `null` when there's no single salary to show. */
  currentRow: { label: string; value: string } | null
  totalLabel: string
  totalValue: string
}

/**
 * The panel's wording for a flip. Three cases: a salary the user typed (shown
 * exactly), a salary estimated from their take-home (rounded, and marked as an
 * estimate), and a take-home no single salary explains (no salary shown, and
 * the gap given in take-home instead).
 */
function wordingFor(flip: ReturnType<typeof salaryFlip>, current: CurrentPay): FlipWording {
  const requiredGross = fmt(roundSalary(flip.requiredGross))
  const takeHomeGap = fmt(Math.round(Math.abs(flip.takeHomeMonthlyGap)))

  if (flip.currentGross === null || flip.grossGap === null) {
    return {
      subheadline: flip.alreadyEnough
        ? `You already take home enough — this needs about ${requiredGross} a year.`
        : `This needs about ${requiredGross} a year — about ${takeHomeGap}/month more take-home than you have now.`,
      currentRow: null,
      totalLabel: flip.alreadyEnough ? 'YOU CAN COVER IT' : 'MORE TAKE-HOME NEEDED',
      totalValue: flip.alreadyEnough ? `${takeHomeGap}/mo to spare` : `${takeHomeGap}/mo`,
    }
  }

  const typed = current.kind === 'salary'
  const currentGross = fmt(typed ? Math.round(flip.currentGross) : roundSalary(flip.currentGross))
  const gap = fmt(roundSalary(Math.abs(flip.grossGap)))
  return {
    subheadline: flip.alreadyEnough
      ? `You already earn enough — this needs about ${requiredGross} a year, and you're on ${typed ? '' : 'roughly '}${currentGross}.`
      : `That's roughly a ${gap} pay rise on your ${typed ? `${currentGross} salary` : `estimated ${currentGross}`} — about ${takeHomeGap}/month more take-home.`,
    currentRow: { label: typed ? 'YOUR SALARY' : 'YOUR SALARY (EST.)', value: `${currentGross}/yr` },
    totalLabel: flip.alreadyEnough ? 'YOU CAN COVER IT' : 'PAY RISE NEEDED',
    totalValue: flip.alreadyEnough ? `${gap} to spare` : `${gap}/yr`,
  }
}

/** The "flip it" salary panel shown under the result breakdown. */
export function SalaryFlip({ requiredTakeHomeMonthly, current, accentColor, year = CURRENT_TAX_YEAR }: SalaryFlipProps) {
  const flip = salaryFlip(requiredTakeHomeMonthly, current, year)
  const requiredGross = roundSalary(flip.requiredGross)
  const { subheadline, currentRow, totalLabel, totalValue } = wordingFor(flip, current)

  const medianLine =
    flip.vsMedian === 'about'
      ? `Around the UK median full-time salary of ${fmt(flip.medianFullTimeSalary)}.`
      : `That's ${flip.vsMedian} the UK median full-time salary of ${fmt(flip.medianFullTimeSalary)}.`

  return (
    <div style={{ background: 'var(--tile-bg)', borderRadius: 'var(--radius-glass-sm)', padding: '14px 15px 12px', marginBottom: 12 }}>
      <div
        style={{
          fontSize: 'var(--fs-label)',
          fontWeight: 800,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--text-secondary-dim)',
          marginBottom: 8,
        }}
      >
        Flip it — what salary would this take?
      </div>

      <div
        className="mono"
        style={{
          fontSize: 'var(--fs-input-md)',
          fontWeight: 800,
          letterSpacing: '-0.01em',
          fontVariantNumeric: 'tabular-nums',
          color: accentColor,
          marginBottom: 4,
        }}
      >
        {fmt(requiredGross)}/yr
      </div>
      <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', margin: '0 0 12px', fontWeight: 500 }}>{subheadline}</p>

      <BreakdownBox>
        <BreakdownRow label="TAKE-HOME NEEDED" value={`${fmt(Math.round(requiredTakeHomeMonthly))}/mo`} />
        <BreakdownRow label="SALARY NEEDED" value={`${fmt(requiredGross)}/yr`} />
        {currentRow && <BreakdownRow label={currentRow.label} value={currentRow.value} />}
        <TotalRow label={totalLabel} value={totalValue} />
      </BreakdownBox>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 5,
          fontSize: 'var(--fs-helper)',
          color: 'var(--text-tertiary)',
          fontWeight: 600,
          lineHeight: 1.45,
        }}
      >
        <span>{medianLine}</span>
        {currentRow === null && (
          <span>
            More than one salary gives the take-home you entered, so we can&rsquo;t estimate yours. Switch to &ldquo;Annual salary&rdquo; on
            the Budget step to compare.
          </span>
        )}
        {flip.inTaperBand && (
          <span>
            This lands in the £100k “tax trap”, where the personal allowance tapers away — every extra £1 of take-home here needs about £
            {flip.salaryPerTakeHome.toFixed(2)} of salary.
          </span>
        )}
        <span style={{ color: 'var(--text-tertiary-dim)' }}>
          Estimate for England, Wales &amp; NI, {year.label} — single PAYE salary, no student loan or pension.
        </span>
        <a
          href="/methodology/salary/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--text-secondary)', textDecoration: 'underline', fontWeight: 600 }}
        >
          See how this is worked out →
        </a>
      </div>
    </div>
  )
}
