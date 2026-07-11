import type { KeyboardEvent } from 'react'
import { StepPanel } from '../StepPanel'
import { RevealTile } from '../RevealTile'
import { Tile } from '../Tile'
import { Eyebrow } from '../Eyebrow'
import { FieldLabel } from '../FieldLabel'
import { Icon } from '../Icon'
import { InfoHint } from '../InfoHint'
import { LabeledMoneyField } from '../LabeledMoneyField'
import { SegmentedControl, type SegmentedOption } from '../SegmentedControl'
import { UnderlineInput } from '../UnderlineInput'
import { MoneyInput } from '../MoneyInput'
import { SliderField } from '../SliderField'
import { SummaryBox } from '../SummaryBox'
import { useCalculator } from '../../state/calculatorContext'
import { useDebouncedAdvance } from '../../hooks/useDebouncedAdvance'
import { num, fmt } from '../../lib/calculations'
import { OUTGOING_FIELD_KEYS, OUTGOING_FIELD_LABELS } from '../../lib/budget'
import { monthlyOutgoingsOf } from '../../lib/derive'
import { goalById } from '../../lib/goals'
import { accentColorFor, accentBgFor } from '../../lib/mode'
import type { Mode } from '../../state/types'
import type { DivRefCallback } from '../../lib/refs'

interface DetailsStepProps {
  /** Position in the active flow — drives the eyebrow number and where auto-advance lands. */
  index: number
  panelRef: DivRefCallback
  wrapperRef: DivRefCallback
  scrollToIndex: (index: number) => void
}

/** Each pay mode's segment carries its own accent so the pill lights up green for saving and violet for finance. */
const MODE_OPTIONS: readonly SegmentedOption<Mode>[] = [
  { value: 'save', label: 'Save up for it', activeBackground: accentColorFor('save'), activeColor: 'var(--on-accent-save)' },
  { value: 'monthly', label: 'Pay monthly', activeBackground: accentColorFor('monthly'), activeColor: 'var(--on-accent-finance)' },
]

interface ModeToggleProps {
  mode: Mode
  onChange: (mode: Mode) => void
}

/** The "How do you plan to pay?" segmented control shown for every goal except the emergency fund. */
function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div style={{ marginBottom: 30 }}>
      <div style={{ fontSize: 'var(--fs-helper)', fontWeight: 600, color: 'var(--text-secondary-dim)', marginBottom: 10 }}>
        How do you plan to pay?
      </div>
      <SegmentedControl options={MODE_OPTIONS} value={mode} onChange={onChange} />
    </div>
  )
}

