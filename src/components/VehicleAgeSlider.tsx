import { SliderField } from './SliderField'
import { useCalculator } from '../state/calculatorContext'
import { VEHICLE_AGE_RANGE } from '../lib/sliderRanges'

/** "Brand new", "1 year", "5 years". */
const ageLabel = (years: number) => (years === 0 ? 'Brand new' : `${years} year${years === 1 ? '' : 's'}`)

/**
 * The car-age slider. The purchase step asks it for a PCP balloon estimate,
 * and the running-costs step asks it otherwise, for the vehicle tax. `label`
 * lets each step phrase the question for its own context.
 */
export function VehicleAgeSlider({ label, accentColor }: { label: string; accentColor: string }) {
  const { state, setField } = useCalculator()
  return (
    <SliderField
      label={label}
      valueLabel={ageLabel(state.vehicleAge)}
      {...VEHICLE_AGE_RANGE}
      value={state.vehicleAge}
      accentColor={accentColor}
      onChange={(value) => setField('vehicleAge', value)}
    />
  )
}
