// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { DetailsStep } from './DetailsStep'
import { CalculatorProvider } from '../../state/CalculatorProvider'
import { useCalculator, type CalculatorContextValue } from '../../state/calculatorContext'
import { OUTGOING_FIELD_KEYS, OUTGOING_FIELD_LABELS } from '../../lib/budget'

// `coverBandText` is a live three-way branch driven straight off the "Months
// of cover" slider, so these tests drive that slider rather than poking the
// derived string — the only state set directly is the goal, which the
// carousel would otherwise have to be walked through to reach this step.

const UNDER_BAND = 'Aim for at least 3 months — even a 1-month cushion is a solid start.'
const IN_BAND = 'Within the recommended 3–6 months.'
const OVER_BAND = 'More than the usual 3–6 months — a larger cushion, which is fine.'

const STEP_INDEX = 1
const noop = () => {}

let calculator: CalculatorContextValue | null = null

/** Exposes the provider's context so the test can pick the emergency-fund goal. */
function CaptureContext() {
  calculator = useCalculator()
  return null
}

/** Renders the Details step on the emergency-fund goal, with `coverMonths` at the given value. */
function renderEmergencyDetails(coverMonths?: number) {
  render(
    <CalculatorProvider>
      <CaptureContext />
      <DetailsStep index={STEP_INDEX} panelRef={noop} wrapperRef={noop} scrollToIndex={noop} />
    </CalculatorProvider>,
  )
  act(() => calculator?.setField('goalId', 'emergency'))

  const slider = screen.getByRole('slider', { name: 'Months of cover' })
  if (coverMonths !== undefined) fireEvent.change(slider, { target: { value: String(coverMonths) } })
  return slider
}

/** The band copy's row, or null when that exact copy isn't on screen. */
function bandRow(text: string): HTMLElement | null {
  return screen.queryByText(text)
}

describe('DetailsStep emergency-fund cover band copy', () => {
  afterEach(() => {
    cleanup()
    calculator = null
  })

  it('nudges towards 3 months when the cover is under the recommended band', () => {
    renderEmergencyDetails(1)

    expect(bandRow(UNDER_BAND)).toBeTruthy()
    expect(bandRow(IN_BAND)).toBeNull()
    expect(bandRow(OVER_BAND)).toBeNull()
    // The reassuring check mark belongs to the in-band case only.
    expect(bandRow(UNDER_BAND)?.querySelector('svg')).toBeNull()
  })

  it('calls the cover in-band at the default 3 months, with a check mark', () => {
    // No slider change: 3 is the DEFAULT_STATE value a user lands on.
    renderEmergencyDetails()

    expect(bandRow(IN_BAND)).toBeTruthy()
    expect(bandRow(UNDER_BAND)).toBeNull()
    expect(bandRow(OVER_BAND)).toBeNull()
    expect(bandRow(IN_BAND)?.querySelector('svg')).toBeTruthy()
  })

  it('still calls the cover in-band at the top of the band (6 months)', () => {
    renderEmergencyDetails(6)

    expect(bandRow(IN_BAND)).toBeTruthy()
    expect(bandRow(OVER_BAND)).toBeNull()
  })

  it('calls a cover over the recommended band larger, without discouraging it', () => {
    renderEmergencyDetails(7)

    expect(bandRow(OVER_BAND)).toBeTruthy()
    expect(bandRow(IN_BAND)).toBeNull()
    expect(bandRow(UNDER_BAND)).toBeNull()
    expect(bandRow(OVER_BAND)?.querySelector('svg')).toBeNull()
  })

  it('moves between all three bands as the slider is dragged', () => {
    const slider = renderEmergencyDetails()
    expect(bandRow(IN_BAND)).toBeTruthy()

    fireEvent.change(slider, { target: { value: '2' } })
    expect(bandRow(UNDER_BAND)).toBeTruthy()

    fireEvent.change(slider, { target: { value: '12' } })
    expect(bandRow(OVER_BAND)).toBeTruthy()

    fireEvent.change(slider, { target: { value: '4' } })
    expect(bandRow(IN_BAND)).toBeTruthy()
  })
})

