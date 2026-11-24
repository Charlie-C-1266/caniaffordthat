interface BreakdownRowProps {
  label: string
  value: string
  /** The box's emphasised bottom line, set off by a rule above it. TotalRow sets this. */
  total?: boolean
  /**
   * Let the value wrap instead of holding one line. For the handful of rows
   * whose value is free text rather than a figure — the standard card's GOAL
   * and the vehicle card's CAR, which both read `<name> — £<price>` and are as
   * long as the name the user typed. See the component note below.
   */
  wrapValue?: boolean
}

/**
 * Gap between a row's label and its amount. Enough to read the two as separate
 * columns at 320px, where the longest labels (`NATIONAL INSURANCE`,
 * `POSTGRADUATE LOAN`) leave the least room. Deliberately a literal: the
 * design has no spacing scale, and the sibling values here (`paddingTop: 9`,
 * BreakdownBox's `gap: 6`) are literals too.
 */
const LABEL_VALUE_GAP = 12

/**
 * One label/value line in a mono breakdown box: a result card's, or the Budget
 * step's payslip.
 *
 * The two spans are sized asymmetrically on purpose (#297). With a plain
 * `space-between` and no `gap`, the label and the amount squeezed each other at
 * a 320px viewport — the width WCAG 1.4.10 Reflow is tested at — so they ran
 * together with no space (`POSTGRADUATE-£61.00`) and the amount overflowed the
 * box rather than the label wrapping. So:
 *
 * - the label may shrink and wrap (`minWidth: 0`), taking two lines if it must;
 * - the amount never shrinks or wraps (`flexShrink: 0`, `whiteSpace: 'nowrap'`),
 *   because a figure broken across lines or clipped is worse than a wrapped
 *   word — the payslip exists to be checked against a real one to the penny;
 * - `alignItems: 'baseline'` keeps a wrapped two-line label's first line on the
 *   same baseline as its amount.
 *
 * `wrapValue` is the exception, and it exists because two rows don't carry a
 * figure at all: the standard card's GOAL row and the vehicle card's CAR row
 * are `<name> — £<price>`, where the name is whatever the user typed. Holding
 * those to one line pushes them straight out of the card (measured at 320px: a
 * GOAL value of "2019 Volkswagen Golf 1.5 TSI Life — £14,750" ends 174px past
 * the box's right edge). They wrap, exactly as they do today. Every row whose
 * value is a figure keeps the no-wrap default.
 */
export function BreakdownRow({ label, value, total = false, wrapValue = false }: BreakdownRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: LABEL_VALUE_GAP,
        ...(total && { paddingTop: 9, borderTop: '1px solid var(--tile-border-neutral)' }),
      }}
    >
      <span style={{ color: 'var(--text-secondary-dim)', minWidth: 0 }}>{label}</span>
      <span
        style={{
          color: 'var(--text-primary)',
          textAlign: 'right',
          ...(wrapValue ? { minWidth: 0 } : { flexShrink: 0, whiteSpace: 'nowrap' }),
        }}
      >
        {value}
      </span>
    </div>
  )
}
