// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { BudgetStep } from './BudgetStep'
import { CalculatorProvider } from '../../state/CalculatorProvider'
import { useCalculator, type CalculatorContextValue } from '../../state/calculatorContext'
import { monthlyTakeHomeFromGross } from '../../lib/salary'
import { fmt } from '../../lib/calculations'
import { CURRENT_TAX_YEAR } from '../../lib/taxYears'
import { OUTGOING_FIELD_LABELS } from '../../lib/budget'
import type { CalculatorState, GoalId } from '../../state/types'

// Two pieces of real logic live in this step beyond form rendering: the
// salary -> take-home sync (typing a salary writes both fields; clearing it
// must clear the derived one rather than leave a stale figure), and the
// goal-driven show/hide/relabel of the outgoing fields, which also decides
// what `isComplete` gates Enter-to-advance on. Neither had any coverage.
//
// Also covered here, so every field and branch the step renders is exercised:
// the two money fields the user types into directly (take-home and savings),
// the derived "~ £x/month" summary that only appears once a salary is in, the
// per-goal heading, and the Enter gate's rejections.
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
// The heading wraps on a U+2028 line separator, so match across the break
// rather than pinning the exact character.
const BOTH_HALVES_HEADING = /^What's coming in,\s*and going out\?$/

/** Mirrors the step's own roundPence, so the expectation is the value it should store. */
const expectedTakeHome = (grossAnnual: number) => String(Math.round(monthlyTakeHomeFromGross(grossAnnual) * 100) / 100)

let calculator: CalculatorContextValue | null = null
/** Every index the step asked to scroll to, so the Enter gate can be read off it. */
const advanced: number[] = []

/** Exposes the provider's context so a test can seed state and read back what the step wrote. */
function CaptureContext() {
  calculator = useCalculator()
  return null
}

