import { fmt } from '../../lib/calculations'
import { salaryFlip } from '../../lib/reverse'
import { CURRENT_TAX_YEAR } from '../../lib/taxYears'
import { BreakdownBox } from './BreakdownBox'
import { BreakdownRow } from './BreakdownRow'
import { TotalRow } from './TotalRow'

// The reverse "what would I need to earn?" panel. The forward tool answers "at
// your income, can you afford it?"; this flips it to "for this, what salary
// would it take?" — the genuinely shareable output ("you'd need a £58k salary
// for this car"). Reads the plan's required take-home (computed per-mode
// upstream) and inverts UK income tax + NI to a gross salary.

interface SalaryFlipProps {
  /** Monthly take-home the plan needs to be affordable. */
  requiredTakeHomeMonthly: number
  /** The take-home the user entered, per month. */
  currentTakeHomeMonthly: number
  /** Accent used for the flipped salary figure — the mode accent on a "Yes", a neutral tone on a "No". */
  accentColor: string
}

/** Rounds a gross salary to the nearest £100 — a "you'd need about £X" figure shouldn't imply pound-precision. */
function roundSalary(n: number): number {
  return Math.round(n / 100) * 100
}

/** The "flip it" salary panel shown under the result breakdown. */
export function SalaryFlip({ requiredTakeHomeMonthly, currentTakeHomeMonthly, accentColor }: SalaryFlipProps) {
  const flip = salaryFlip(requiredTakeHomeMonthly, currentTakeHomeMonthly)
  const requiredGross = roundSalary(flip.requiredGross)
  const currentGross = roundSalary(flip.currentGross)
  const gap = roundSalary(Math.abs(flip.grossGap))

  const subheadline = flip.alreadyEnough
    ? `You already earn enough — this needs about ${fmt(requiredGross)} a year, and you're on roughly ${fmt(currentGross)}.`
    : `That's roughly a ${fmt(gap)} pay rise on your estimated ${fmt(currentGross)} — about ${fmt(
        Math.round(flip.takeHomeMonthlyGap),
      )}/month more take-home.`

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
        <BreakdownRow label="YOUR SALARY (EST.)" value={`${fmt(currentGross)}/yr`} />
        <TotalRow
          label={flip.alreadyEnough ? 'YOU CAN COVER IT' : 'PAY RISE NEEDED'}
          value={flip.alreadyEnough ? `${fmt(gap)} to spare` : `${fmt(gap)}/yr`}
        />
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
        {flip.inTaperBand && (
          <span>
            This lands in the £100k “tax trap”, where the personal allowance tapers away — every extra £1 of take-home here needs about £
            {flip.salaryPerTakeHome.toFixed(2)} of salary.
          </span>
        )}
        <span style={{ color: 'var(--text-tertiary-dim)' }}>
          Estimate for England, Wales &amp; NI, {CURRENT_TAX_YEAR.label} — single PAYE salary, no student loan or pension.
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
