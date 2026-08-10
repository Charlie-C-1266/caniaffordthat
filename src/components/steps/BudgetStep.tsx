import type { KeyboardEvent, ReactNode } from 'react'
import { StepPanel } from '../StepPanel'
import { RevealTile } from '../RevealTile'
import { Tile } from '../Tile'
import { Eyebrow } from '../Eyebrow'
import { FieldLabel } from '../FieldLabel'
import { InfoHint } from '../InfoHint'
import { LabeledMoneyField } from '../LabeledMoneyField'
import { MoneyInput } from '../MoneyInput'
import { SegmentedControl, type SegmentedOption } from '../SegmentedControl'
import { useCalculator } from '../../state/calculatorContext'
import { fmt, num } from '../../lib/calculations'
import { monthlyTakeHomeFromGross } from '../../lib/salary'
import { CURRENT_TAX_YEAR } from '../../lib/taxYears'
import { OUTGOING_FIELD_KEYS, OUTGOING_FIELD_LABELS, type OutgoingFieldKey } from '../../lib/budget'
import { goalById } from '../../lib/goals'
import { accentColorFor } from '../../lib/mode'
import type { DivRefCallback } from '../../lib/refs'
import type { TakeHomeMode } from '../../state/types'

/** Neutral toggle between typing take-home directly and working it out from an annual salary. */
const TAKE_HOME_MODE_OPTIONS: readonly SegmentedOption<TakeHomeMode>[] = [
  { value: 'takehome', label: 'Monthly take-home', activeBackground: 'var(--surface-selected)', activeColor: 'var(--text-primary)' },
  { value: 'salary', label: 'Annual salary', activeBackground: 'var(--surface-selected)', activeColor: 'var(--text-primary)' },
]

/** Rounds a computed take-home to whole pence, so the stored value isn't a long float. */
const roundPence = (n: number): number => Math.round(n * 100) / 100

interface BudgetStepProps {
  /** Position in the active flow — the eyebrow number and the Enter-advance target follow it. */
  index: number
  panelRef: DivRefCallback
  wrapperRef: DivRefCallback
  scrollToIndex: (index: number) => void
}

/** A field this step may render: the five shared outgoings plus "already saved". */
type BudgetFieldKey = OutgoingFieldKey | 'savings'

/**
 * The Budget step — take-home pay plus monthly outgoings. Which fields show
 * depends on the goal (see design/adr/0004-0005): the emergency fund already
 * captured its essentials in Details (so here it only needs take-home + what's
 * set aside), and the car captured its deposit in Details (so its "already
 * saved" field is hidden here). No pause-based auto-advance — with several
 * fields on screen a debounce firing mid-check-through yanks people away
 * before they've looked.
 */