// --- The standard-goal path (Vehicle, Holiday, Luxury, Big purchase) ---
//
// The emergency-fund tests above cover the other half of the step. Everything
// here drives the real handlers through the DOM rather than poking state: the
// `> 0` guards on auto-advance, the name field's "still on this step"
// re-scheduling, and which goals show the title, deposit and mode toggle.
//
// `useDebouncedAdvance` only fires while `state.activeIndex === index`, so
// every render below sets `activeIndex` to the step's own index — otherwise
// the timer fires into a no-op and these tests would pass vacuously.

const DEBOUNCE_MS = 1500

/** Renders the Details step on `goalId`, parked on this step so auto-advance can fire. */
function renderStandardDetails(goalId: 'car' | 'holiday' | 'luxury' | 'big' | 'mortgage') {
  const scrollToIndex = vi.fn()
  render(
    <CalculatorProvider>
      <CaptureContext />
      <DetailsStep index={STEP_INDEX} panelRef={noop} wrapperRef={noop} scrollToIndex={scrollToIndex} />
    </CalculatorProvider>,
  )
  act(() => {
    calculator?.setField('goalId', goalId)
    calculator?.setField('activeIndex', STEP_INDEX)
  })
  return scrollToIndex
}

/** The step's price input — the first number field, as it is in the rendered order. */
function priceField(): HTMLInputElement {
  return screen.getAllByRole('spinbutton')[0] as HTMLInputElement
}

/** The input a money field's label names. #94 linked each label to its input, so it is found by accessible name. */
function fieldUnderLabel(label: string): HTMLInputElement {
  return screen.getByLabelText<HTMLInputElement>(label)
}

/** Lets the debounce timer run to completion. */
function runDebounce(ms = DEBOUNCE_MS) {
  act(() => void vi.advanceTimersByTime(ms))
}

