// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { cleanup, screen, fireEvent, within } from '@testing-library/react'
import { renderWithCalculator } from '../../../test/renderWithCalculator'
import { StudentLoanFields } from './StudentLoanFields'
import { SOURCES } from '../../../lib/sources'
import type { CalculatorState } from '../../../state/types'

// The student loan half of "About your pay". It reads the current choice from
// state and reports changes as patches; the Budget step applies them, so the
// take-home sync is tested there.

function renderFields(state: Partial<CalculatorState> = {}) {
  const onChange = vi.fn()
  renderWithCalculator(<StudentLoanFields onChange={onChange} />, state)
  return onChange
}

const planGroup = () => screen.getByRole('group', { name: 'Student loan plan' })
const postgradGroup = () => screen.getByRole('group', { name: 'Postgraduate Loan' })

describe('StudentLoanFields', () => {
  afterEach(cleanup)

  it('offers no plan and each of the four plans', () => {
    renderFields()
    const labels = within(planGroup())
      .getAllByRole('button')
      .map((button) => button.textContent)
      .filter((text) => text?.startsWith('None') || text?.startsWith('Plan'))
    expect(labels).toEqual(['None', 'Plan 1', 'Plan 2', 'Plan 4', 'Plan 5'])
  })

  it('shows the plan in state as chosen, and reports a new one', () => {
    const onChange = renderFields({ studentPlan: 'plan2' })
    expect(within(planGroup()).getByRole('button', { name: 'Plan 2' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(within(planGroup()).getByRole('button', { name: 'Plan 5' }))
    expect(onChange).toHaveBeenCalledWith({ studentPlan: 'plan5' })
  })

  it('explains which plan applies, and links to GOV.UK to check', () => {
    renderFields()
    expect(within(planGroup()).getByRole('button', { name: /where you applied for funding/ })).toBeTruthy()
    const link = screen.getByRole('link', { name: /Check which plan you/ })
    expect(link.getAttribute('href')).toBe(SOURCES.studentLoanPlans.url)
    expect(link.getAttribute('target')).toBe('_blank')
  })

  it('asks about a Postgraduate Loan as a yes or no, with its rate and threshold from the table', () => {
    const onChange = renderFields()
    expect(within(postgradGroup()).getByRole('button', { name: 'No' }).getAttribute('aria-pressed')).toBe('true')
    expect(within(postgradGroup()).getByRole('button', { name: /6% of your pay over £21,000/ })).toBeTruthy()
    fireEvent.click(within(postgradGroup()).getByRole('button', { name: 'Yes' }))
    expect(onChange).toHaveBeenCalledWith({ postgradLoan: true })
  })

  it('reports turning a Postgraduate Loan back off', () => {
    const onChange = renderFields({ postgradLoan: true })
    expect(within(postgradGroup()).getByRole('button', { name: 'Yes' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(within(postgradGroup()).getByRole('button', { name: 'No' }))
    expect(onChange).toHaveBeenCalledWith({ postgradLoan: false })
  })
})
