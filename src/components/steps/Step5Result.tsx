import { useState } from 'react'
import { StepPanel } from '../StepPanel'
import { RevealTile } from '../RevealTile'
import { useCalculator } from '../../state/calculatorContext'
import { deriveResult } from '../../lib/derive'
import { fmt, num } from '../../lib/calculations'
import { copyToClipboard } from '../../lib/clipboard'
import { accentColorFor } from '../../lib/mode'
import type { ChartBar } from '../../lib/derive'
import type { DivRefCallback } from '../../lib/refs'

interface Step5ResultProps {
  panelRef: DivRefCallback
  scrollToIndex: (index: number) => void
}

const COPIED_LABEL_DURATION_MS = 2000

// Query-param keys serialized for "Copy result link" — every field that
// affects the result, so reloading the link reproduces it exactly.
const SHARE_KEYS = [
  'mode',
  'saveFlavor',
  'itemName',
  'itemPrice',
  'takeHome',
  'housing',
  'utilities',
  'groceries',
  'transport',
  'debts',
  'savings',
  'rate',
  'growth',
  'goalMonths',
  'term',
] as const

function BreakdownRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: 'var(--result-text-secondary-dim)' }}>{label}</span>
      <span style={{ color: 'var(--result-text-primary)' }}>{value}</span>
    </div>
  )
}

function ChartCard({ bars, endLabel, hasOverflow, months }: { bars: ChartBar[]; endLabel: string; hasOverflow: boolean; months: number }) {
  return (
    <div
      style={{
        background: 'var(--result-glass-bg)',
        backdropFilter: 'blur(var(--result-glass-blur))',
        borderRadius: 'var(--radius-glass-sm)',
        padding: '12px 12px 10px',
        marginBottom: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 56 }}>
        {bars.map((bar, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
            <div
              style={{
                width: '100%',
                borderRadius: '2px 2px 0 0',
                background: bar.color,
                height: `${bar.heightPct}%`,
                minHeight: 3,
              }}
            />
          </div>
        ))}
      </div>
      <div
        className="mono"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 9,
          fontSize: 'var(--fs-rail-label)',
          color: 'var(--result-text-secondary-dim)',
          textTransform: 'uppercase',
          fontWeight: 700,
        }}
      >
        <span>Now</span>
        <span>{endLabel}</span>
      </div>
      {hasOverflow && (
        <div style={{ marginTop: 8, fontSize: 'var(--fs-label)', color: 'var(--result-text-secondary-dim)', fontWeight: 600 }}>
          Chart capped at 24 months — full term is {months} months.
        </div>
      )}
    </div>
  )
}

/** Step 5 — the verdict, headline result, chart, breakdown, and share/edit actions. */
export function Step5Result({ panelRef, scrollToIndex }: Step5ResultProps) {
  const { state } = useCalculator()
  const [copied, setCopied] = useState(false)
  const accent = accentColorFor(state.mode)
  const result = deriveResult(state)
  // The background communicates the verdict once there is one — green for
  // affordable, red for not — falling back to the mode's own accent while
  // there's nothing to verdict on yet (price/take-home still unfilled).
  const panelBackground = result
    ? result.isAffordable
      ? 'var(--verdict-affordable)'
      : 'var(--verdict-not-affordable)'
    : accent

  const copyLink = async () => {
    const params = new URLSearchParams()
    for (const key of SHARE_KEYS) params.set(key, String(state[key]))
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`
    const succeeded = await copyToClipboard(url)
    if (succeeded) {
      setCopied(true)
      setTimeout(() => setCopied(false), COPIED_LABEL_DURATION_MS)
    }
  }

  return (
    <StepPanel
      index={5}
      isFinal
      panelRef={panelRef}
      panelStyle={{ background: panelBackground, padding: '56px 40px 40px' }}
      panelTestId="result-panel"
    >
      <RevealTile revealed={Boolean(state.revealed[5])} style={{ width: '100%', maxWidth: 680 }}>
        {result ? (
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 11,
                background: 'var(--bg-dark-1)',
                borderRadius: 'var(--radius-glass)',
                padding: '9px 15px',
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: result.verdictIconBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  fontWeight: 800,
                  color: 'var(--result-text-primary)',
                  flexShrink: 0,
                }}
              >
                {result.verdictIcon}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                  {result.verdictText}
                </div>
                <div style={{ fontSize: 'var(--fs-helper-sm)', color: 'var(--text-secondary)', marginTop: 1 }}>
                  {result.verdictSub}
                </div>
              </div>
            </div>

            <div
              style={{
                fontSize: 'var(--fs-label)',
                fontWeight: 800,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'rgba(20,18,31,0.6)',
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
                color: 'var(--result-text-primary)',
              }}
            >
              {result.headline}
            </h1>
            <p style={{ fontSize: 'var(--fs-body)', color: 'var(--result-text-secondary)', margin: '0 0 14px', maxWidth: '54ch', fontWeight: 600 }}>
              {result.subheadline}
            </p>

            {result.isFeasible && (
              <ChartCard
                bars={result.chartBars}
                endLabel={result.chartEndLabel}
                hasOverflow={result.hasOverflowMonths}
                months={result.months}
              />
            )}

            <div
              className="mono"
              style={{
                background: 'var(--result-glass-bg)',
                backdropFilter: 'blur(var(--result-glass-blur))',
                borderRadius: 'var(--radius-glass-sm)',
                padding: '13px 14px',
                marginBottom: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                fontSize: 'var(--fs-label-sm)',
                fontWeight: 600,
              }}
            >
              <BreakdownRow label="ITEM" value={`${state.itemName || 'Your item'} — ${fmt(num(state.itemPrice))}`} />
              <BreakdownRow label="SPARE CASH" value={fmt(result.spareCash)} />
              <BreakdownRow label={result.contributionRowLabel} value={fmt(result.contribution)} />
              {result.totalCost !== undefined && <BreakdownRow label="TOTAL INTEREST" value={fmt(result.interestPaid ?? 0)} />}
              {result.totalCost !== undefined && <BreakdownRow label="TOTAL COST" value={fmt(result.totalCost)} />}
              <BreakdownRow label="ALREADY SAVED" value={fmt(num(state.savings))} />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingTop: 9,
                  borderTop: '1px solid rgba(20,18,31,0.16)',
                }}
              >
                <span style={{ color: 'var(--result-text-secondary-dim)' }}>{result.targetRowLabel}</span>
                <span style={{ color: 'var(--result-text-primary)' }}>{fmt(result.target)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={copyLink}
                style={{
                  flex: 1,
                  padding: 14,
                  border: '2px solid rgba(20,18,31,0.25)',
                  borderRadius: 'var(--radius-button)',
                  background: 'transparent',
                  color: 'var(--result-text-primary)',
                  fontSize: 'var(--fs-body)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {copied ? 'Link copied ✓' : 'Copy result link'}
              </button>
              <button
                type="button"
                onClick={() => {
                  scrollToIndex(1) // back to mode-select, not the welcome screen
                }}
                style={{
                  flex: 1,
                  padding: 14,
                  border: 'none',
                  borderRadius: 'var(--radius-button)',
                  background: 'var(--result-text-primary)',
                  color: panelBackground,
                  fontSize: 'var(--fs-body)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Edit my answers
              </button>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 15, color: 'rgba(20,18,31,0.65)', fontWeight: 600 }}>
            Scroll back up and fill in a price and take-home pay to see your result.
          </div>
        )}
      </RevealTile>
    </StepPanel>
  )
}