function renderBudgetStep(state: Partial<CalculatorState> = {}) {
  render(
    <CalculatorProvider>
      <CaptureContext />
      <BudgetStep index={STEP_INDEX} panelRef={noop} wrapperRef={noop} scrollToIndex={(i) => advanced.push(i)} />
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
/** The take-home money input — only rendered while take-home mode is active. */
const takeHomeInput = () => fieldInput('Take-home pay / month')

describe('BudgetStep', () => {
  afterEach(() => {
    cleanup()
    calculator = null
    advanced.length = 0
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

  describe('typing into the money fields', () => {
    it('writes a directly typed take-home', () => {
      renderBudgetStep({ goalId: 'holiday', takeHomeMode: 'takehome' })

      fireEvent.change(takeHomeInput(), { target: { value: '2450' } })

      expect(calculator?.state.takeHome).toBe('2450')
      // Nothing derived it, so the salary field stays empty.
      expect(calculator?.state.grossSalary).toBe('')
    })

    it('writes what has already been saved toward the goal', () => {
      renderForGoal('holiday')

      fireEvent.change(fieldInput(SAVINGS_LABEL), { target: { value: '3200' } })

      expect(calculator?.state.savings).toBe('3200')
    })

    it("writes the emergency fund's set-aside amount to the same field", () => {
      // Different label, same `savings` field — the rest of the app reads only
      // the one key, so a second field here would strand the figure.
      renderForGoal('emergency')

      fireEvent.change(fieldInput(SET_ASIDE_LABEL), { target: { value: '1500' } })

      expect(calculator?.state.savings).toBe('1500')
    })
  })

  describe('the derived take-home summary', () => {
    it('shows the monthly figure, the tax-year caveat and the methodology link once a salary is in', () => {
      renderBudgetStep({ goalId: 'holiday', takeHomeMode: 'salary', grossSalary: '45000' })

      expect(screen.getByText(fmt(monthlyTakeHomeFromGross(45000)))).toBeTruthy()
      expect(screen.getByText(new RegExp(CURRENT_TAX_YEAR.label))).toBeTruthy()
      expect(screen.getByRole('link', { name: /How this is worked out/ }).getAttribute('href')).toBe('/methodology/salary/')
    })

    it('shows nothing before a salary is typed', () => {
      renderBudgetStep({ goalId: 'holiday', takeHomeMode: 'salary', grossSalary: '' })

      expect(screen.queryByRole('link', { name: /How this is worked out/ })).toBeNull()
    })

    it('shows nothing for a salary of zero', () => {
      renderBudgetStep({ goalId: 'holiday', takeHomeMode: 'salary' })

      fireEvent.change(fieldInput('Annual salary (before tax)'), { target: { value: '0' } })

      expect(calculator?.state.takeHome).toBe('')
      expect(screen.queryByRole('link', { name: /How this is worked out/ })).toBeNull()
    })

    it('is absent in take-home mode, where nothing is derived', () => {
      renderBudgetStep({ goalId: 'holiday', takeHomeMode: 'takehome', grossSalary: '45000' })

      expect(screen.queryByRole('link', { name: /How this is worked out/ })).toBeNull()
    })
  })

  describe('salaries at the edges of the tax tables', () => {
    it('hands back the whole salary below the personal allowance', () => {
      // No income tax and no NI is due under £12,570, so take-home is just
      // the gross split over twelve months.
      renderBudgetStep({ goalId: 'holiday', takeHomeMode: 'salary' })

      fireEvent.change(fieldInput('Annual salary (before tax)'), { target: { value: '10000' } })

      expect(calculator?.state.takeHome).toBe('833.33')
      expect(calculator?.state.takeHome).toBe(expectedTakeHome(10000))
    })

    it('stays finite and well under gross on a seven-figure salary', () => {
      renderBudgetStep({ goalId: 'holiday', takeHomeMode: 'salary' })

      fireEvent.change(fieldInput('Annual salary (before tax)'), { target: { value: '1000000' } })

      const takeHome = Number(calculator?.state.takeHome)
      expect(Number.isFinite(takeHome)).toBe(true)
      // Comfortably inside the additional rate, so a long way below gross/12.
      expect(takeHome).toBeGreaterThan(0)
      expect(takeHome).toBeLessThan(1000000 / 12)
      expect(calculator?.state.takeHome).toBe(expectedTakeHome(1000000))
    })

    it('clamps a typed minus sign to zero rather than deriving from it', () => {
      // MoneyInput clamps the negative before the step sees it; the point here
      // is that the derived take-home clears rather than keeping a stale value.
      renderBudgetStep({ goalId: 'holiday', takeHomeMode: 'salary' })
      const input = fieldInput('Annual salary (before tax)')

      fireEvent.change(input, { target: { value: '45000' } })
      fireEvent.change(input, { target: { value: '-1' } })

      expect(calculator?.state.grossSalary).toBe('0')
      expect(calculator?.state.takeHome).toBe('')
    })

    it('survives being toggled back and forth without drifting', () => {
      renderBudgetStep({ goalId: 'holiday', takeHomeMode: 'salary', grossSalary: '45000', takeHome: expectedTakeHome(45000) })

      for (let i = 0; i < 3; i += 1) {
        fireEvent.click(modeButton(TAKE_HOME_MODE_LABEL))
        fireEvent.click(modeButton(SALARY_MODE_LABEL))
      }

      expect(calculator?.state.takeHomeMode).toBe('salary')
      expect(calculator?.state.takeHome).toBe(expectedTakeHome(45000))
    })
  })

  describe('the heading', () => {
    it('drops the outgoings half for the emergency fund, which is not asked for any', () => {
      renderForGoal('emergency')

      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe("What's coming in?")
    })

    it('asks about both halves for every other goal', () => {
      renderForGoal('holiday')

      expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(BOTH_HALVES_HEADING)
    })
  })

  describe('with no goal chosen', () => {
    it('falls back to the full question set rather than rendering nothing', () => {
      // `goalId` is null until the carousel is used, and hydrateStateFromUrl
      // can leave it that way; the step must still be usable.
      renderBudgetStep({ goalId: null, takeHome: '2600' })

      expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(BOTH_HALVES_HEADING)
      for (const label of Object.values(OUTGOING_FIELD_LABELS)) expect(hasField(label)).toBe(true)
      expect(hasField(SAVINGS_LABEL)).toBe(true)
      expect(hasField(VEHICLE_TRANSPORT_LABEL)).toBe(false)
    })
  })

  describe('Enter to advance', () => {
    it('is gated on the fields the goal actually shows', () => {
      // An emergency fund shows no outgoings, so a blank one must not hold it
      // back — only take-home and what it has set aside count.
      renderBudgetStep({ goalId: 'emergency', takeHome: '2600', housing: '', savings: '500' })

      fireEvent.keyDown(fieldInput(SET_ASIDE_LABEL), { key: 'Enter' })

      expect(advanced).toEqual([STEP_INDEX + 1])
    })

    it('holds back while a visible field is still blank', () => {
      renderBudgetStep({ goalId: 'holiday', takeHome: '2600', housing: '' })

      fireEvent.keyDown(fieldInput(OUTGOING_FIELD_LABELS.housing), { key: 'Enter' })

      expect(advanced).toEqual([])
    })

    it('holds back on a take-home of zero, with every other field filled', () => {
      renderBudgetStep({ goalId: 'holiday', takeHome: '0' })

      fireEvent.keyDown(takeHomeInput(), { key: 'Enter' })

      expect(advanced).toEqual([])
    })

    it('ignores every key that is not Enter', () => {
      renderBudgetStep({ goalId: 'holiday', takeHome: '2600' })

      fireEvent.keyDown(takeHomeInput(), { key: 'Tab' })
      fireEvent.keyDown(takeHomeInput(), { key: 'a' })

      expect(advanced).toEqual([])
    })

    it('advances from the salary field too', () => {
      renderBudgetStep({ goalId: 'holiday', takeHomeMode: 'salary', grossSalary: '45000', takeHome: expectedTakeHome(45000) })

      fireEvent.keyDown(fieldInput('Annual salary (before tax)'), { key: 'Enter' })

      expect(advanced).toEqual([STEP_INDEX + 1])
    })

    it('advances from an outgoing field once nothing is blank', () => {
      renderBudgetStep({ goalId: 'holiday', takeHome: '2600' })

      fireEvent.keyDown(fieldInput(OUTGOING_FIELD_LABELS.housing), { key: 'Enter' })

      expect(advanced).toEqual([STEP_INDEX + 1])
    })

    it('advances from the savings field', () => {
      renderBudgetStep({ goalId: 'holiday', takeHome: '2600' })

      fireEvent.keyDown(fieldInput(SAVINGS_LABEL), { key: 'Enter' })

      expect(advanced).toEqual([STEP_INDEX + 1])
    })
  })
})
