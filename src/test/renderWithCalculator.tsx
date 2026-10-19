import type { ReactNode } from 'react'
import { render, act } from '@testing-library/react'
import { CalculatorProvider } from '../state/CalculatorProvider'
import { useCalculator, type CalculatorContextValue } from '../state/calculatorContext'
import type { CalculatorState } from '../state/types'

// One place for the "render a step under the provider, then drive its state"
// plumbing that ten test files each had their own copy of (#166).
//
// The copies all stashed the context in a module-level `let` and reached it
// through `calculator?.setFields(...)`. That optional chaining is what this
// replaces: if the capture ever broke — the helper not rendered, the provider
// moved above it — `calculator?.setFields(...)` did nothing at all, silently,
// and the test failed several steps later with "couldn't find the slider" or a
// wrong-value assertion rather than at the cause. `calculator()` throws
// instead, naming the problem.

let captured: CalculatorContextValue | null = null

/**
 * Renders nothing; exists to read the provider's context out of the tree.
 *
 * `only-export-components` flags a module that exports helpers alongside a
 * component, because it breaks Fast Refresh. Fast Refresh never runs this
 * file: it is imported only by tests, and is kept out of the bundle and of
 * coverage.
 */
// oxlint-disable-next-line react/only-export-components -- test-only module; see above
function CaptureContext() {
  // Writing a module-level variable during render is exactly what this
  // test-only component is for: it mirrors the context out for the test to
  // read, and nothing renders from it, so render purity doesn't come into it.
  // oxlint-disable-next-line react/globals -- test-only context capture; see above
  captured = useCalculator()
  return null
}

/**
 * The context of the most recent `renderWithCalculator`, for seeding state and
 * reading back what a component wrote.
 *
 * Throws rather than returning null, so a broken capture fails here with its
 * own explanation instead of turning into a confusing assertion failure later.
 */
export function calculator(): CalculatorContextValue {
  if (captured === null) {
    throw new Error(
      'The calculator context was never captured. Render the component with renderWithCalculator() ' +
        'before calling calculator(), and check that nothing has unmounted the tree (a stray cleanup()) ' +
        'since the render.',
    )
  }
  return captured
}

/**
 * Renders `ui` inside a `CalculatorProvider`, optionally seeds state, and
 * hands back Testing Library's result plus the `calculator()` accessor.
 *
 * The state patch is applied after mounting rather than through a provider
 * prop, because that is the order the real app takes: the step renders
 * against the defaults first and re-renders as state arrives.
 */
export function renderWithCalculator(ui: ReactNode, state: Partial<CalculatorState> = {}) {
  // Cleared first so a context left behind by an earlier test can't stand in
  // for one this render failed to capture — the stale value would hide
  // exactly the breakage `calculator()` exists to report.
  captured = null

  const result = render(
    <CalculatorProvider>
      <CaptureContext />
      {ui}
    </CalculatorProvider>,
  )

  if (Object.keys(state).length > 0) act(() => calculator().setFields(state))

  return { ...result, calculator }
}
