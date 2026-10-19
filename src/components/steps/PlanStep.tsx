import { StepPanel } from '../StepPanel'
import { RevealTile } from '../RevealTile'
import { Tile } from '../Tile'
import { Eyebrow } from '../Eyebrow'
import { SliderField } from '../SliderField'
import { DurationInput } from './plan/DurationInput'
import { GoalDateInput } from './plan/GoalDateInput'
import { ToggleButton } from './plan/ToggleButton'
import { useCalculator } from '../../state/calculatorContext'
import { accentColorFor } from '../../lib/mode'
import type { SaveFlavor } from '../../state/types'
import type { DivRefCallback } from '../../lib/refs'

interface PlanStepProps {
  /** Position in the active flow — drives the eyebrow number. */
  index: number
  panelRef: DivRefCallback
  wrapperRef: DivRefCallback
}

/** The Plan step — mode-dependent: saving-up timeframe (duration or goal date + interest), or finance term + APR. */
export function PlanStep({ index, panelRef, wrapperRef }: PlanStepProps) {
  const { state, setField } = useCalculator()
  const accent = accentColorFor(state.mode)
  const isSave = state.mode === 'save'
  const isDuration = isSave && state.saveFlavor === 'duration'
  const isGoal = isSave && state.saveFlavor === 'goal'

  const setFlavor = (flavor: SaveFlavor) => setField('saveFlavor', flavor)

  return (
    <StepPanel index={index} panelRef={panelRef} wrapperRef={wrapperRef} panelStyle={{ background: 'var(--bg-dark-2)' }}>
      <RevealTile revealed={Boolean(state.revealed[index])} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        <Tile maxWidth={640} padding="48px 48px">
          {isSave ? (
            <>
              <Eyebrow color={accent}>Step {index} — Timeframe</Eyebrow>
              <h2
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
              </h2>
              <div style={{ display: 'flex', gap: 10, marginBottom: 26 }}>
                <ToggleButton
                  label="How long will it take?"
                  active={isDuration}
                  accentColor={accent}
                  onClick={() => setFlavor('duration')}
                />
                <ToggleButton label="I have a goal date" active={isGoal} accentColor={accent} onClick={() => setFlavor('goal')} />
              </div>
              {isDuration && <DurationInput accentColor={accent} />}
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
              <Eyebrow color={accent}>Step {index} — Finance details</Eyebrow>
              <h2
                style={{
                  fontSize: 'var(--fs-h1-sm)',
                  lineHeight: 1.15,
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  margin: '0 0 30px',
                }}
              >
                Term and rate?
              </h2>
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
          <div style={{ marginTop: 26, fontSize: 'var(--fs-helper)', color: 'var(--text-tertiary-dim)' }}>↓ Scroll for your result</div>
        </Tile>
      </RevealTile>
    </StepPanel>
  )
}