describe('DetailsStep standard-goal path', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    calculator = null
    vi.useRealTimers()
  })

  describe('auto-advance on the price', () => {
    it('advances to the next step once a price above zero settles', () => {
      const scrollToIndex = renderStandardDetails('big')

      fireEvent.change(priceField(), { target: { value: '1200' } })
      // Nothing yet — the point of the debounce is that it waits.
      expect(scrollToIndex).not.toHaveBeenCalled()

      runDebounce()
      expect(scrollToIndex).toHaveBeenCalledWith(STEP_INDEX + 1)
    })

    it('does not schedule an advance for a zero or empty price', () => {
      const scrollToIndex = renderStandardDetails('big')

      fireEvent.change(priceField(), { target: { value: '0' } })
      runDebounce()
      expect(scrollToIndex).not.toHaveBeenCalled()

      fireEvent.change(priceField(), { target: { value: '' } })
      runDebounce()
      expect(scrollToIndex).not.toHaveBeenCalled()
    })

    it('resets the timer on each keystroke rather than stacking advances', () => {
      const scrollToIndex = renderStandardDetails('big')

      fireEvent.change(priceField(), { target: { value: '1' } })
      runDebounce(DEBOUNCE_MS - 500)
      fireEvent.change(priceField(), { target: { value: '12' } })
      runDebounce(DEBOUNCE_MS - 500)
      // The second keystroke restarted the wait, so the first never fired.
      expect(scrollToIndex).not.toHaveBeenCalled()

      runDebounce(500)
      expect(scrollToIndex).toHaveBeenCalledTimes(1)
    })

    it('does not fire if the user has scrolled away to another step', () => {
      const scrollToIndex = renderStandardDetails('big')

      fireEvent.change(priceField(), { target: { value: '1200' } })
      act(() => calculator?.setField('activeIndex', 0))

      runDebounce()
      // The guard in useDebouncedAdvance: don't yank someone forward from a
      // step they deliberately scrolled back to.
      expect(scrollToIndex).not.toHaveBeenCalled()
    })
  })

  describe('Enter on the price', () => {
    it('advances immediately for a price above zero, without waiting for the debounce', () => {
      const scrollToIndex = renderStandardDetails('big')

      fireEvent.change(priceField(), { target: { value: '1200' } })
      fireEvent.keyDown(priceField(), { key: 'Enter' })
      expect(scrollToIndex).toHaveBeenCalledWith(STEP_INDEX + 1)
    })

    it('does nothing on Enter when the price is empty or zero', () => {
      const scrollToIndex = renderStandardDetails('big')

      fireEvent.keyDown(priceField(), { key: 'Enter' })
      expect(scrollToIndex).not.toHaveBeenCalled()

      fireEvent.change(priceField(), { target: { value: '0' } })
      fireEvent.keyDown(priceField(), { key: 'Enter' })
      expect(scrollToIndex).not.toHaveBeenCalled()
    })

    it('ignores other keys', () => {
      const scrollToIndex = renderStandardDetails('big')

      fireEvent.change(priceField(), { target: { value: '1200' } })
      fireEvent.keyDown(priceField(), { key: 'a' })
      fireEvent.keyDown(priceField(), { key: 'Tab' })
      expect(scrollToIndex).not.toHaveBeenCalled()
    })
  })

  describe('the goal title field', () => {
    it('re-schedules the pending advance while the title is still being edited', () => {
      const scrollToIndex = renderStandardDetails('big')

      fireEvent.change(priceField(), { target: { value: '1200' } })
      runDebounce(DEBOUNCE_MS - 500)

      // Editing the name counts as "still on this step", so the wait restarts.
      fireEvent.change(screen.getByPlaceholderText('e.g. Wedding, new kitchen, sofa'), { target: { value: 'New sofa' } })
      runDebounce(DEBOUNCE_MS - 500)
      expect(scrollToIndex).not.toHaveBeenCalled()

      runDebounce(500)
      expect(scrollToIndex).toHaveBeenCalledWith(STEP_INDEX + 1)
    })

    it('does not schedule an advance from the title alone when there is no price', () => {
      const scrollToIndex = renderStandardDetails('big')

      fireEvent.change(screen.getByPlaceholderText('e.g. Wedding, new kitchen, sofa'), { target: { value: 'New sofa' } })
      runDebounce()
      expect(scrollToIndex).not.toHaveBeenCalled()
    })

    it('writes the title to state', () => {
      renderStandardDetails('big')

      fireEvent.change(screen.getByPlaceholderText('e.g. Wedding, new kitchen, sofa'), { target: { value: 'New sofa' } })
      expect(calculator?.state.itemName).toBe('New sofa')
    })

    it('renders only for goals with showName, using that goal placeholder', () => {
      renderStandardDetails('luxury')
      expect(screen.getByText(/Goal title/)).toBeTruthy()
      expect(screen.getByPlaceholderText('e.g. Omega watch')).toBeTruthy()

      cleanup()
      calculator = null

      // Mortgage is the only goal that takes this branch with showName: false,
      // so it is what actually exercises the gate. (Emergency fund also has
      // showName: false, but renders the other branch entirely, so it would
      // pass whether the gate were there or not.)
      renderStandardDetails('mortgage')
      expect(screen.queryByText(/Goal title/)).toBeNull()
      expect(screen.queryByRole('textbox')).toBeNull()

      cleanup()
      calculator = null

      // And the emergency fund has no title field either, via its own branch.
      render(
        <CalculatorProvider>
          <CaptureContext />
          <DetailsStep index={STEP_INDEX} panelRef={noop} wrapperRef={noop} scrollToIndex={noop} />
        </CalculatorProvider>,
      )
      act(() => calculator?.setField('goalId', 'emergency'))
      expect(screen.queryByText(/Goal title/)).toBeNull()
    })
  })

  describe('the price headline', () => {
    it("uses each goal's own copy", () => {
      const headlines = {
        car: 'How much is the car?',
        holiday: 'How much is the trip?',
        luxury: 'How much is it?',
        big: "What's the total cost?",
      }

      for (const [goalId, headline] of Object.entries(headlines)) {
        renderStandardDetails(goalId as 'car')
        expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(headline)
        cleanup()
        calculator = null
      }
    })
  })

  describe('the deposit field', () => {
    it('is shown for the Vehicle goal only', () => {
      renderStandardDetails('car')
      expect(screen.getByText('Deposit / part-exchange')).toBeTruthy()
      // Counted, not just matched on the label: an ungated deposit block on a
      // goal with no depositLabel would render an empty label and slip past a
      // text query, but it cannot hide an extra money field.
      expect(screen.getAllByRole('spinbutton')).toHaveLength(2)

      cleanup()
      calculator = null

      renderStandardDetails('big')
      expect(screen.queryByText('Deposit / part-exchange')).toBeNull()
      expect(screen.getAllByRole('spinbutton')).toHaveLength(1)
    })

    it('writes to savings, not to the price', () => {
      renderStandardDetails('car')

      fireEvent.change(fieldUnderLabel('Deposit / part-exchange'), { target: { value: '3000' } })
      expect(calculator?.state.savings).toBe('3000')
      expect(calculator?.state.itemPrice).toBe('')
    })

    it('shares the price field Enter-to-advance handler', () => {
      const scrollToIndex = renderStandardDetails('car')
      const deposit = fieldUnderLabel('Deposit / part-exchange')

      // The handler reads the *event target's* value, so a valid deposit advances.
      fireEvent.change(deposit, { target: { value: '3000' } })
      fireEvent.keyDown(deposit, { key: 'Enter' })
      expect(scrollToIndex).toHaveBeenCalledWith(STEP_INDEX + 1)
    })

    it('does not advance on Enter from an empty deposit', () => {
      const scrollToIndex = renderStandardDetails('car')

      fireEvent.keyDown(fieldUnderLabel('Deposit / part-exchange'), { key: 'Enter' })
      expect(scrollToIndex).not.toHaveBeenCalled()
    })
  })

  describe('the mode toggle', () => {
    it('is offered for goals that allow it, and changing it updates mode', () => {
      renderStandardDetails('big')
      expect(screen.getByText('How do you plan to pay?')).toBeTruthy()

      // Seeded to 'save' for this goal; the toggle flips it to finance.
      fireEvent.click(screen.getByRole('button', { name: 'Pay monthly' }))
      expect(calculator?.state.mode).toBe('monthly')

      fireEvent.click(screen.getByRole('button', { name: 'Save up for it' }))
      expect(calculator?.state.mode).toBe('save')
    })

    it('is hidden for the Vehicle goal, whose purchase step asks the same question', () => {
      renderStandardDetails('car')
      expect(screen.queryByText('How do you plan to pay?')).toBeNull()
    })

    it('is hidden for the emergency fund', () => {
      render(
        <CalculatorProvider>
          <CaptureContext />
          <DetailsStep index={STEP_INDEX} panelRef={noop} wrapperRef={noop} scrollToIndex={noop} />
        </CalculatorProvider>,
      )
      act(() => calculator?.setField('goalId', 'emergency'))
      expect(screen.queryByText('How do you plan to pay?')).toBeNull()
    })
  })

  describe('with no goal chosen', () => {
    it('prompts the user back to the carousel instead of rendering a price field', () => {
      render(
        <CalculatorProvider>
          <CaptureContext />
          <DetailsStep index={STEP_INDEX} panelRef={noop} wrapperRef={noop} scrollToIndex={noop} />
        </CalculatorProvider>,
      )
      expect(screen.getByText('Scroll back up and pick a goal to get started.')).toBeTruthy()
      expect(screen.queryByRole('spinbutton')).toBeNull()
    })
  })
})

