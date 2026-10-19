import { LabeledMoneyField } from '../../LabeledMoneyField'
import { SegmentedControl, type SegmentedOption } from '../../SegmentedControl'
import { SliderField } from '../../SliderField'
import { useCalculator } from '../../../state/calculatorContext'
import { spareCashOf } from '../../../lib/budget'
import { fmt, num } from '../../../lib/calculations'
import type { RateMode } from '../../../state/types'
import { SAVE_RATE_RANGE } from '../../../lib/sliderRanges'

/**
 * The "how long will it take?" input: the user sets their monthly saving either
 * as a share of spare cash (a slider) or as a fixed £ amount they type. Both
 * resolve to the same monthly contribution in `deriveResult`.
 */
export function DurationInput({ accentColor }: { accentColor: string }) {
  const { state, setField, setFields } = useCalculator()

  const spareCash = spareCashOf(state)
  const rateAmount = Math.round((spareCash * state.rate) / 100)
  const rateValueLabel = spareCash > 0 ? `${state.rate}% · ${fmt(rateAmount)}/mo` : `${state.rate}%`

  const amount = num(state.monthlyAmount)
  const amountCaption =
    spareCash > 0 && amount > 0
      ? amount > spareCash
        ? `That's more than your ${fmt(spareCash)} spare cash a month.`
        : `${Math.round((amount / spareCash) * 100)}% of your ${fmt(spareCash)} spare cash.`
      : ''

  // Switching to "fixed amount" seeds the field with the current % equivalent
  // (once), so the handoff between the two inputs feels continuous.
  const chooseMode = (mode: RateMode) => {
    if (mode === 'amount' && num(state.monthlyAmount) === 0 && rateAmount > 0) {
      setFields({ rateMode: mode, monthlyAmount: String(rateAmount) })
    } else {
      setField('rateMode', mode)
    }
  }

  // The save accent is the active colour for both segments — unlike the pay-mode
  // toggle, this choice doesn't change the app's accent.
  const rateModeOptions: readonly SegmentedOption<RateMode>[] = [
    { value: 'percent', label: '% of spare cash', activeBackground: accentColor, activeColor: 'var(--on-accent-save)' },
    { value: 'amount', label: 'Fixed amount', activeBackground: accentColor, activeColor: 'var(--on-accent-save)' },
  ]

  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ marginBottom: 18 }}>
        <SegmentedControl size="sm" options={rateModeOptions} value={state.rateMode} onChange={chooseMode} />
      </div>

      {state.rateMode === 'amount' ? (
        <div>
          <LabeledMoneyField
            variant="single"
            label="Monthly saving"
            accentColor={accentColor}
            value={state.monthlyAmount}
            onChange={(value) => setField('monthlyAmount', value)}
          />
          {amountCaption && (
            <div style={{ marginTop: 8, fontSize: 'var(--fs-label)', color: 'var(--text-tertiary)', fontWeight: 600 }}>{amountCaption}</div>
          )}
        </div>
      ) : (
        <SliderField
          label="Share of spare cash you'll save"
          valueLabel={rateValueLabel}
          {...SAVE_RATE_RANGE}
          value={state.rate}
          accentColor={accentColor}
          onChange={(value) => setField('rate', value)}
        />
      )}
    </div>
  )
}
