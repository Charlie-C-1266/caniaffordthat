import { Tile } from '../Tile'
import { VerdictBanner } from './VerdictBanner'
import { ResultHeadline } from './ResultHeadline'
import { ResultChart } from './ResultChart'
import { BreakdownBox } from './BreakdownBox'
import { BreakdownRow } from './BreakdownRow'
import { TotalRow } from './TotalRow'
import { ResultActions } from './ResultActions'
import { useCalculator } from '../../state/calculatorContext'
import { fmt } from '../../lib/calculations'
import { accentColorFor } from '../../lib/mode'
import { financeRowLabel } from '../../lib/vehicle'
import type { VehicleResult } from '../../lib/vehicle'

interface VehicleResultCardProps {
  result: VehicleResult
  scrollToIndex: (index: number) => void
}

/**
 * The vehicle flow's result: the verdict on the *total* monthly cost, an
 * itemised monthly-costs box (finance payment + fuel, maintenance, insurance,
 * tax), the shape of the deal itself (deposit, amount financed, any balloon,
 * total payable), and the caveats — including the depreciation-curve caveat
 * whenever the balloon is our estimate rather than a lender's quote.
 */
export function VehicleResultCard({ result, scrollToIndex }: VehicleResultCardProps) {
  const { state } = useCalculator()
  const accent = accentColorFor(state.mode)
  const affordable = result.isAffordable
  // As on the standard card: on a "No" only the banner carries colour.
  const eyebrowColor = affordable ? accent : 'var(--text-tertiary)'
  const currentBarColor = affordable ? accent : 'var(--text-secondary-mid)'
  const carLabel = state.itemName || 'Vehicle'
  const isCash = result.method === 'cash'

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

        <ResultChart
          projection={result.projection}
          budget={result.budget}
          chartTitle="Balance repaid over time"
          accentColor={currentBarColor}
          newCostLabel="Total car cost"
          months={result.termMonths}
        />

        <BreakdownBox heading="Monthly costs">
          {!isCash && <BreakdownRow label={financeRowLabel(result.method).toUpperCase()} value={fmt(result.financeMonthly)} />}
          <BreakdownRow label="FUEL" value={fmt(result.running.fuel)} />
          <BreakdownRow label="MAINTENANCE" value={fmt(result.running.maintenance)} />
          <BreakdownRow label="INSURANCE" value={fmt(result.running.insurance)} />
          <BreakdownRow label="ROAD TAX" value={fmt(result.running.tax)} />
          <TotalRow label="TOTAL / MONTH" value={fmt(result.totalMonthly)} />
          <BreakdownRow label="YOUR SPARE CASH" value={fmt(result.spareCash)} />
        </BreakdownBox>

        <BreakdownBox heading="The deal">
          <BreakdownRow label="CAR" value={`${carLabel} — ${fmt(result.price)}`} />
          <BreakdownRow label="DEPOSIT / PART-EX" value={fmt(result.deposit)} />
          {isCash ? (
            <TotalRow label="DUE UPFRONT" value={fmt(result.upfront)} />
          ) : (
            <>
              <BreakdownRow label="AMOUNT FINANCED" value={fmt(result.principal)} />
              <BreakdownRow label="TERM" value={`${result.termMonths} months`} />
              <BreakdownRow label="APR" value={`${result.aprPct}%`} />
              {result.balloon !== null && (
                <BreakdownRow
                  label={result.balloonIsEstimate ? 'FINAL PAYMENT (EST.)' : 'FINAL PAYMENT'}
                  value={fmt(result.balloon)}
                />
              )}
              <BreakdownRow label="TOTAL INTEREST" value={fmt(result.interestPaid)} />
              <TotalRow label={result.method === 'pcp' ? 'TOTAL IF YOU KEEP IT' : 'TOTAL PAYABLE'} value={fmt(result.totalPayable)} />
            </>
          )}
        </BreakdownBox>

        {result.notes.length > 0 && (
          <div style={{ margin: '0 0 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {result.notes.map((note) => (
              <div
                key={note}
                style={{
                  fontSize: 'var(--fs-helper)',
                  color: 'var(--text-tertiary)',
                  lineHeight: 1.45,
                  paddingLeft: 12,
                  borderLeft: '2px solid var(--tile-border)',
                }}
              >
                {note}
              </div>
            ))}
          </div>
        )}

        <div style={{ marginBottom: 16, fontSize: 'var(--fs-helper)', fontWeight: 600 }}>
          <a
            href="/methodology/vehicle/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--text-secondary)', textDecoration: 'underline' }}
          >
            See exactly how these numbers are worked out →
          </a>
        </div>

        <ResultActions scrollToIndex={scrollToIndex} />
      </div>
    </Tile>
  )
}
