import { useState } from 'react'
import { StepPanel } from '../StepPanel'
import { RevealTile } from '../RevealTile'
import { Tile } from '../Tile'
import { Eyebrow } from '../Eyebrow'
import { useCalculator } from '../../state/calculatorContext'
import { isoFromMonths, monthsFromIso } from '../../lib/calculations'
import { accentColorFor } from '../../lib/mode'
import type { SaveFlavor } from '../../state/types'

type DivRefCallback = (el: HTMLDivElement | null) => void

interface Step3TimeframeProps {
  panelRef: DivRefCallback
  wrapperRef: DivRefCallback
}

interface SliderFieldProps {
  label: string
  valueLabel: string
  min: number
  max: number
  step: number
  value: number
  accentColor: string
  onChange: (value: number) => void
}

function SliderField({ label, valueLabel, min, max, step, value, accentColor, onChange }: SliderFieldProps) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-body)', marginBottom: 10 }}>
        <span style={{ color: 'var(--text-secondary-dim)' }}>{label}</span>
        <span style={{ fontWeight: 700 }}>{valueLabel}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor }}
      />
    </div>
  )
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
  const [focused, setFocused] = useState(false)

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
        Goal date
      </label>
      <input
        type="month"
        value={isoFromMonths(state.goalMonths)}
        min={isoFromMonths(1)}
        onChange={(e) => setField('goalMonths', monthsFromIso(e.target.value))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '12px 14px',
          fontSize: 16,
          fontWeight: 600,
          border: `var(--border-width-card) solid ${focused ? accentColor : 'var(--input-underline)'}`,
          borderRadius: 10,
          background: 'rgba(255,255,255,0.04)',
          color: 'var(--text-primary)',
          fontFamily: 'inherit',
          outline: 'none',
        }}
      />
    </div>
  )
}

/** Step 3 — mode-dependent: saving-up timeframe (duration or goal date + interest), or finance term + APR. */
export function Step3Timeframe({ panelRef, wrapperRef }: Step3TimeframeProps) {
  const { state, setField } = useCalculator()
  const accent = accentColorFor(state.mode)
  const isSave = state.mode === 'save'
  const isDuration = isSave && state.saveFlavor === 'duration'
  const isGoal = isSave && state.saveFlavor === 'goal'

  const setFlavor = (flavor: SaveFlavor) => setField('saveFlavor', flavor)

  return (
    <StepPanel index={3} panelRef={panelRef} wrapperRef={wrapperRef} panelStyle={{ background: 'var(--bg-dark-2)' }}>
      <RevealTile revealed={Boolean(state.revealed[3])} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        <Tile maxWidth={640} padding="48px 48px">
          {isSave ? (
            <>
              <Eyebrow color={accent}>Timeframe</Eyebrow>
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
                    valueLabel={`${state.rate}%`}
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
              <Eyebrow color={accent}>Finance details</Eyebrow>
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
