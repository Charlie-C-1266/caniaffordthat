import type { CSSProperties, ReactNode } from 'react'
import { Tile } from '../Tile'
import { VerdictBanner } from './VerdictBanner'
import { ChartCard } from './ChartCard'
import { BreakdownRow } from './BreakdownRow'
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

const boxStyle: CSSProperties = {
  background: 'var(--tile-bg)',
  borderRadius: 'var(--radius-glass-sm)',
  padding: '14px 15px',
  marginBottom: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: 'var(--fs-label-sm)',
  fontWeight: 600,
}

/** A mono breakdown box with a small uppercase heading — the vehicle result has two (monthly costs and the deal), so each says which it is. */
function BreakdownBox({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <div className="mono" style={boxStyle}>
      <div
        style={{
          fontSize: 'var(--fs-rail-label)',
          fontWeight: 800,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--text-tertiary)',
          marginBottom: 2,
        }}
      >
        {heading}
      </div>
      {children}
    </div>
  )
}

/** The emphasised bottom line of a breakdown box (total monthly cost / total payable / due upfront). */
function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 9, borderTop: '1px solid rgba(245,243,255,0.12)' }}>
      <span style={{ color: 'var(--text-secondary-dim)' }}>{label}</span>
      <span style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  )
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
  const currentBarColor = affordable ? accent : 'rgba(245,243,255,0.55)'
  const carLabel = state.itemName || 'Vehicle'
  const isCash = result.method === 'cash'

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

        {result.chartBars.length > 0 && (
          <ChartCard
            bars={result.chartBars}
            endLabel={result.chartEndLabel}
            hasOverflow={result.hasOverflowMonths}
            months={result.termMonths}
            target={result.principal}
            title="Balance repaid over time"
            currentBarColor={currentBarColor}
          />
        )}

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
          <div style={{ margin: '0 0 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {result.notes.map((note) => (
              <div
                key={note}
                style={{
                  fontSize: 'var(--fs-helper)',
                  color: 'var(--text-tertiary)',
                  lineHeight: 1.45,
                  paddingLeft: 12,
                  borderLeft: '2px solid rgba(245,243,255,0.14)',
                }}
              >
                {note}
              </div>
            ))}
          </div>
        )}

        <ResultActions scrollToIndex={scrollToIndex} />
      </div>
    </Tile>
  )
}
