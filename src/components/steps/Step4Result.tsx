import { useState } from 'react'
import { StepPanel } from '../StepPanel'
import { RevealTile } from '../RevealTile'
import { Tile } from '../Tile'
import { useCalculator } from '../../state/calculatorContext'
import { deriveResult } from '../../lib/derive'
import { fmt, num } from '../../lib/calculations'
import { copyToClipboard } from '../../lib/clipboard'
import { buildShareParams } from '../../lib/urlState'
import { goalById } from '../../lib/goals'
import { accentColorFor } from '../../lib/mode'
import { Icon } from '../Icon'
import type { ChartBar } from '../../lib/derive'
import type { DivRefCallback } from '../../lib/refs'

interface Step4ResultProps {
  panelRef: DivRefCallback
  scrollToIndex: (index: number) => void
}

const COPIED_LABEL_DURATION_MS = 2000
const CHART_BAR_AREA_HEIGHT = 74

function BreakdownRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: 'var(--text-secondary-dim)' }}>{label}</span>
      <span style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  )
}

/**
 * The verdict banner — the one place the affordable/not-affordable colour now
 * lives. The rest of the result sits on the same dark tile as the earlier
 * steps; this solid colour header carries the yes/no. Dark text and a dark
 * icon chip keep it readable on both the green and red fills (both clear
 * WCAG AA for dark text).
 */
function VerdictBanner({
  affordable,
  verdictColor,
  verdictText,
  verdictSub,
}: {
  affordable: boolean
  verdictColor: string
  verdictText: string
  verdictSub: string
}) {
  return (
    <div
      data-testid="verdict-banner"
      style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '18px 26px', background: verdictColor }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(20,18,31,0.9)',
        }}
      >
        <Icon name={affordable ? 'check' : 'x'} size={19} color={verdictColor} strokeWidth={3} />
      </div>
      <div>
        <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.2, color: '#14121f' }}>{verdictText}</div>
        <div style={{ fontSize: 'var(--fs-helper)', marginTop: 2, lineHeight: 1.35, color: 'rgba(20,18,31,0.8)' }}>
          {verdictSub}
        </div>
      </div>
    </div>
  )
}

interface ChartCardProps {
  bars: ChartBar[]
  endLabel: string
  hasOverflow: boolean
  months: number
  target: number
  title: string
  /** Fill for the final (most recent) bar — the mode accent when affordable, a neutral tone on a "No". */
  currentBarColor: string
}

/** Month-by-month projection toward the goal, now styled for the dark tile. */
function ChartCard({ bars, endLabel, hasOverflow, months, target, title, currentBarColor }: ChartCardProps) {
  const axisLabelStyle = {
    fontSize: 'var(--fs-rail-label)',
    color: 'var(--text-tertiary)',
    fontWeight: 700,
  } as const
  return (
    <div style={{ background: 'var(--tile-bg)', borderRadius: 'var(--radius-glass-sm)', padding: '13px 15px 11px', marginBottom: 10 }}>
      <div
        style={{
          fontSize: 'var(--fs-label)',
          fontWeight: 800,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--text-secondary-dim)',
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div
          className="mono"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: CHART_BAR_AREA_HEIGHT,
            textAlign: 'right',
            ...axisLabelStyle,
          }}
        >
          <span style={{ color: 'var(--text-secondary)' }}>{fmt(target)}</span>
          <span>£0</span>
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 3,
              height: CHART_BAR_AREA_HEIGHT,
              borderTop: '1px dashed rgba(245,243,255,0.22)',
              borderBottom: '1px solid rgba(245,243,255,0.22)',
            }}
          >
            {bars.map((bar, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
                <div
                  style={{
                    width: '100%',
                    borderRadius: '2px 2px 0 0',
                    background: i === bars.length - 1 ? currentBarColor : 'rgba(245,243,255,0.2)',
                    height: `${bar.heightPct}%`,
                    minHeight: 3,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7, textTransform: 'uppercase', ...axisLabelStyle }}>
            <span>Now</span>
            <span>{endLabel}</span>
          </div>
        </div>
      </div>
      {hasOverflow && (
        <div style={{ marginTop: 8, fontSize: 'var(--fs-label)', color: 'var(--text-tertiary)', fontWeight: 600 }}>
          Chart capped at 24 months — full term is {months} months.
        </div>
      )}
    </div>
  )
}

/** Step 4 — the verdict, headline result, chart, breakdown, and share/edit actions. */
export function Step4Result({ panelRef, scrollToIndex }: Step4ResultProps) {
  const { state } = useCalculator()
  const [copied, setCopied] = useState(false)
  const accent = accentColorFor(state.mode)
  const goal = goalById(state.goalId)
  const result = deriveResult(state)
  const verdictColor = result?.isAffordable ? 'var(--verdict-affordable)' : 'var(--verdict-not-affordable)'
  // On a "No", drop the green/violet mode accent from the eyebrow and chart so
  // no positive-reading colour sits next to the red banner — only the banner
  // carries the verdict.
  const affordable = Boolean(result?.isAffordable)
  const eyebrowColor = affordable ? accent : 'var(--text-tertiary)'
  const currentBarColor = affordable ? accent : 'rgba(245,243,255,0.55)'

  const copyLink = async () => {
    const params = buildShareParams(state)
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`
    const succeeded = await copyToClipboard(url)
    if (succeeded) {
      setCopied(true)
      setTimeout(() => setCopied(false), COPIED_LABEL_DURATION_MS)
    }
  }

  return (
    <StepPanel index={4} isFinal panelRef={panelRef} panelStyle={{ background: 'var(--bg-dark-1)', padding: '80px 40px 56px' }} panelTestId="result-panel">
      <RevealTile revealed={Boolean(state.revealed[4])} style={{ width: '100%', maxWidth: 640, display: 'flex', justifyContent: 'center' }}>
        {result ? (
          <Tile maxWidth={640} padding="0" style={{ overflow: 'hidden' }}>
            <VerdictBanner
              affordable={result.isAffordable}
              verdictColor={verdictColor}
              verdictText={result.verdictText}
              verdictSub={result.verdictSub}
            />

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

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  type="button"
                  onClick={copyLink}
                  style={{
                    flex: 1,
                    padding: 14,
                    border: '1.5px solid rgba(245,243,255,0.25)',
                    borderRadius: 'var(--radius-button)',
                    background: 'transparent',
                    color: 'var(--text-primary)',
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
                  onClick={() => scrollToIndex(0)}
                  style={{
                    flex: 1,
                    padding: 14,
                    border: 'none',
                    borderRadius: 'var(--radius-button)',
                    background: 'var(--text-primary)',
                    color: 'var(--bg-dark-1)',
                    fontSize: 'var(--fs-body)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Pick another goal
                </button>
              </div>
            </div>
          </Tile>
        ) : (
          <Tile maxWidth={640} padding="40px 44px">
            <div style={{ fontSize: 15, color: 'var(--text-secondary)', fontWeight: 500 }}>
              {goal?.emergency
                ? 'Scroll back up and add your take-home pay and monthly essentials to see your result.'
                : 'Scroll back up and fill in a price and take-home pay to see your result.'}
            </div>
          </Tile>
        )}
      </RevealTile>
    </StepPanel>
  )
}
