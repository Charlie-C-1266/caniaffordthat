import { StepPanel } from '../StepPanel'
import { RevealTile } from '../RevealTile'
import { Tile } from '../Tile'
import { Eyebrow } from '../Eyebrow'
import { MonthYearInput } from '../MonthYearInput'
import { SliderField } from '../SliderField'
import { useCalculator } from '../../state/calculatorContext'
import { accentColorFor } from '../../lib/mode'
import { spareCashOf } from '../../lib/derive'
import { fmt } from '../../lib/calculations'
import type { SaveFlavor } from '../../state/types'
import type { DivRefCallback } from '../../lib/refs'

interface Step3PlanProps {
  panelRef: DivRefCallback
  wrapperRef: DivRefCallback
}

interface ToggleButtonProps {
  label: string
  active: boolean
  accentColor: string
  onClick: () => void
}

function ToggleButton({ label, active, accentColor, onClick }: ToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: 14,
        borderRadius: 'var(--radius-button)',
        border: `var(--border-width-card) solid ${active ? accentColor : 'var(--input-underline)'}`,
        background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
        color: 'var(--text-primary)',
        fontSize: 14,
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  )
}

function GoalDateInput({ accentColor }: { accentColor: string }) {
  const { state, setField } = useCalculator()

  return (
    <div>
      <label
        style={{
          display: 'block',
          fontSize: 'var(--fs-helper)',
          fontWeight: 600,
          color: 'var(--text-secondary-dim)',
          marginBottom: 8,
        }}
      >
        Goal date (MM-YYYY)
      </label>
      <MonthYearInput
        months={state.goalMonths}
        minMonths={1}
        accentColor={accentColor}
        onChange={(months) => setField('goalMonths', months)}
      />
    </div>
  )
}

/** Step 3 — mode-dependent: saving-up timeframe (duration or goal date + interest), or finance term + APR. */
export function Step3Plan({ panelRef, wrapperRef }: Step3PlanProps) {
  const { state, setField } = useCalculator()
  const accent = accentColorFor(state.mode)
  const isSave = state.mode === 'save'
  const isDuration = isSave && state.saveFlavor === 'duration'
  const isGoal = isSave && state.saveFlavor === 'goal'

  const setFlavor = (flavor: SaveFlavor) => setField('saveFlavor', flavor)

  // What the "share of spare cash" slider works out to in £/month, shown live so
  // the percentage isn't abstract. Only meaningful once a budget's been entered.
  const spareCash = spareCashOf(state)
  const rateAmount = Math.round((spareCash * state.rate) / 100)
  const rateValueLabel = spareCash > 0 ? `${state.rate}% · ${fmt(rateAmount)}/mo` : `${state.rate}%`

  return (
    <StepPanel index={3} panelRef={panelRef} wrapperRef={wrapperRef} panelStyle={{ background: 'var(--bg-dark-2)' }}>
      <RevealTile revealed={Boolean(state.revealed[3])} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        <Tile maxWidth={640} padding="48px 48px">
          {isSave ? (
            <>
              <Eyebrow color={accent}>Step 3 — Timeframe</Eyebrow>
              <h1
                style={{
                  fontSize: 'var(--fs-h1-sm)',
                  lineHeight: 1.15,
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  margin: '0 0 26px',
                }}
              >
                How do you want
                <br />
                to plan it?
              </h1>
              <div style={{ display: 'flex', gap: 10, marginBottom: 26 }}>
                <ToggleButton
                  label="How long will it take?"
                  active={isDuration}
                  accentColor={accent}
                  onClick={() => setFlavor('duration')}
                />
                <ToggleButton
                  label="I have a goal date"
                  active={isGoal}
                  accentColor={accent}
                  onClick={() => setFlavor('goal')}
                />
              </div>
              {isDuration && (
                <div style={{ marginBottom: 22 }}>
                  <SliderField
                    label="Share of spare cash you'll save"
                    valueLabel={rateValueLabel}
                    min={1}
                    max={100}
                    step={1}
                    value={state.rate}
                    accentColor={accent}
                    onChange={(value) => setField('rate', value)}
                  />
                </div>
              )}
              {isGoal && (
                <div style={{ marginBottom: 22 }}>
                  <GoalDateInput accentColor={accent} />
                </div>
              )}
              <SliderField
                label="Expected savings interest (optional)"
                valueLabel={`${state.growth}%`}
                min={0}
                max={20}
                step={0.5}
                value={state.growth}
                accentColor={accent}
                onChange={(value) => setField('growth', value)}
              />
            </>
          ) : (
            <>
              <Eyebrow color={accent}>Step 3 — Finance details</Eyebrow>
              <h1
                style={{
                  fontSize: 'var(--fs-h1-sm)',
                  lineHeight: 1.15,
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  margin: '0 0 30px',
                }}
              >
                Term and rate?
              </h1>
              <div style={{ marginBottom: 22 }}>
                <SliderField
                  label="Term length"
                  valueLabel={`${state.term} month${state.term === 1 ? '' : 's'}`}
                  min={1}
                  max={60}
                  step={1}
                  value={state.term}
                  accentColor={accent}
                  onChange={(value) => setField('term', value)}
                />
              </div>
              <SliderField
                label="Interest rate (APR)"
                valueLabel={`${state.growth}%`}
                min={0}
                max={30}
                step={0.5}
                value={state.growth}
                accentColor={accent}
                onChange={(value) => setField('growth', value)}
              />
            </>
          )}
          <div style={{ marginTop: 26, fontSize: 'var(--fs-helper)', color: 'var(--text-tertiary-dim)' }}>
            ↓ Scroll for your result
          </div>
        </Tile>
      </RevealTile>
    </StepPanel>
  )
}
