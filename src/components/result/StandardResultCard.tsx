import { Tile } from '../Tile'
import { VerdictBanner } from './VerdictBanner'
import { ResultHeadline } from './ResultHeadline'
import { ChartCard } from './ChartCard'
import { BreakdownBox } from './BreakdownBox'
import { BreakdownRow } from './BreakdownRow'
import { TotalRow } from './TotalRow'
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
  const currentBarColor = affordable ? accent : 'var(--text-secondary-mid)'

  return (
    <Tile maxWidth={640} padding="0" style={{ overflow: 'hidden' }}>
      <VerdictBanner affordable={affordable} verdictText={result.verdictText} verdictSub={result.verdictSub} />

      <div style={{ padding: '26px 30px 30px' }}>
        <ResultHeadline
          eyebrow={result.resultEyebrow}
          eyebrowColor={eyebrowColor}
          headline={result.headline}
          subheadline={result.subheadline}
        />

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

        <BreakdownBox>
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
          <TotalRow label={result.targetRowLabel} value={fmt(result.target)} />
        </BreakdownBox>

        <ResultActions scrollToIndex={scrollToIndex} />
      </div>
    </Tile>
  )
}
