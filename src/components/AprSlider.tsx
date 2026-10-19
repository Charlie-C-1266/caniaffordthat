import { SliderField } from './SliderField'
import { useCalculator } from '../state/calculatorContext'
import { APR_RANGE } from '../lib/sliderRanges'

/**
 * The "Interest rate (APR)" slider, shared by the standard finance step and the
 * vehicle purchase step. It writes `growth`, which is the APR whenever the
 * flow is financing.
 */
export function AprSlider({ accentColor }: { accentColor: string }) {
  const { state, setField } = useCalculator()
  return (
    <SliderField
      label="Interest rate (APR)"
      valueLabel={`${state.growth}%`}
      {...APR_RANGE}
      value={state.growth}
      accentColor={accentColor}
      onChange={(value) => setField('growth', value)}
    />
  )
}
