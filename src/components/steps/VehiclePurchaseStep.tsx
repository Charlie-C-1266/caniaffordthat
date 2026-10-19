import type { KeyboardEvent } from 'react'
import { StepPanel } from '../StepPanel'
import { RevealTile } from '../RevealTile'
import { Tile } from '../Tile'
import { Eyebrow } from '../Eyebrow'
import { InfoHint } from '../InfoHint'
import { LabeledMoneyField } from '../LabeledMoneyField'
import { LabeledUnitField } from '../LabeledUnitField'
import { SegmentedControl, type SegmentedOption } from '../SegmentedControl'
import { SliderField } from '../SliderField'
import { SummaryBox } from '../SummaryBox'
import { MethodChip } from './vehiclePurchase/MethodChip'
import { METHOD_OPTIONS } from './vehiclePurchase/methodOptions'
import { useCalculator } from '../../state/calculatorContext'
import { fmt, num } from '../../lib/calculations'
import { TERM_RANGES, UK_AVERAGE_ANNUAL_MILES, estimateBalloon, vehicleAgeAskedOnPurchase } from '../../lib/vehicle'
import { accentColorFor } from '../../lib/mode'
import type { BalloonMode, VehicleFinanceMethod } from '../../state/types'
import type { DivRefCallback } from '../../lib/refs'

interface VehiclePurchaseStepProps {
  /** Position in the active flow — drives the eyebrow number and the Enter-advance target. */
  index: number
  panelRef: DivRefCallback
  wrapperRef: DivRefCallback
  scrollToIndex: (index: number) => void
}

/**
 * The vehicle flow's "how are you buying it?" step. Cash needs nothing more;
 * the three finance methods share a term + APR pair (with method-appropriate
 * term bounds), and PCP adds the balloon — either typed from a quote or
 * estimated from the car's age and mileage via the generic depreciation
 * curve in lib/vehicle.ts.
 */
