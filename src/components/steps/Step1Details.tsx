import type { KeyboardEvent } from 'react'
import { StepPanel } from '../StepPanel'
import { RevealTile } from '../RevealTile'
import { Tile } from '../Tile'
import { Eyebrow } from '../Eyebrow'
import { Icon } from '../Icon'
import { UnderlineInput } from '../UnderlineInput'
import { MoneyInput } from '../MoneyInput'
import { SliderField } from '../SliderField'
import { useCalculator } from '../../state/calculatorContext'
import { useDebouncedAdvance } from '../../hooks/useDebouncedAdvance'
import { num, fmt } from '../../lib/calculations'
import { goalById } from '../../lib/goals'
import { accentColorFor, accentBgFor } from '../../lib/mode'
import type { Mode } from '../../state/types'
import type { DivRefCallback } from '../../lib/refs'

interface Step1DetailsProps {
  panelRef: DivRefCallback
  wrapperRef: DivRefCallback
  scrollToIndex: (index: number) => void
}

const EMERGENCY_FIELDS = ['housing', 'utilities', 'groceries', 'transport', 'debts'] as const

interface ModeToggleProps {
  mode: Mode
  onChange: (mode: Mode) => void
}

/** The "How do you plan to pay?" segmented control shown for every goal except the emergency fund. */
function ModeToggle({ mode, onChange }: ModeToggleProps) {
  const options: { value: Mode; label: string }[] = [
    { value: 'save', label: 'Save up for it' },
    { value: 'monthly', label: 'Pay monthly' },
  ]
  return (
    <div style={{ marginBottom: 30 }}>
      <div style={{ fontSize: 'var(--fs-helper)', fontWeight: 600, color: 'var(--text-secondary-dim)', marginBottom: 10 }}>
        How do you plan to pay?
      </div>
      <div
        style={{
          display: 'flex',
          gap: 5,
          padding: 5,
          borderRadius: 14,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(245,243,255,0.08)',
        }}
      >
        {options.map(({ value, label }) => {
          const active = mode === value
          return (
            <button
              key={value}
              type="button"
              onClick={() => onChange(value)}
              style={{
                flex: 1,
                padding: '11px 14px',
                borderRadius: 10,
                border: 'none',
                fontSize: 14,
                fontWeight: 700,
                fontFamily: 'inherit',
                cursor: 'pointer',
                background: active ? accentColorFor(value) : 'transparent',
                color: active
                  ? value === 'save'
                    ? 'var(--on-accent-save)'
                    : 'var(--on-accent-finance)'
                  : 'var(--text-secondary)',
                transition: 'background 0.2s ease, color 0.2s ease',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Step 1 — the per-goal tailored inputs. Standard goals capture a price (and, for cars, a deposit); the emergency fund sizes a cushion instead. */
export function Step1Details({ panelRef, wrapperRef, scrollToIndex }: Step1DetailsProps) {
  const { state, setField } = useCalculator()
  const scheduleAdvance = useDebouncedAdvance(scrollToIndex)
  const goal = goalById(state.goalId)
  const accent = accentColorFor(state.mode)

  const handlePriceChange = (value: string) => {
    setField('itemPrice', value)
    if (num(value) > 0) scheduleAdvance(1, 2)
  }

  const handlePriceKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && num(event.currentTarget.value) > 0) scrollToIndex(2)
  }

  // Editing the name after the price is valid counts as "still on this step",
  // so the pending auto-advance from the price field keeps resetting.
  const handleNameChange = (value: string) => {
    setField('itemName', value)
    if (num(state.itemPrice) > 0) scheduleAdvance(1, 2)
  }

  const essentials = EMERGENCY_FIELDS.reduce((sum, key) => sum + num(state[key]), 0)
  const emergencyTarget = state.coverMonths * essentials

  return (
    <StepPanel
      index={1}
      panelRef={panelRef}
      wrapperRef={wrapperRef}
      wrapperHeightVh={goal?.emergency ? 170 : 160}
      panelStyle={{ background: 'var(--bg-dark-2)' }}
    >
      <RevealTile revealed={Boolean(state.revealed[1])} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        <Tile maxWidth={640} padding="46px 44px">
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
                    Step 1 — {goal.tag}
                  </Eyebrow>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{goal.name}</div>
                </div>
              </div>

              {goal.allowModeToggle && <ModeToggle mode={state.mode} onChange={(mode) => setField('mode', mode)} />}

              {goal.emergency ? (
                <>
                  <h1 style={{ fontSize: 'var(--fs-input-md)', fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 8px' }}>
                    How big a cushion?
                  </h1>
                  <p style={{ margin: '0 0 26px', fontSize: 'var(--fs-body)', color: 'var(--text-secondary-dim)', lineHeight: 1.5 }}>
                    A common rule of thumb is 3–6 months of essential spending set aside.
                  </p>
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
                    {EMERGENCY_FIELDS.map((key) => (
                      <EssentialField
                        key={key}
                        label={ESSENTIAL_LABELS[key]}
                        value={state[key]}
                        onChange={(value) => setField(key, value)}
                      />
                    ))}
                  </div>
                  <div
                    style={{
                      padding: '15px 17px',
                      borderRadius: 14,
                      background: 'rgba(255,255,255,0.04)',
                      fontSize: 'var(--fs-body)',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.5,
                    }}
                  >
                    That's <strong style={{ color: 'var(--text-primary)' }}>{fmt(emergencyTarget)}</strong> — {state.coverMonths}{' '}
                    month{state.coverMonths === 1 ? '' : 's'} of your {fmt(essentials)} monthly essentials.
                  </div>
                  <div style={{ marginTop: 24, fontSize: 'var(--fs-helper)', color: 'var(--text-tertiary-dim)' }}>
                    Adjust the slider, then scroll on ↓
                  </div>
                </>
              ) : (
                <>
                  {goal.showName && (
                    <div style={{ marginBottom: 30 }}>
                      <label
                        style={{
                          display: 'block',
                          fontSize: 'var(--fs-helper)',
                          fontWeight: 600,
                          color: 'var(--text-secondary-dim)',
                          marginBottom: 8,
                        }}
                      >
                        Goal title <span style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}>· optional</span>
                      </label>
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
                      <label
                        style={{
                          display: 'block',
                          fontSize: 'var(--fs-helper)',
                          fontWeight: 600,
                          color: 'var(--text-secondary-dim)',
                          marginBottom: 8,
                        }}
                      >
                        {goal.depositLabel}
                      </label>
                      <MoneyInput
                        value={state.savings}
                        onChange={(value) => setField('savings', value)}
                        onKeyDown={handlePriceKeyDown}
                        accentColor="var(--text-primary)"
                        idleColor="var(--input-underline)"
                        fontSize="var(--fs-body-lg)"
                        fontWeight={700}
                        fontFamily="inherit"
                        borderWidth="var(--border-width-underline)"
                        prefixFontSize="var(--fs-prefix-sm)"
                        prefixTop={4}
                        paddingBottom={7}
                        paddingLeft={18}
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

const ESSENTIAL_LABELS: Record<(typeof EMERGENCY_FIELDS)[number], string> = {
  housing: 'Housing (rent/mortgage)',
  utilities: 'Utilities & bills',
  groceries: 'Groceries & everyday',
  transport: 'Transport',
  debts: 'Debt repayments',
}

function EssentialField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label
        style={{
          display: 'block',
          fontSize: 'var(--fs-label-sm)',
          fontWeight: 600,
          color: 'var(--text-secondary-dim)',
          marginBottom: 7,
        }}
      >
        {label}
      </label>
      <MoneyInput
        value={value}
        onChange={onChange}
        accentColor="var(--text-primary)"
        idleColor="var(--input-underline)"
        fontSize="var(--fs-body-lg)"
        fontWeight={700}
        fontFamily="inherit"
        borderWidth="var(--border-width-underline)"
        prefixFontSize="var(--fs-prefix-sm)"
        prefixTop={6}
        paddingBottom={7}
        paddingLeft={15}
      />
    </div>
  )
}
