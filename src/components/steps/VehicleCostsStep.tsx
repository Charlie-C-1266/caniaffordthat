import type { KeyboardEvent, ReactNode } from 'react'
import { StepPanel } from '../StepPanel'
import { RevealTile } from '../RevealTile'
import { Tile } from '../Tile'
import { Eyebrow } from '../Eyebrow'
import { InfoHint } from '../InfoHint'
import { LabeledMoneyField } from '../LabeledMoneyField'
import { LabeledUnitField } from '../LabeledUnitField'
import { SliderField } from '../SliderField'
import { SummaryBox } from '../SummaryBox'
import { useCalculator } from '../../state/calculatorContext'
import { fmt, num } from '../../lib/calculations'
import {
  EXPENSIVE_CAR_PRICE_THRESHOLD,
  EXPENSIVE_CAR_SUPPLEMENT_ANNUAL,
  MAINTENANCE_PRESETS,
  STANDARD_VED_ANNUAL,
  vehicleAgeAskedOnPurchase,
  vehicleRunningCosts,
} from '../../lib/vehicle'
import { accentColorFor } from '../../lib/mode'
import type { DivRefCallback } from '../../lib/refs'

interface VehicleCostsStepProps {
  /** Position in the active flow — drives the eyebrow number and the Enter-advance target. */
  index: number
  panelRef: DivRefCallback
  wrapperRef: DivRefCallback
  scrollToIndex: (index: number) => void
}

interface PresetChipProps {
  label: string
  active: boolean
  accentColor: string
  title: string
  onClick: () => void
}

/** A one-tap suggested-amount pill for people with no idea what a car costs to maintain. */
function PresetChip({ label, active, accentColor, title, onClick }: PresetChipProps) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      onClick={onClick}
      style={{
        padding: '7px 13px',
        borderRadius: 99,
        border: `1px solid ${active ? accentColor : 'var(--input-underline)'}`,
        background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontSize: 12.5,
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  )
}

/** Uppercase section label within the costs tile, matching the budget grid's heading style. */
function SectionLabel({ children }: { children: ReactNode }) {
  return (
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
      {children}
    </div>
  )
}

/**
 * The vehicle flow's running-costs step: fuel (worked out from mileage, mpg
 * and a static-but-editable pump price, RAC-tool style), a maintenance budget
 * with rough presets, insurance and road tax — plus the car's age when the
 * purchase step didn't already ask for it, which drives the over-£40k
 * brand-new tax supplement.
 */