export function BudgetStep({ index, panelRef, wrapperRef, scrollToIndex }: BudgetStepProps) {
  const { state, setField, setFields } = useCalculator()
  const goal = goalById(state.goalId)
  const accent = accentColorFor(state.mode)

  // Take-home entry: typed directly, or worked out from an annual salary. In
  // salary mode the tax engine computes the monthly take-home and writes it to
  // `takeHome`, so everything downstream (spare cash, the verdict, the reverse
  // flip) reads a single source of truth and needs no salary awareness.
  const salaryMode = state.takeHomeMode === 'salary'
  const monthlyTakeHome = monthlyTakeHomeFromGross(num(state.grossSalary))

  const handleSalaryChange = (value: string) => {
    setFields({ grossSalary: value, takeHome: num(value) > 0 ? String(roundPence(monthlyTakeHomeFromGross(num(value)))) : '' })
  }

  const handleTakeHomeModeChange = (mode: TakeHomeMode) => {
    // Switching to salary mode with a salary already typed syncs take-home to
    // it; otherwise just flip the toggle and leave take-home untouched.
    if (mode === 'salary' && num(state.grossSalary) > 0) {
      setFields({ takeHomeMode: 'salary', takeHome: String(roundPence(monthlyTakeHomeFromGross(num(state.grossSalary)))) })
    } else {
      setField('takeHomeMode', mode)
    }
  }

  const isEmergency = goal?.emergency === true
  // The car's savings is its Details deposit; don't ask for it twice.
  const showSavings = !goal?.deposit
  const savingsLabel = isEmergency ? 'Already set aside' : 'Already saved toward this'
  // Emergency essentials live in Details; other goals collect outgoings here.
  const outgoings: readonly OutgoingFieldKey[] = isEmergency ? [] : OUTGOING_FIELD_KEYS
  const visibleKeys: BudgetFieldKey[] = [...outgoings, ...(showSavings ? (['savings'] as const) : [])]

  // The vehicle flow already itemises this car's fuel, insurance, tax and
  // finance payment on its own steps — without a note, "Transport" here reads
  // ambiguously (does it include the car being evaluated, or not?) and risks
  // double-counting it. Relabel the field for that goal only, rather than
  // hiding it: other transport spend (public transport, a second car) still
  // belongs in spare cash.
  const outgoingLabel = (key: OutgoingFieldKey): ReactNode => {
    if (key !== 'transport' || !goal?.vehicle) return OUTGOING_FIELD_LABELS[key]
    return (
      <>
        Transport (other than this car){' '}
        <InfoHint
          size={14}
          text="This car's fuel, insurance, tax and finance payment are already counted on the previous steps — put anything else here, like public transport or another vehicle."
        />
      </>
    )
  }

  const isComplete = num(state.takeHome) > 0 && visibleKeys.every((key) => state[key] !== '')

  const handleEnterAdvance = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && isComplete) scrollToIndex(index + 1)
  }

  const savingsField = showSavings && (
    <LabeledMoneyField
      label={savingsLabel}
      value={state.savings}
      onChange={(value) => setField('savings', value)}
      onKeyDown={handleEnterAdvance}
    />
  )

  return (
    <StepPanel
      index={index}
      panelRef={panelRef}
      wrapperRef={wrapperRef}
      wrapperHeightVh={170}
      panelStyle={{ background: 'var(--bg-dark-1)' }}
    >
      <RevealTile revealed={Boolean(state.revealed[index])} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        <Tile maxWidth={680} padding="48px 48px">
          <Eyebrow color={accent} marginBottom={16}>
            Step {index} — Your budget
          </Eyebrow>
          <h1
            style={{
              fontSize: 'var(--fs-h1-budget)',
              lineHeight: 1.1,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              margin: '0 0 30px',
            }}
          >
            {isEmergency ? "What's coming in?" : "What's coming in, and going out?"}
          </h1>

          <div style={{ marginBottom: 24 }}>
            <div style={{ marginBottom: 14 }}>
              <SegmentedControl options={TAKE_HOME_MODE_OPTIONS} value={state.takeHomeMode} onChange={handleTakeHomeModeChange} size="sm" />
            </div>
            <FieldLabel>{salaryMode ? 'Annual salary (before tax)' : 'Take-home pay / month'}</FieldLabel>
            {salaryMode ? (
              <>
                <MoneyInput
                  value={state.grossSalary}
                  onChange={handleSalaryChange}
                  onKeyDown={handleEnterAdvance}
                  accentColor={accent}
                  fontSize="var(--fs-price-md)"
                  prefixFontSize="var(--fs-prefix-md)"
                  prefixTop={4}
                  paddingBottom={10}
                  paddingLeft={30}
                />
                {num(state.grossSalary) > 0 && (
                  <div style={{ marginTop: 12, fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', fontWeight: 500 }}>
                    ≈{' '}
                    <span className="mono" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                      {fmt(monthlyTakeHome)}
                    </span>
                    /month take-home after tax &amp; NI
                    <div style={{ marginTop: 5, fontSize: 'var(--fs-helper)', color: 'var(--text-tertiary-dim)', fontWeight: 600 }}>
                      England, Wales &amp; NI, {CURRENT_TAX_YEAR.label} — single PAYE salary, no student loan or pension.{' '}
                      <a
                        href="/methodology/salary/"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--text-secondary)', textDecoration: 'underline' }}
                      >
                        How this is worked out →
                      </a>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <MoneyInput
                value={state.takeHome}
                onChange={(value) => setField('takeHome', value)}
                onKeyDown={handleEnterAdvance}
                accentColor={accent}
                fontSize="var(--fs-price-md)"
                prefixFontSize="var(--fs-prefix-md)"
                prefixTop={4}
                paddingBottom={10}
                paddingLeft={30}
              />
            )}
          </div>

          {isEmergency ? (
            savingsField && <div style={{ maxWidth: 320 }}>{savingsField}</div>
          ) : (
            <>
              <div
                style={{
                  fontSize: 'var(--fs-label)',
                  fontWeight: 700,
                  color: 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 14,
                }}
              >
                Monthly outgoings (defaulted to £0 — adjust what applies to you)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 18px' }}>
                {outgoings.map((key) => (
                  <LabeledMoneyField
                    key={key}
                    label={outgoingLabel(key)}
                    value={state[key]}
                    onChange={(value) => setField(key, value)}
                    onKeyDown={handleEnterAdvance}
                  />
                ))}
                {savingsField}
              </div>
            </>
          )}

          <div style={{ marginTop: 22, fontSize: 'var(--fs-helper)', color: 'var(--text-tertiary-dim)' }}>
            Adjust anything that applies, then press Enter or scroll to continue ↓
          </div>
        </Tile>
      </RevealTile>
    </StepPanel>
  )
}
