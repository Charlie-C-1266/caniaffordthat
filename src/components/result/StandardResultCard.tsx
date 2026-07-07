import { Tile } from '../Tile'
import { VerdictBanner } from './VerdictBanner'
import { ChartCard } from './ChartCard'
import { BreakdownRow } from './BreakdownRow'
import { ResultActions } from './ResultActions'
import { useCalculator } from '../../state/calculatorContext'
import { fmt, num } from '../../lib/calculations'
import { goalById } from '../../lib/goals'
import { accentColorFor } from '../../lib/mode'
import type { DerivedResult } from '../../lib/derive'

interface StandardResultCardProps {
  result: DerivedResult
  scrollToIndex: (index: number) => void
}

/** The verdict, headline result, chart, breakdown, and share/edit actions for every non-vehicle goal. */
export function StandardResultCard({ result, scrollToIndex }: StandardResultCardProps) {
  const { state } = useCalculator()
  const goal = goalById(state.goalId)
  const accent = accentColorFor(state.mode)
  // On a "No", drop the green/violet mode accent from the eyebrow and chart so
  // no positive-reading colour sits next to the red banner — only the banner
  // carries the verdict.
  const affordable = result.isAffordable
  const eyebrowColor = affordable ? accent : 'var(--text-tertiary)'
  const currentBarColor = affordable ? accent : 'rgba(245,243,255,0.55)'

  return (
    <Tile maxWidth={640} padding="0" style={{ overflow: 'hidden' }}>
      <VerdictBanner affordable={affordable} verdictText={result.verdictText} verdictSub={result.verdictSub} />

      <div style={{ padding: '26px 30px 30px' }}>
        <div
          style={{
            fontSize: 'var(--fs-label)',
            fontWeight: 800,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: eyebrowColor,
            marginBottom: 8,
          }}
        >
          {result.resultEyebrow}
        </div>
        <h1
          className="mono"
          style={{
            fontSize: 'var(--fs-result-headline)',
            lineHeight: 1.08,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            margin: '0 0 6px',
            fontVariantNumeric: 'tabular-nums',
            color: 'var(--text-primary)',
          }}
        >
          {result.headline}
        </h1>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', margin: '0 0 16px', maxWidth: '54ch', fontWeight: 500 }}>
          {result.subheadline}
        </p>

        {result.isFeasible && result.target > 0 && (
          <ChartCard
            bars={result.chartBars}
            endLabel={result.chartEndLabel}
            hasOverflow={result.hasOverflowMonths}
            months={result.months}
            target={result.target}
            title={state.mode === 'monthly' ? 'Balance repaid over time' : 'Savings balance over time'}
            currentBarColor={currentBarColor}
          />
        )}

        <div
          className="mono"
          style={{
            background: 'var(--tile-bg)',
            borderRadius: 'var(--radius-glass-sm)',
            padding: '14px 15px',
            marginBottom: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            fontSize: 'var(--fs-label-sm)',
            fontWeight: 600,
          }}
        >
          <BreakdownRow
            label="GOAL"
            value={
              goal?.emergency
                ? `${goal.name} — ${fmt(result.grossTarget)} (${state.coverMonths} mo)`
                : `${state.itemName || goal?.name || 'Your goal'} — ${fmt(result.grossTarget)}`
            }
          />
          <BreakdownRow label="SPARE CASH" value={fmt(result.spareCash)} />
          <BreakdownRow label={result.contributionRowLabel} value={fmt(result.contribution)} />
          {result.totalCost !== undefined && <BreakdownRow label="TOTAL INTEREST" value={fmt(result.interestPaid ?? 0)} />}
          {result.totalCost !== undefined && <BreakdownRow label="TOTAL COST" value={fmt(result.totalCost)} />}
          <BreakdownRow label={goal?.emergency ? 'ALREADY SET ASIDE' : 'ALREADY SAVED'} value={fmt(num(state.savings))} />
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 9, borderTop: '1px solid rgba(245,243,255,0.12)' }}>
            <span style={{ color: 'var(--text-secondary-dim)' }}>{result.targetRowLabel}</span>
            <span style={{ color: 'var(--text-primary)' }}>{fmt(result.target)}</span>
          </div>
        </div>

        <ResultActions scrollToIndex={scrollToIndex} />
      </div>
    </Tile>
  )
}