export function VehicleCostsStep({ index, panelRef, wrapperRef, scrollToIndex }: VehicleCostsStepProps) {
  const { state, setField } = useCalculator()
  const accent = accentColorFor(state.mode)
  const price = num(state.itemPrice)
  const costs = vehicleRunningCosts(state)

  // The PCP estimate path already asked the car's age on the purchase step —
  // don't ask twice. Every other path asks here (it drives the £40k
  // supplement below and gives brand-new buyers the right tax picture).
  const ageAlreadyAsked = vehicleAgeAskedOnPurchase(state)

  const handleEnterAdvance = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') scrollToIndex(index + 1)
  }

  const maintenanceAmount = num(state.maintenanceMonthly)

  return (
    <StepPanel
      index={index}
      panelRef={panelRef}
      wrapperRef={wrapperRef}
      wrapperHeightVh={170}
      panelStyle={{ background: 'var(--bg-dark-2)' }}
    >
      <RevealTile revealed={Boolean(state.revealed[index])} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        <Tile maxWidth={680} padding="40px 48px">
          <Eyebrow color={accent}>Step {index} — Running costs</Eyebrow>
          <h1
            style={{
              fontSize: 'var(--fs-h1-sm)',
              lineHeight: 1.15,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              margin: '0 0 24px',
            }}
          >
            What will it cost to keep on the road?
          </h1>

          <SectionLabel>Fuel</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px 18px', marginBottom: 12 }}>
            <LabeledUnitField
              label="Miles you drive / year"
              unit="miles"
              value={state.annualMiles}
              onChange={(value) => setField('annualMiles', value)}
              onKeyDown={handleEnterAdvance}
            />
            <LabeledUnitField
              label="Average fuel economy"
              unit="mpg"
              value={state.mpg}
              onChange={(value) => setField('mpg', value)}
              onKeyDown={handleEnterAdvance}
            />
            <LabeledUnitField
              label="Fuel price"
              unit="p/litre"
              value={state.fuelPencePerLitre}
              onChange={(value) => setField('fuelPencePerLitre', value)}
              onKeyDown={handleEnterAdvance}
            />
          </div>
          <div style={{ fontSize: 'var(--fs-label)', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 26 }}>
            ≈ <strong style={{ color: 'var(--text-secondary)' }}>{fmt(costs.fuel)}/month</strong> on fuel. The pump price is a
            static default — check today's on RAC Fuel Watch (see "Our sources").
          </div>

          <SectionLabel>Maintenance</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
            <div style={{ width: 200 }}>
              <LabeledMoneyField
                label="Maintenance / month"
                value={state.maintenanceMonthly}
                onChange={(value) => setField('maintenanceMonthly', value)}
                onKeyDown={handleEnterAdvance}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, paddingBottom: 2 }}>
              {MAINTENANCE_PRESETS.map((preset) => (
                <PresetChip
                  key={preset.id}
                  label={`${preset.label} £${preset.monthly}`}
                  title={preset.blurb}
                  active={maintenanceAmount === preset.monthly}
                  accentColor={accent}
                  onClick={() => setField('maintenanceMonthly', String(preset.monthly))}
                />
              ))}
            </div>
          </div>
          <div style={{ fontSize: 'var(--fs-label)', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 26 }}>
            Servicing, MOT, tyres and repairs. No idea? Pick the preset that sounds most like the car.
          </div>

          <SectionLabel>Insurance &amp; tax</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 18px', marginBottom: 12 }}>
            <LabeledMoneyField
              label="Insurance / year"
              value={state.insuranceAnnual}
              onChange={(value) => setField('insuranceAnnual', value)}
              onKeyDown={handleEnterAdvance}
            />
            <LabeledMoneyField
              label={
                <>
                  Road tax (VED) / year{' '}
                  <InfoHint
                    size={14}
                    text={`£${STANDARD_VED_ANNUAL}/year is the standard rate for most cars. Brand-new cars over £${EXPENSIVE_CAR_PRICE_THRESHOLD.toLocaleString('en-GB')} list price also pay a £${EXPENSIVE_CAR_SUPPLEMENT_ANNUAL}/year supplement in years 2–6 — we add that automatically.`}
                  />
                </>
              }
              value={state.taxAnnual}
              onChange={(value) => setField('taxAnnual', value)}
              onKeyDown={handleEnterAdvance}
            />
          </div>

          {!ageAlreadyAsked && (
            <div style={{ maxWidth: 340, marginBottom: 12 }}>
              <SliderField
                label="How old is the car?"
                valueLabel={state.vehicleAge === 0 ? 'Brand new' : `${state.vehicleAge} year${state.vehicleAge === 1 ? '' : 's'}`}
                min={0}
                max={20}
                step={1}
                value={state.vehicleAge}
                accentColor={accent}
                onChange={(value) => setField('vehicleAge', value)}
              />
            </div>
          )}

          {costs.supplementMonthly > 0 && (
            <div style={{ fontSize: 'var(--fs-label)', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 12 }}>
              Brand new and over {fmt(EXPENSIVE_CAR_PRICE_THRESHOLD)}: we've added the {fmt(EXPENSIVE_CAR_SUPPLEMENT_ANNUAL)}/year
              "expensive car" tax supplement for you.
            </div>
          )}

          <SummaryBox>
            All in, that's about <strong style={{ color: 'var(--text-primary)' }}>{fmt(costs.total)}/month</strong> to keep it
            on the road{price > 0 && costs.total > 0 && <> — before any finance payment</>}.
          </SummaryBox>

          <div style={{ marginTop: 22, fontSize: 'var(--fs-helper)', color: 'var(--text-tertiary-dim)' }}>
            Adjust anything that applies, then press Enter or scroll to continue ↓
          </div>
        </Tile>
      </RevealTile>
    </StepPanel>
  )
}
