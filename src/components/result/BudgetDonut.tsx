import { fmt } from '../../lib/calculations'
import { OUTGOING_FIELD_KEYS } from '../../lib/budget'
import { OUTGOING_SHORT_LABELS, type BudgetBreakdown } from '../../lib/budgetSplit'

// A donut of where each month's take-home pay goes once the new commitment is
// added: the essentials already being paid, the new cost being weighed up, and
// whatever's left — or, when the new cost overshoots, the slice that spills
// past spare cash, drawn in red. Answers "does this fit alongside everything
// else I pay?" at a glance, which the balance chart can't.

const SIZE = 176
const CENTER = SIZE / 2
const RADIUS = 60
const STROKE = 26
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
// A 2px surface gap between slices, so adjacent arcs read apart even when two
// neighbours are close in hue.
const GAP = 2

/** One drawn arc of the ring. */
interface Arc {
  label: string
  amount: number
  color: string
}

interface BudgetDonutProps {
  budget: BudgetBreakdown
  /** What the new-cost slice is called — "Monthly saving", "Monthly payment", "Total car cost". */
  newCostLabel: string
}

/** The colour for an essential, fixed by its canonical position so a category keeps its colour whichever others are present. */
function essentialColor(key: (typeof OUTGOING_FIELD_KEYS)[number]): string {
  const slot = Math.min(5, OUTGOING_FIELD_KEYS.indexOf(key) + 1)
  return `var(--chart-essential-${slot})`
}

/** The budget-split donut with its legend. */
export function BudgetDonut({ budget, newCostLabel }: BudgetDonutProps) {
  const { essentials, newCost, newCostWithin, newCostOver, leftover, overBudget, ringTotal, shareOfTakeHome, takeHome } =
    budget

  // Drawn arcs, in ring order: essentials, the part of the new cost that fits,
  // any overspend, then whatever's left over. The over/leftover pair is
  // mutually exclusive, so the arcs always sum to the ring total.
  const arcs: Arc[] = [
    ...essentials.map((line) => ({ label: OUTGOING_SHORT_LABELS[line.key], amount: line.amount, color: essentialColor(line.key) })),
    ...(newCostWithin > 0 ? [{ label: newCostLabel, amount: newCostWithin, color: 'var(--chart-newcost)' }] : []),
    ...(newCostOver > 0 ? [{ label: 'Over spare cash', amount: newCostOver, color: 'var(--chart-over)' }] : []),
    ...(leftover > 0 ? [{ label: 'Left over', amount: leftover, color: 'var(--chart-leftover)' }] : []),
  ]

  // Legend rows read the *full* new cost (not the fitted part), plus a distinct
  // over/leftover line — so the figures match the breakdown box below.
  const legend: Arc[] = [
    ...essentials.map((line) => ({ label: OUTGOING_SHORT_LABELS[line.key], amount: line.amount, color: essentialColor(line.key) })),
    { label: newCostLabel, amount: newCost, color: 'var(--chart-newcost)' },
    overBudget
      ? { label: 'Over spare cash', amount: newCostOver, color: 'var(--chart-over)' }
      : { label: 'Left over', amount: leftover, color: 'var(--chart-leftover)' },
  ]

  let cumulative = 0
  const sharePct = Math.round(shareOfTakeHome * 100)

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '18px 26px' }}>
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={`Donut chart of your ${fmt(takeHome)} monthly take-home pay: ${fmt(
          budget.essentialsTotal,
        )} on essentials, ${fmt(newCost)} on ${newCostLabel.toLowerCase()} (${sharePct}% of take-home), and ${
          overBudget ? `${fmt(newCostOver)} over your spare cash` : `${fmt(leftover)} left over`
        }.`}
        style={{ flexShrink: 0 }}
      >
        {arcs.map((arc, i) => {
          const len = ringTotal > 0 ? (arc.amount / ringTotal) * CIRCUMFERENCE : 0
          const drawn = Math.max(0.5, len - GAP)
          const offset = -(cumulative + GAP / 2)
          cumulative += len
          return (
            <circle
              key={i}
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              stroke={arc.color}
              strokeWidth={STROKE}
              strokeDasharray={`${drawn} ${CIRCUMFERENCE - drawn}`}
              strokeDashoffset={offset}
              transform={`rotate(-90 ${CENTER} ${CENTER})`}
            />
          )
        })}

        {/* Centre read-out: the new cost as a share of take-home pay. */}
        <text
          x={CENTER}
          y={CENTER - 4}
          textAnchor="middle"
          className="mono"
          style={{ fontSize: 30, fontWeight: 800, fill: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}
        >
          {sharePct}%
        </text>
        <text
          x={CENTER}
          y={CENTER + 16}
          textAnchor="middle"
          style={{ fontSize: 11, fontWeight: 700, fill: 'var(--text-tertiary)', letterSpacing: '0.04em' }}
        >
          of take-home
        </text>
      </svg>

      <div style={{ flex: 1, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div
          style={{
            fontSize: 'var(--fs-rail-label)',
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--text-tertiary)',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>Take-home / mo</span>
          <span className="mono" style={{ color: 'var(--text-secondary)' }}>
            {fmt(takeHome)}
          </span>
        </div>
        {legend.map((row, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 'var(--fs-label-sm)' }}>
            <span
              aria-hidden="true"
              style={{ width: 12, height: 12, borderRadius: 3, background: row.color, flexShrink: 0 }}
            />
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{row.label}</span>
            <span className="mono" style={{ marginLeft: 'auto', color: 'var(--text-primary)', fontWeight: 600 }}>
              {fmt(row.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