/** The Details step — the per-goal tailored inputs. Standard goals capture a price (and, for cars, a deposit); the emergency fund sizes a cushion instead. */
export function DetailsStep({ index, panelRef, wrapperRef, scrollToIndex }: DetailsStepProps) {
  const { state, setField } = useCalculator()
  const scheduleAdvance = useDebouncedAdvance(scrollToIndex)
  const goal = goalById(state.goalId)
  const accent = accentColorFor(state.mode)

  const handlePriceChange = (value: string) => {
    setField('itemPrice', value)
    if (num(value) > 0) scheduleAdvance(index, index + 1)
  }

  const handlePriceKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && num(event.currentTarget.value) > 0) scrollToIndex(index + 1)
  }

  // Editing the name after the price is valid counts as "still on this step",
  // so the pending auto-advance from the price field keeps resetting.
  const handleNameChange = (value: string) => {
    setField('itemName', value)
    if (num(state.itemPrice) > 0) scheduleAdvance(index, index + 1)
  }

  const essentials = monthlyOutgoingsOf(state)
  const emergencyTarget = state.coverMonths * essentials

  // MoneyHelper recommends 3-6 months of essential outgoings, aiming for at
  // least 3 (see design/adr/0010). Tell the user where their choice sits.
  const withinRecommendedBand = state.coverMonths >= 3 && state.coverMonths <= 6
  const coverBandText =
    state.coverMonths < 3
      ? 'Aim for at least 3 months — even a 1-month cushion is a solid start.'
      : withinRecommendedBand
        ? 'Within the recommended 3–6 months.'
        : 'More than the usual 3–6 months — a larger cushion, which is fine.'

  return (
    <StepPanel
      index={index}
      panelRef={panelRef}
      wrapperRef={wrapperRef}
      wrapperHeightVh={goal?.emergency ? 150 : 160}
      panelStyle={{ background: 'var(--bg-dark-2)' }}
    >
      <RevealTile revealed={Boolean(state.revealed[index])} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        <Tile maxWidth={640} padding={goal?.emergency ? '34px 44px' : '46px 44px'}>
          {!goal ? (
            <p style={{ fontSize: 'var(--fs-body-lg)', color: 'var(--text-secondary)' }}>
              Scroll back up and pick a goal to get started.
            </p>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 13,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: accentBgFor(state.mode),
                    color: accent,
                    flexShrink: 0,
                  }}
                >
                  <Icon name={goal.icon} size={24} />
                </div>
                <div>
                  <Eyebrow color={accent} marginBottom={2}>
                    Step {index} — {goal.tag}
                  </Eyebrow>
                  <div style={{ fontSize: 18, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {goal.emergency ? 'How big a cushion?' : goal.name}
                    {goal.emergency && (
                      <InfoHint text="A common rule of thumb is 3–6 months of essential spending set aside." />
                    )}
                  </div>
                </div>
              </div>

              {goal.allowModeToggle && <ModeToggle mode={state.mode} onChange={(mode) => setField('mode', mode)} />}

              {goal.emergency ? (
                <>
                  <div style={{ marginBottom: 24 }}>
                    <SliderField
                      label="Months of cover"
                      valueLabel={`${state.coverMonths} month${state.coverMonths === 1 ? '' : 's'}`}
                      min={1}
                      max={12}
                      step={1}
                      value={state.coverMonths}
                      accentColor={accent}
                      onChange={(value) => setField('coverMonths', value)}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: 'var(--fs-label)',
                      fontWeight: 700,
                      color: 'var(--text-tertiary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      marginBottom: 12,
                    }}
                  >
                    Your monthly essentials (defaulted to £0 — adjust what applies)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 18px', marginBottom: 20 }}>
                    {OUTGOING_FIELD_KEYS.map((key) => (
                      <LabeledMoneyField
                        key={key}
                        label={OUTGOING_FIELD_LABELS[key]}
                        value={state[key]}
                        onChange={(value) => setField(key, value)}
                      />
                    ))}
                  </div>
                  <SummaryBox>
                    That's <strong style={{ color: 'var(--text-primary)' }}>{fmt(emergencyTarget)}</strong> — {state.coverMonths}{' '}
                    month{state.coverMonths === 1 ? '' : 's'} of your {fmt(essentials)} monthly essentials.
                    <div
                      style={{
                        marginTop: 10,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 'var(--fs-label)',
                        fontWeight: 600,
                        color: withinRecommendedBand ? accent : 'var(--text-tertiary)',
                      }}
                    >
                      {withinRecommendedBand && <Icon name="check" size={14} color={accent} strokeWidth={2.5} />}
                      {coverBandText}
                    </div>
                  </SummaryBox>
                </>
              ) : (
                <>
                  {goal.showName && (
                    <div style={{ marginBottom: 30 }}>
                      <FieldLabel>
                        Goal title <span style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}>· optional</span>
                      </FieldLabel>
                      <UnderlineInput
                        value={state.itemName}
                        onChange={handleNameChange}
                        placeholder={goal.namePlaceholder}
                        fontSize="var(--fs-input-sm)"
                        accentColor={accent}
                      />
                    </div>
                  )}
                  <h1 style={{ fontSize: 'var(--fs-input-md)', fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 20px' }}>
                    {goal.priceHeadline}
                  </h1>
                  <MoneyInput
                    value={state.itemPrice}
                    onChange={handlePriceChange}
                    onKeyDown={handlePriceKeyDown}
                    accentColor={accent}
                    fontSize="var(--fs-price)"
                    prefixFontSize="var(--fs-prefix-lg)"
                    prefixTop={6}
                    paddingBottom={14}
                    paddingLeft={38}
                  />
                  {goal.deposit && (
                    <div style={{ marginTop: 30 }}>
                      <LabeledMoneyField
                        variant="single"
                        label={goal.depositLabel}
                        value={state.savings}
                        onChange={(value) => setField('savings', value)}
                        onKeyDown={handlePriceKeyDown}
                      />
                    </div>
                  )}
                  <div style={{ marginTop: 26, fontSize: 'var(--fs-helper)', color: 'var(--text-tertiary-dim)' }}>
                    Press Enter, or just pause — we'll move on ↓
                  </div>
                </>
              )}
            </>
          )}
        </Tile>
      </RevealTile>
    </StepPanel>
  )
}