export function VehiclePurchaseStep({ index, panelRef, wrapperRef, scrollToIndex }: VehiclePurchaseStepProps) {
  const { state, setField, setFields } = useCalculator()
  const accent = accentColorFor(state.mode)
  const method = state.vehicleMethod
  const price = num(state.itemPrice)
  const deposit = Math.min(num(state.savings), price)

  // Each finance method is sold over its own realistic range of terms, so
  // switching methods pulls the current term back into the new range.
  const chooseMethod = (next: VehicleFinanceMethod) => {
    if (next === 'cash') {
      setField('vehicleMethod', next)
      return
    }
    const { min, max } = TERM_RANGES[next]
    setFields({ vehicleMethod: next, term: Math.min(max, Math.max(min, state.term)) })
  }

  const handleEnterAdvance = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') scrollToIndex(index + 1)
  }

  const balloonModeOptions: readonly SegmentedOption<BalloonMode>[] = [
    { value: 'estimate', label: 'Estimate it for me', activeBackground: accent, activeColor: 'var(--on-accent-finance)' },
    { value: 'known', label: 'I have a quote', activeBackground: accent, activeColor: 'var(--on-accent-finance)' },
  ]

  const estimatedBalloon = estimateBalloon({
    price,
    ageYears: state.vehicleAge,
    currentMileage: num(state.vehicleMileage),
    termMonths: Math.max(1, state.term),
    annualMiles: num(state.annualMiles),
  })

  return (
    <StepPanel
      index={index}
      panelRef={panelRef}
      wrapperRef={wrapperRef}
      wrapperHeightVh={170}
      panelStyle={{ background: 'var(--bg-dark-1)' }}
    >
      <RevealTile revealed={Boolean(state.revealed[index])} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        <Tile maxWidth={640} padding="40px 44px">
          <Eyebrow color={accent}>Step {index} — Paying for it</Eyebrow>
          <h2
            style={{
              fontSize: 'var(--fs-h1-sm)',
              lineHeight: 1.15,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              margin: '0 0 22px',
            }}
          >
            How are you buying it?
          </h2>

          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {METHOD_OPTIONS.map((option) => (
              <MethodChip
                key={option.value}
                option={option}
                active={method === option.value}
                accentColor={accent}
                onSelect={() => chooseMethod(option.value)}
              />
            ))}
          </div>
          <div
            style={{ fontSize: 'var(--fs-helper)', fontWeight: 500, lineHeight: 1.4, color: 'var(--text-secondary-dim)', marginBottom: 24 }}
          >
            {METHOD_OPTIONS.find((option) => option.value === method)?.blurb}
          </div>

          {method === 'cash' ? (
            <SummaryBox>
              {price > 0 ? (
                <>
                  That's <strong style={{ color: 'var(--text-primary)' }}>{fmt(price - deposit)}</strong> on the day
                  {deposit > 0 && <> after your {fmt(deposit)} deposit / part-exchange</>} — no monthly finance payments. Next up: what it
                  costs to run.
                </>
              ) : (
                <>Add the car's price in the previous step and we'll show what you'd hand over on the day.</>
              )}
            </SummaryBox>
          ) : (
            <>
              <div style={{ marginBottom: 20 }}>
                <SliderField
                  label="Term length"
                  valueLabel={`${state.term} months`}
                  min={TERM_RANGES[method].min}
                  max={TERM_RANGES[method].max}
                  step={1}
                  value={state.term}
                  accentColor={accent}
                  onChange={(value) => setField('term', value)}
                />
              </div>
              <div style={{ marginBottom: method === 'pcp' ? 26 : 0 }}>
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
              </div>

              {method === 'pcp' && (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 'var(--fs-helper)',
                      fontWeight: 600,
                      color: 'var(--text-secondary-dim)',
                      marginBottom: 10,
                    }}
                  >
                    The final payment (balloon / GMFV)
                    <InfoHint text="On a PCP the lender guarantees the car's value at the end of the deal — the GMFV. Pay it to keep the car, or hand the car back and walk away." />
                  </div>
                  <div style={{ marginBottom: 18 }}>
                    <SegmentedControl
                      size="sm"
                      options={balloonModeOptions}
                      value={state.balloonMode}
                      onChange={(value) => setField('balloonMode', value)}
                    />
                  </div>

                  {/* Not the estimate path (where this step asks the car's age) -> take the quoted figure instead. */}
                  {!vehicleAgeAskedOnPurchase(state) ? (
                    <LabeledMoneyField
                      variant="single"
                      label="Final payment from your quote"
                      accentColor={accent}
                      value={state.balloonAmount}
                      onChange={(value) => setField('balloonAmount', value)}
                      onKeyDown={handleEnterAdvance}
                    />
                  ) : (
                    <>
                      <div style={{ marginBottom: 18 }}>
                        <SliderField
                          label="How old is the car now?"
                          valueLabel={state.vehicleAge === 0 ? 'Brand new' : `${state.vehicleAge} year${state.vehicleAge === 1 ? '' : 's'}`}
                          min={0}
                          max={20}
                          step={1}
                          value={state.vehicleAge}
                          accentColor={accent}
                          onChange={(value) => setField('vehicleAge', value)}
                        />
                      </div>
                      <div style={{ maxWidth: 320, marginBottom: 18 }}>
                        <LabeledUnitField
                          label="Current mileage (leave 0 if about average)"
                          unit="miles"
                          value={state.vehicleMileage}
                          onChange={(value) => setField('vehicleMileage', value)}
                          onKeyDown={handleEnterAdvance}
                        />
                      </div>
                      <SummaryBox>
                        {price > 0 ? (
                          <>
                            We'll plan around a <strong style={{ color: 'var(--text-primary)' }}>{fmt(estimatedBalloon)}</strong> final
                            payment — estimated from a generic depreciation curve, assuming{' '}
                            {(num(state.annualMiles) > 0 ? num(state.annualMiles) : UK_AVERAGE_ANNUAL_MILES).toLocaleString('en-GB')} miles
                            a year (you can adjust that on the next step).{' '}
                            <a
                              href="/methodology/vehicle/"
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: 'var(--text-secondary)', textDecoration: 'underline' }}
                            >
                              How we estimate this
                            </a>
                          </>
                        ) : (
                          <>Add the car's price in the previous step and we'll estimate the final payment for you.</>
                        )}
                      </SummaryBox>
                    </>
                  )}
                </>
              )}
            </>
          )}

          <div style={{ marginTop: 24, fontSize: 'var(--fs-helper)', color: 'var(--text-tertiary-dim)' }}>
            ↓ Scroll on — running costs next
          </div>
        </Tile>
      </RevealTile>
    </StepPanel>
  )
}
