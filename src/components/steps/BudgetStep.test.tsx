// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { BudgetStep } from './BudgetStep'
import { CalculatorProvider } from '../../state/CalculatorProvider'
import { useCalculator, type CalculatorContextValue } from '../../state/calculatorContext'
import { monthlyTakeHomeFromGross } from '../../lib/salary'
import { OUTGOING_FIELD_LABELS } from '../../lib/budget'
import type { CalculatorState, GoalId } from '../../state/types'

// Two pieces of real logic live in this step beyond form rendering: the
// salary -> take-home sync (typing a salary writes both fields; clearing it
// must clear the derived one rather than leave a stale figure), and the
// goal-driven show/hide/relabel of the outgoing fields, which also decides
// what `isComplete` gates Enter-to-advance on. Neither had any coverage.
//
// Expected take-home figures are computed with the same engine the step uses
// rather than hard-coded, so a tax-table change updates both together.

const STEP_INDEX = 4
const noop = () => {}

const SALARY_MODE_LABEL = 'Annual salary'
const TAKE_HOME_MODE_LABEL = 'Monthly take-home'
const SAVINGS_LABEL = 'Already saved toward this'
const SET_ASIDE_LABEL = 'Already set aside'
const VEHICLE_TRANSPORT_LABEL = 'Transport (other than this car)'

/** Mirrors the step's own roundPence, so the expectation is the value it should store. */
const expectedTakeHome = (grossAnnual: number) => String(Math.round(monthlyTakeHomeFromGross(grossAnnual) * 100) / 100)

let calculator: CalculatorContextValue | null = null

/** Exposes the provider's context so a test can seed state and read back what the step wrote. */
function CaptureContext() {
  calculator = useCalculator()
  return null
}

function renderBudgetStep(state: Partial<CalculatorState> = {}) {
  render(
    <CalculatorProvider>
      <CaptureContext />
      <BudgetStep index={STEP_INDEX} panelRef={noop} wrapperRef={noop} scrollToIndex={noop} />
    </CalculatorProvider>,
  )
  act(() => calculator?.setFields(state))
}

/** Renders the step for a goal, with a price so it looks like a real run-through. */
const renderForGoal = (goalId: GoalId, state: Partial<CalculatorState> = {}) =>
  renderBudgetStep({ goalId, itemPrice: '18000', takeHome: '2600', ...state })

/**
 * The money input belonging to a field label. FieldLabel renders a bare
 * `<label>` with no `htmlFor`, so there's no accessible name to query by —
 * the input is found through the wrapper the two share instead.
 */
function fieldInput(labelText: string): HTMLInputElement {
  const [label] = screen.getAllByText((_, element) => element?.tagName === 'LABEL' && (element.textContent ?? '').startsWith(labelText))
  const input = label?.parentElement?.querySelector('input')
  if (!input) throw new Error(`No input found for field labelled "${labelText}"`)
  return input
}

const hasField = (labelText: string) =>
  screen.queryAllByText((_, element) => element?.tagName === 'LABEL' && (element.textContent ?? '').startsWith(labelText)).length > 0

const modeButton = (label: string) => screen.getByRole('button', { name: label })

