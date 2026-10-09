// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest'
import { render, screen, cleanup, fireEvent, act, within } from '@testing-library/react'
import { App } from './App'
import { CalculatorProvider } from './state/CalculatorProvider'
import { useCalculator, type CalculatorContextValue } from './state/calculatorContext'
import { flowForGoal } from './lib/flow'
import { GOALS, goalById } from './lib/goals'

// App owns two things nothing else does: the switch that maps each
// FlowStep.id to its component (no `default`, no exhaustiveness check, so a
// renamed id would silently render nothing), and "Start over", which must
// strip a shared link's query params *before* navigating back — otherwise a
// refresh re-hydrates the state the user just cleared.

// jsdom implements neither of these; the steps register panels with an
// IntersectionObserver on mount, and scrollToIndex calls window.scrollTo.
class FakeIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

let scrollTo: MockInstance<typeof window.scrollTo>
let replaceState: MockInstance<typeof window.history.replaceState>

let calculator: CalculatorContextValue | null = null

/** Exposes the provider's context so the flow can be driven past hydration's own rules. */
function CaptureContext() {
  calculator = useCalculator()
  return null
}

/** Renders the app at `search`, as if the page had been opened at that URL. */
function renderApp(search = '') {
  window.history.replaceState({}, '', `/${search}`)
  replaceState.mockClear()
  return render(
    <CalculatorProvider>
      <CaptureContext />
      <App />
    </CalculatorProvider>,
  )
}

/** The step labels the progress rail is currently offering — one per step in the active flow. */
function railLabels(): string[] {
  const rail = screen.getByRole('navigation', { name: 'Step progress' })
  return within(rail)
    .getAllByRole('button')
    .map((button) => button.getAttribute('aria-label') ?? '')
}

/** Index of the step the rail marks as current. */
function activeRailIndex(): number {
  const rail = screen.getByRole('navigation', { name: 'Step progress' })
  return within(rail)
    .getAllByRole('button')
    .findIndex((button) => button.getAttribute('aria-current') === 'step')
}

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
    scrollTo = vi.fn()
    vi.stubGlobal('scrollTo', scrollTo)
    replaceState = vi.spyOn(window.history, 'replaceState')
  })

  afterEach(() => {
    cleanup()
    calculator = null
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    window.history.replaceState({}, '', '/')
  })

  describe('step routing', () => {
    it('renders only the carousel and its placeholder before a goal is picked', () => {
      renderApp()

      expect(railLabels()).toEqual(['Goal', 'Details'])
      expect(screen.getByText('What are you saving for?')).toBeTruthy()
      expect(screen.getByText('Scroll back up and pick a goal to get started.')).toBeTruthy()
    })

    it('renders the standard flow, each step at its own position', () => {
      renderApp('?goalId=holiday')

      expect(railLabels()).toEqual(['Goal', 'Details', 'Budget', 'Plan', 'Result'])
      // Each step prints its own index, so these assert the component *and*
      // the position it was rendered at.
      expect(screen.getByText('What are you saving for?')).toBeTruthy()
      expect(screen.getByText('Step 1 — Getaway')).toBeTruthy()
      expect(screen.getByText('Step 2 — Your budget')).toBeTruthy()
      expect(screen.getByText('Step 3 — Timeframe')).toBeTruthy()
      expect(screen.getByTestId('result-panel')).toBeTruthy()
    })

    it("renders the vehicle flow's two bespoke steps in place of Plan", () => {
      renderApp('?goalId=car')

      expect(railLabels()).toEqual(['Goal', 'Details', 'Paying for it', 'Running costs', 'Budget', 'Result'])
      expect(screen.getByText('Step 2 — Paying for it')).toBeTruthy()
      expect(screen.getByText('Step 3 — Running costs')).toBeTruthy()
      expect(screen.getByText('Step 4 — Your budget')).toBeTruthy()
      expect(screen.getByTestId('result-panel')).toBeTruthy()
      // The generic Plan step has no place in this flow.
      expect(screen.queryByText('Step 4 — Timeframe')).toBeNull()
      expect(screen.queryByText('Step 4 — Finance details')).toBeNull()
    })

    it('renders the finance variant of the Plan step when the goal is paid monthly', () => {
      renderApp('?goalId=luxury&mode=monthly')

      expect(screen.getByText('Step 3 — Finance details')).toBeTruthy()
    })
  })

  // renderStep's switch has no `default` branch, so an id with no matching
  // `case` returns undefined and that step renders as nothing at all — no
  // compiler error, no crash, just a gap in the page. Walking every goal's
  // flow and counting what lands in <main> is what would catch that.
  describe('every step id in every flow has a matching case', () => {
    const goalIds = [null, ...GOALS.map((goal) => goal.id)]

    for (const goalId of goalIds) {
      it(`renders one panel per step for ${goalId ?? 'no goal'}`, () => {
        const { container } = renderApp()
        // Set through context rather than the URL: hydration refuses a "Soon"
        // goal, and this guard is about the switch, not about hydration.
        act(() => calculator?.setField('goalId', goalId))

        const expectedFlow = flowForGoal(goalById(goalId))
        const main = container.querySelector('main')

        expect(main?.children).toHaveLength(expectedFlow.length)
        expect(railLabels()).toEqual(expectedFlow.map((step) => step.label))
        // A step whose id fell through the switch would leave an empty slot.
        for (const panel of main?.children ?? []) {
          expect(panel.textContent?.trim()).not.toBe('')
        }
      })
    }
  })

  describe('"Start over"', () => {
    const SHARED_LINK = '?goalId=car&itemPrice=18000&takeHome=2600'

    it("clears a shared link's query params", () => {
      renderApp(SHARED_LINK)
      // The link really did hydrate, so the clear below isn't a no-op.
      expect(window.location.search).not.toBe('')
      expect(screen.getByText('Step 2 — Paying for it')).toBeTruthy()

      fireEvent.click(screen.getByRole('button', { name: 'Start over' }))

      expect(window.location.search).toBe('')
      expect(window.location.pathname).toBe('/')
    })

    it('puts the flow back to the first step', () => {
      renderApp(SHARED_LINK)

      fireEvent.click(screen.getByRole('button', { name: 'Start over' }))

      expect(railLabels()).toEqual(['Goal', 'Details'])
      expect(activeRailIndex()).toBe(0)
      expect(screen.getByText('What are you saving for?')).toBeTruthy()
      expect(screen.queryByText('Step 2 — Paying for it')).toBeNull()
    })

    it('clears the params before scrolling away, not after', () => {
      // The documented ordering: strip the query string first, so a refresh
      // after "Start over" can't re-hydrate the state just cleared.
      renderApp(SHARED_LINK)

      fireEvent.click(screen.getByRole('button', { name: 'Start over' }))

      expect(replaceState).toHaveBeenCalledWith({}, '', '/')
      expect(scrollTo).toHaveBeenCalled()
      expect(replaceState.mock.invocationCallOrder[0]).toBeLessThan(scrollTo.mock.invocationCallOrder[0])
    })

    it('resets the calculator state itself, not just the URL', () => {
      renderApp(SHARED_LINK)
      expect(calculator?.state.itemPrice).toBe('18000')

      fireEvent.click(screen.getByRole('button', { name: 'Start over' }))

      expect(calculator?.state.goalId).toBeNull()
      expect(calculator?.state.itemPrice).toBe('')
      expect(calculator?.state.takeHome).toBe('')
    })
  })
})
