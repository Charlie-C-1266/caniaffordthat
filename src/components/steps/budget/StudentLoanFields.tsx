import { ChoiceGroup } from './ChoiceGroup'
import { neutralOption } from './neutralOption'
import { TextLink } from '../../TextLink'
import { useCalculator } from '../../../state/calculatorContext'
import { fmt } from '../../../lib/calculations'
import { STUDENT_LOAN_PLANS, STUDENT_PLAN_LABELS, type PayProfileState } from '../../../lib/payProfile'
import { SOURCES } from '../../../lib/sources'
import { CURRENT_TAX_YEAR } from '../../../lib/taxYears'
import type { StudentLoanPlan } from '../../../state/types'

const PLAN_OPTIONS = [
  neutralOption<StudentLoanPlan | 'none'>('none', 'None'),
  ...STUDENT_LOAN_PLANS.map((plan) => neutralOption(plan, STUDENT_PLAN_LABELS[plan])),
]

const YES_NO = [neutralOption('no', 'No'), neutralOption('yes', 'Yes')] as const

// From GOV.UK, "Which repayment plan you're on" (SOURCES.studentLoanPlans)
// and "how much you repay" for the rule on more than one plan.
const WHICH_PLAN_HINT =
  'It depends on where you applied for funding, not where you live now. England: started before 1 September 2012, Plan 1; from then until 31 July 2023, Plan 2; on or after 1 August 2023, Plan 5. Wales: before 1 September 2012, Plan 1; after that, Plan 2. Scotland: Plan 4. Northern Ireland: Plan 1. On more than one plan? Pick the one with the lowest threshold: you make a single repayment, at 9% over the lowest.'

const pct = (rate: number) => `${Math.round(rate * 100)}%`

/** The student loan half of "About your pay": the undergraduate plan, and whether a Postgraduate Loan is repaid on top. */
export function StudentLoanFields({ onChange }: { onChange: (patch: Partial<PayProfileState>) => void }) {
  const { state } = useCalculator()
  const { threshold, rate } = CURRENT_TAX_YEAR.postgraduateLoan

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <ChoiceGroup
          label="Student loan plan"
          hint={WHICH_PLAN_HINT}
          options={PLAN_OPTIONS}
          value={state.studentPlan}
          onChange={(studentPlan) => onChange({ studentPlan })}
        />
        <div style={{ marginTop: 8, fontSize: 'var(--fs-helper)', color: 'var(--text-tertiary-dim)', fontWeight: 600 }}>
          <TextLink href={SOURCES.studentLoanPlans.url} newTab>
            Not sure? Check which plan you&rsquo;re on at GOV.UK →
          </TextLink>
        </div>
      </div>
      <ChoiceGroup
        label="Postgraduate Loan"
        hint={`Repaid on top of any plan above, at ${pct(rate)} of your pay over ${fmt(threshold)} a year.`}
        options={YES_NO}
        value={state.postgradLoan ? 'yes' : 'no'}
        onChange={(answer) => onChange({ postgradLoan: answer === 'yes' })}
      />
    </div>
  )
}
