import type { IconName } from '../../iconRegistry'
import type { VehicleFinanceMethod } from '../../../state/types'

/** One purchase method as the chips present it: the state value it sets, its short name, its icon, and the honest one-liner shown as body text (and as the chip's tooltip). */
export interface MethodOption {
  value: VehicleFinanceMethod
  label: string
  icon: IconName
  blurb: string
}

/** The four ways people actually buy cars in the UK, each with a one-line honest description of the trade. */
export const METHOD_OPTIONS: readonly MethodOption[] = [
  { value: 'cash', label: 'Cash', icon: 'banknote', blurb: 'Pay the full price upfront — no borrowing, no interest.' },
  { value: 'pcp', label: 'PCP', icon: 'key-round', blurb: 'Lower monthly payments, then a big optional final payment to keep the car.' },
  {
    value: 'hp',
    label: 'Hire purchase',
    icon: 'calendar-clock',
    blurb: 'Equal instalments against the car — it becomes yours after the last one.',
  },
  { value: 'loan', label: 'Bank loan', icon: 'landmark', blurb: 'Borrow the money separately and own the car from day one.' },
]