describe('BudgetStep', () => {
  afterEach(() => {
    cleanup()
    calculator = null
  })

  describe('the salary to take-home sync', () => {
    it('writes the rounded monthly take-home alongside the salary typed', () => {
      renderBudgetStep({ goalId: 'holiday', takeHomeMode: 'salary' })

      fireEvent.change(fieldInput('Annual salary (before tax)'), { target: { value: '60000' } })

      expect(calculator?.state.grossSalary).toBe('60000')
      expect(calculator?.state.takeHome).toBe(expectedTakeHome(60000))
      // Sanity-check the figure is a real one, not an artefact of both sides
      // calling the same broken helper.
      expect(Number(calculator?.state.takeHome)).toBeGreaterThan(3000)
      expect(Number(calculator?.state.takeHome)).toBeLessThan(4000)
    })

    it('keeps the two in step as the salary is edited', () => {
      renderBudgetStep({ goalId: 'holiday', takeHomeMode: 'salary' })
      const input = fieldInput('Annual salary (before tax)')

      fireEvent.change(input, { target: { value: '60000' } })
      fireEvent.change(input, { target: { value: '35000' } })

      expect(calculator?.state.takeHome).toBe(expectedTakeHome(35000))
    })

    it('clears take-home rather than leaving a stale figure when the salary is emptied', () => {
      renderBudgetStep({ goalId: 'holiday', takeHomeMode: 'salary' })
      const input = fieldInput('Annual salary (before tax)')

      fireEvent.change(input, { target: { value: '60000' } })
      fireEvent.change(input, { target: { value: '' } })

      expect(calculator?.state.grossSalary).toBe('')
      expect(calculator?.state.takeHome).toBe('')
    })
  })

  describe('switching take-home entry mode', () => {
    it('re-syncs take-home from a salary already typed', () => {
      // A salary typed earlier, then a detour through take-home mode: coming
      // back must restore the derived figure, not whatever was typed over it.
      renderBudgetStep({ goalId: 'holiday', takeHomeMode: 'takehome', grossSalary: '45000', takeHome: '1200' })

      fireEvent.click(modeButton(SALARY_MODE_LABEL))

      expect(calculator?.state.takeHomeMode).toBe('salary')
      expect(calculator?.state.takeHome).toBe(expectedTakeHome(45000))
    })

    it('leaves a typed take-home alone when there is no salary to sync from', () => {
      renderBudgetStep({ goalId: 'holiday', takeHomeMode: 'takehome', grossSalary: '', takeHome: '1800' })

      fireEvent.click(modeButton(SALARY_MODE_LABEL))

      expect(calculator?.state.takeHomeMode).toBe('salary')
      expect(calculator?.state.takeHome).toBe('1800')
    })

    it('leaves take-home alone when switching back the other way', () => {
      renderBudgetStep({ goalId: 'holiday', takeHomeMode: 'salary', grossSalary: '45000', takeHome: '2500' })

      fireEvent.click(modeButton(TAKE_HOME_MODE_LABEL))

      expect(calculator?.state.takeHomeMode).toBe('takehome')
      expect(calculator?.state.takeHome).toBe('2500')
    })
  })

  describe('which fields the goal asks for', () => {
    it('asks an ordinary goal for all five outgoings and what it has already saved', () => {
      renderForGoal('holiday')

      for (const label of Object.values(OUTGOING_FIELD_LABELS)) expect(hasField(label)).toBe(true)
      expect(hasField(SAVINGS_LABEL)).toBe(true)
      expect(hasField(SET_ASIDE_LABEL)).toBe(false)
    })

    it('asks the emergency fund for nothing but what it has set aside', () => {
      // Its essentials were collected in DetailsStep; asking again here would
      // double-count them.
      renderForGoal('emergency')

      for (const label of Object.values(OUTGOING_FIELD_LABELS)) expect(hasField(label)).toBe(false)
      expect(hasField(SET_ASIDE_LABEL)).toBe(true)
      expect(hasField(SAVINGS_LABEL)).toBe(false)
    })

    it('does not ask a vehicle goal for savings, which its Details deposit already captured', () => {
      renderForGoal('car')

      expect(hasField(SAVINGS_LABEL)).toBe(false)
      expect(hasField(SET_ASIDE_LABEL)).toBe(false)
      // The outgoings themselves are still asked for.
      expect(hasField(OUTGOING_FIELD_LABELS.housing)).toBe(true)
    })

    it('qualifies the Transport field for a vehicle goal, and only for one', () => {
      renderForGoal('car')

      expect(hasField(VEHICLE_TRANSPORT_LABEL)).toBe(true)
      expect(screen.getByRole('button', { name: /already counted on the previous steps/ })).toBeTruthy()

      cleanup()
      renderForGoal('holiday')

      expect(hasField(VEHICLE_TRANSPORT_LABEL)).toBe(false)
      expect(hasField(OUTGOING_FIELD_LABELS.transport)).toBe(true)
    })

    it('writes each outgoing to its own field', () => {
      renderForGoal('holiday')

      fireEvent.change(fieldInput(OUTGOING_FIELD_LABELS.housing), { target: { value: '900' } })
      fireEvent.change(fieldInput(OUTGOING_FIELD_LABELS.groceries), { target: { value: '320' } })

      expect(calculator?.state.housing).toBe('900')
      expect(calculator?.state.groceries).toBe('320')
      expect(calculator?.state.utilities).toBe('0')
    })
  })

  describe('Enter to advance', () => {
    it('is gated on the fields the goal actually shows', () => {
      // An emergency fund shows no outgoings, so a blank one must not hold it
      // back — only take-home and what it has set aside count.
      const advanced: number[] = []
      render(
        <CalculatorProvider>
          <CaptureContext />
          <BudgetStep index={STEP_INDEX} panelRef={noop} wrapperRef={noop} scrollToIndex={(i) => advanced.push(i)} />
        </CalculatorProvider>,
      )
      act(() => calculator?.setFields({ goalId: 'emergency', takeHome: '2600', housing: '', savings: '500' }))

      fireEvent.keyDown(fieldInput(SET_ASIDE_LABEL), { key: 'Enter' })

      expect(advanced).toEqual([STEP_INDEX + 1])
    })

    it('holds back while a visible field is still blank', () => {
      const advanced: number[] = []
      render(
        <CalculatorProvider>
          <CaptureContext />
          <BudgetStep index={STEP_INDEX} panelRef={noop} wrapperRef={noop} scrollToIndex={(i) => advanced.push(i)} />
        </CalculatorProvider>,
      )
      act(() => calculator?.setFields({ goalId: 'holiday', takeHome: '2600', housing: '' }))

      fireEvent.keyDown(fieldInput(OUTGOING_FIELD_LABELS.housing), { key: 'Enter' })

      expect(advanced).toEqual([])
    })
  })
})
