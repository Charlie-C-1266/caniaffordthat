import { ChoiceGroup } from './ChoiceGroup'
import { neutralOption } from './neutralOption'
import { LabeledMoneyField } from '../../LabeledMoneyField'
import { SegmentedControl } from '../../SegmentedControl'
import { SliderField } from '../../SliderField'
import { useCalculator } from '../../../state/calculatorContext'
import { fmt } from '../../../lib/calculations'
import {
  OFFERED_PENSION_ARRANGEMENTS,
  PENSION_ARRANGEMENT_BLURBS,
  PENSION_ARRANGEMENT_LABELS,
  type PayProfileState,
} from '../../../lib/payProfile'
import { PENSION_PERCENT_RANGE } from '../../../lib/sliderRanges'
import { CURRENT_TAX_YEAR } from '../../../lib/taxYears'
import type { PensionArrangement, RateMode } from '../../../state/types'

const ARRANGEMENT_OPTIONS = [
  neutralOption<PensionArrangement | 'none'>('none', 'None'),
  ...OFFERED_PENSION_ARRANGEMENTS.map((arrangement) => neutralOption(arrangement, PENSION_ARRANGEMENT_LABELS[arrangement])),
]

const MODE_OPTIONS = [neutralOption<RateMode>('percent', '% of salary'), neutralOption<RateMode>('amount', '£ a month')]

// From GOV.UK, "Workplace pensions: managing your pension"
// (SOURCES.pensionArrangements). The last sentence is the engine's own
// result: given the same percentage, net pay and relief at source leave the
// same take-home whenever all the pay involved is taxed at the basic rate. It
// does not hold for a £ amount, which under relief at source is already the
// after-relief figure.
const WHICH_TYPE_HINT =
  "Check with your employer or pension provider. Salary sacrifice lowers your salary itself. Net pay comes out of your pay before income tax. Relief at source, taken after tax with your provider adding 20%, isn't offered here yet: if that's yours and you only pay basic-rate tax, choose Net pay and enter the percentage your scheme quotes, and the take-home comes out the same."

const LABEL_STYLE = { fontSize: 'var(--fs-helper)', color: 'var(--text-tertiary-dim)', fontWeight: 600, lineHeight: 1.45 } as const

/** The workplace pension half of "About your pay": how it is paid, then how much, as a percentage or a monthly amount. */
export function PensionFields({ accentColor, onChange }: { accentColor: string; onChange: (patch: Partial<PayProfileState>) => void }) {
  const { state } = useCalculator()
  const { lower, upper } = CURRENT_TAX_YEAR.qualifyingEarnings
  const arrangement = state.pensionArrangement

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <ChoiceGroup
        label="Workplace pension"
        hint={WHICH_TYPE_HINT}
        options={ARRANGEMENT_OPTIONS}
        value={arrangement}
        onChange={(pensionArrangement) => onChange({ pensionArrangement })}
      />
      {arrangement !== 'none' && (
        <>
          <div style={LABEL_STYLE}>{PENSION_ARRANGEMENT_BLURBS[arrangement]}</div>
          <SegmentedControl
            size="sm"
            options={MODE_OPTIONS}
            value={state.pensionMode}
            onChange={(pensionMode) => onChange({ pensionMode })}
          />
          {state.pensionMode === 'percent' ? (
            <div>
              <SliderField
                label="Your contribution"
                valueLabel={`${state.pensionPercent}% of salary`}
                {...PENSION_PERCENT_RANGE}
                value={state.pensionPercent}
                accentColor={accentColor}
                onChange={(pensionPercent) => onChange({ pensionPercent })}
              />
              <div style={{ ...LABEL_STYLE, marginTop: 8 }}>
                A percentage here is of your whole salary. Auto-enrolment minimums are often worked out on pay between {fmt(lower)} and{' '}
                {fmt(upper)} instead &mdash; if that&rsquo;s your scheme, choose &ldquo;£ a month&rdquo; and enter the amount from your
                payslip.
              </div>
            </div>
          ) : (
            <LabeledMoneyField
              variant="single"
              label="Your contribution / month"
              hint="The amount taken from your pay each month, as it shows on your payslip."
              accentColor={accentColor}
              value={state.pensionMonthlyAmount}
              onChange={(pensionMonthlyAmount) => onChange({ pensionMonthlyAmount })}
            />
          )}
        </>
      )}
    </div>
  )
}
