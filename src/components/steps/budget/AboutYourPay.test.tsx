// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { cleanup, screen, fireEvent, within } from '@testing-library/react'
import { renderWithCalculator } from '../../../test/renderWithCalculator'
import { AboutYourPay } from './AboutYourPay'
import type { CalculatorState } from '../../../state/types'

// The optional disclosure. What it owns: staying out of the way until it's
// wanted, never hiding a setting that changes the figures, and saying what
// its settings do in each income mode.

function renderSection(state: Partial<CalculatorState> = {}, salaryMode = true) {
  const onChange = vi.fn()
  renderWithCalculator(<AboutYourPay salaryMode={salaryMode} accentColor="#4ade80" onChange={onChange} />, state)
  return onChange
}

const toggle = () => screen.getByRole('button', { name: /^About your pay/ })

describe('AboutYourPay', () => {
  afterEach(cleanup)

  it('starts closed, with its fields hidden', () => {
    renderSection()
    expect(toggle().getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('group', { name: 'Student loan plan' })).toBeNull()
  })

  it('opens and closes on the toggle, which controls the section it shows', () => {
    renderSection()
    fireEvent.click(toggle())
    expect(toggle().getAttribute('aria-expanded')).toBe('true')
    const body = document.getElementById(toggle().getAttribute('aria-controls') ?? '')
    expect(body).not.toBeNull()
    expect(within(body as HTMLElement).getByRole('group', { name: 'Student loan plan' })).toBeTruthy()
    expect(within(body as HTMLElement).getByRole('group', { name: 'Workplace pension' })).toBeTruthy()
    fireEvent.click(toggle())
    expect(toggle().getAttribute('aria-expanded')).toBe('false')
  })

  it('opens by itself when something in it is set, as from a shared link', () => {
    for (const state of [{ studentPlan: 'plan1' }, { postgradLoan: true }, { pensionArrangement: 'netpay' }] as const) {
      renderSection(state)
      expect(toggle().getAttribute('aria-expanded'), `opened by ${JSON.stringify(state)}`).toBe('true')
      cleanup()
    }
  })

  it('can still be closed while something is set', () => {
    renderSection({ studentPlan: 'plan2' })
    fireEvent.click(toggle())
    expect(toggle().getAttribute('aria-expanded')).toBe('false')
  })

  it('says how the settings are used in each income mode', () => {
    renderSection({ studentPlan: 'plan2' }, true)
    expect(screen.getByText(/they change the take-home above/)).toBeTruthy()
    cleanup()
    renderSection({ studentPlan: 'plan2' }, false)
    expect(screen.getByText(/Your take-home already has these taken off/)).toBeTruthy()
  })

  it('passes changes from its fields straight up', () => {
    const onChange = renderSection({ studentPlan: 'plan2' })
    fireEvent.click(screen.getByRole('button', { name: 'Plan 4' }))
    fireEvent.click(screen.getByRole('button', { name: 'Salary sacrifice' }))
    expect(onChange).toHaveBeenCalledWith({ studentPlan: 'plan4' })
    expect(onChange).toHaveBeenCalledWith({ pensionArrangement: 'sacrifice' })
  })
})
