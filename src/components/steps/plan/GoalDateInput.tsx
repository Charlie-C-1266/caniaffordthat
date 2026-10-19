import { useId } from 'react'
import { FieldLabel } from '../../FieldLabel'
import { MonthYearInput } from '../../MonthYearInput'
import { useCalculator } from '../../../state/calculatorContext'

export function GoalDateInput({ accentColor }: { accentColor: string }) {
  const { state, setField } = useCalculator()
  // Pairs the standalone FieldLabel with the masked date input, which the
  // Labeled* wrappers do for themselves.
  const inputId = useId()

  return (
    <div>
      <FieldLabel htmlFor={inputId}>Goal date (MM-YYYY)</FieldLabel>
      <MonthYearInput
        id={inputId}
        months={state.goalMonths}
        minMonths={1}
        accentColor={accentColor}
        onChange={(months) => setField('goalMonths', months)}
      />
    </div>
  )
}