// The emergency-fund essentials grid's own onChange — the last uncovered
// function in the file, and the one the issue names at line 167. The band
// tests above drive the slider but never type into an essentials field, so
// the grid's write path was unproven.
describe('DetailsStep emergency-fund essentials grid', () => {
  afterEach(() => {
    cleanup()
    calculator = null
  })

  it('writes each essentials field to its own state key and re-totals the target', () => {
    renderEmergencyDetails(3)

    fireEvent.change(fieldUnderLabel('Housing (rent/mortgage)'), { target: { value: '800' } })
    expect(calculator?.state.housing).toBe('800')

    fireEvent.change(fieldUnderLabel('Utilities & bills'), { target: { value: '150' } })
    expect(calculator?.state.utilities).toBe('150')
    // Untouched fields keep their defaults rather than being overwritten.
    expect(calculator?.state.groceries).toBe('0')

    // 3 months x £950 of essentials — the figure the summary quotes.
    expect(screen.getByText(/£2,850/)).toBeTruthy()
  })

  it('labels every essentials field from the shared outgoing-field list, each wired to its own key', () => {
    // lib/budget.ts is the one source of these labels, shared with the Budget
    // step's grid (held to it in BudgetStep.test.tsx). A label hard-coded here
    // instead would let the two grids drift apart — the divergence budget.ts
    // was extracted to stop. Found by accessible name, so the label must
    // genuinely belong to the input it names.
    renderEmergencyDetails(3)

    const miswired = OUTGOING_FIELD_KEYS.filter((key) => {
      fireEvent.change(screen.getByLabelText(OUTGOING_FIELD_LABELS[key]), { target: { value: '123' } })
      return calculator?.state[key] !== '123'
    })
    expect(miswired).toEqual([])
  })

  // #167: the price input and the goal-title input had no accessible name.
  // The price is named by its own headline (the visible question is the
  // heading, not a label), and the title by its FieldLabel. These query the
  // way a screen reader resolves a name, so they fail on the unnamed markup.
  describe('accessible names for the hero fields', () => {
    const HEADLINES = {
      car: 'How much is the car?',
      holiday: 'How much is the trip?',
      luxury: 'How much is it?',
      big: "What's the total cost?",
    } as const

    it("names the price field with each goal's own headline", () => {
      for (const [goalId, headline] of Object.entries(HEADLINES)) {
        renderStandardDetails(goalId as 'car')
        // Same element, reached by role+name and by label lookup.
        expect(screen.getByRole('spinbutton', { name: headline })).toBe(screen.getByLabelText(headline))
        cleanup()
        calculator = null
      }
    })

    it('points the price field at the heading that is actually rendered', () => {
      renderStandardDetails('holiday')

      const field = screen.getByLabelText('How much is the trip?')
      const headingId = field.getAttribute('aria-labelledby')
      expect(headingId).toBeTruthy()
      // Not a dangling reference: the id resolves to the visible headline.
      expect(document.getElementById(headingId!)?.textContent).toBe('How much is the trip?')
    })

    it('names the input that actually takes the price', () => {
      renderStandardDetails('holiday')

      fireEvent.change(screen.getByLabelText('How much is the trip?'), { target: { value: '4200' } })

      expect(calculator?.state.itemPrice).toBe('4200')
    })

    it('names the goal-title field from its label, not just its placeholder', () => {
      renderStandardDetails('holiday')

      const title = screen.getByLabelText(/^Goal title/)
      expect(title.getAttribute('placeholder')).toBe('e.g. Two weeks in Italy')
      fireEvent.change(title, { target: { value: 'Two weeks in Italy' } })
      expect(calculator?.state.itemName).toBe('Two weeks in Italy')
    })

    it('leaves no input on the step without an accessible name', () => {
      renderStandardDetails('car')

      // Collected rather than matched with a `label[for="..."]` selector:
      // React's useId emits ids containing colons, which need escaping that
      // jsdom's CSS.escape doesn't provide.
      const labelledIds = new Set([...document.querySelectorAll('label[for]')].map((label) => label.getAttribute('for')))

      const unnamed = [...document.querySelectorAll('input')].filter((input) => {
        if (input.getAttribute('aria-label')) return false
        const labelledBy = input.getAttribute('aria-labelledby')
        if (labelledBy && document.getElementById(labelledBy)?.textContent?.trim()) return false
        return !labelledIds.has(input.id)
      })

      expect(unnamed.map((input) => input.getAttribute('placeholder') ?? input.type)).toEqual([])
    })
  })
})
