// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { cleanup, screen, fireEvent, within } from '@testing-library/react'
import { renderWithCalculator } from '../../../test/renderWithCalculator'
import { PensionFields } from './PensionFields'
import type { CalculatorState } from '../../../state/types'

// The workplace pension half of "About your pay". Nothing about the amount is
// asked until an arrangement is chosen, since no arrangement is ever assumed.

function renderFields(state: Partial<CalculatorState> = {}) {
  const onChange = vi.fn()
  renderWithCalculator(<PensionFields accentColor="#4ade80" onChange={onChange} />, state)
  return onChange
}

const arrangementGroup = () => screen.getByRole('group', { name: 'Workplace pension' })

describe('PensionFields', () => {
  afterEach(cleanup)

  it('offers no pension, salary sacrifice and net pay, but not relief at source yet', () => {
    renderFields()
    const group = arrangementGroup()
    for (const name of ['None', 'Salary sacrifice', 'Net pay']) expect(within(group).getByRole('button', { name })).toBeTruthy()
    expect(within(group).queryByRole('button', { name: 'Relief at source' })).toBeNull()
    expect(within(group).getByRole('button', { name: /Relief at source, taken after tax/ })).toBeTruthy()
  })

  it('asks nothing about the amount until an arrangement is chosen', () => {
    const onChange = renderFields()
    expect(screen.queryByRole('slider')).toBeNull()
    expect(screen.queryByRole('button', { name: '£ a month' })).toBeNull()
    fireEvent.click(within(arrangementGroup()).getByRole('button', { name: 'Net pay' }))
    expect(onChange).toHaveBeenCalledWith({ pensionArrangement: 'netpay' })
  })

  it('says what the chosen arrangement does, and takes a percentage of the whole salary', () => {
    const onChange = renderFields({ pensionArrangement: 'sacrifice' })
    expect(screen.getByText(/Your salary itself is lowered/)).toBeTruthy()
    const slider = screen.getByRole('slider', { name: 'Your contribution' })
    expect(slider.getAttribute('aria-valuetext')).toBe('5% of salary')
    expect(screen.getByText(/A percentage here is of your whole salary/).textContent).toContain('£6,240 and £50,270')
    fireEvent.change(slider, { target: { value: '7.5' } })
    expect(onChange).toHaveBeenCalledWith({ pensionPercent: 7.5 })
  })

  it('switches to a monthly amount, read as what the payslip shows', () => {
    const onChange = renderFields({ pensionArrangement: 'netpay' })
    fireEvent.click(screen.getByRole('button', { name: '£ a month' }))
    expect(onChange).toHaveBeenCalledWith({ pensionMode: 'amount' })
  })

  it('takes a monthly amount in a money field', () => {
    const onChange = renderFields({ pensionArrangement: 'netpay', pensionMode: 'amount' })
    expect(screen.queryByRole('slider')).toBeNull()
    const field = screen.getByLabelText<HTMLInputElement>('Your contribution / month')
    fireEvent.change(field, { target: { value: '150' } })
    expect(onChange).toHaveBeenCalledWith({ pensionMonthlyAmount: '150' })
  })
})
