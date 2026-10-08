// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { CalculatorProvider } from './CalculatorProvider'
import { useCalculator } from './calculatorContext'
import { DEFAULT_STATE } from './defaults'

// The provider is the app's single source of truth: every step component and
// the result screen reads and writes through these four setters. Elsewhere
// they're only exercised incidentally (a step test happens to type into a
// field), so these tests drive each one directly and assert on the *observed
// state* rather than on the provider's internals — the `useMemo` identity of
// `value` is deliberately not asserted, so memoization can be retuned without
// breaking these tests.

function wrapper({ children }: { children: ReactNode }) {
  return <CalculatorProvider>{children}</CalculatorProvider>
}

const renderCalculator = () => renderHook(() => useCalculator(), { wrapper })

describe('CalculatorProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts at the defaults when no shared-link params are present', () => {
    const { result } = renderCalculator()
    expect(result.current.state).toEqual(DEFAULT_STATE)
  })

  it('setField patches only the targeted key', () => {
    const { result } = renderCalculator()

    act(() => {
      result.current.setField('itemPrice', '2500')
    })

    // Exactly one key differs from the defaults it started from.
    expect(result.current.state).toEqual({ ...DEFAULT_STATE, itemPrice: '2500' })
  })

  it('setFields merges a multi-key patch in one update, leaving unpatched fields alone', () => {
    const { result } = renderCalculator()

    act(() => {
      // The shape the goal picker uses: seed mode, flavor and term together.
      result.current.setFields({ goalId: 'car', mode: 'monthly', term: 48 })
    })

    expect(result.current.state).toEqual({ ...DEFAULT_STATE, goalId: 'car', mode: 'monthly', term: 48 })
  })

  it('setFields merges onto earlier edits rather than replacing the whole state', () => {
    const { result } = renderCalculator()

    act(() => {
      result.current.setField('takeHome', '2200')
    })
    act(() => {
      result.current.setFields({ housing: '900' })
    })

    expect(result.current.state.takeHome).toBe('2200')
    expect(result.current.state.housing).toBe('900')
  })

  it('revealStep activates the step and keeps previously-revealed steps revealed', () => {
    const { result } = renderCalculator()

    act(() => {
      result.current.revealStep(1)
    })
    act(() => {
      result.current.revealStep(2)
    })

    expect(result.current.state.activeIndex).toBe(2)
    // Step 0 is revealed by default; 1 stays revealed after 2 is revealed.
    expect(result.current.state.revealed).toEqual({ 0: true, 1: true, 2: true })
  })

  it('revealStep can move back to an earlier step without un-revealing later ones', () => {
    const { result } = renderCalculator()

    act(() => {
      result.current.revealStep(3)
    })
    act(() => {
      result.current.revealStep(1)
    })

    expect(result.current.state.activeIndex).toBe(1)
    expect(result.current.state.revealed).toEqual({ 0: true, 1: true, 3: true })
  })

  it('reset restores every field to the defaults — the "Start over" behavior', () => {
    const { result } = renderCalculator()

    act(() => {
      result.current.setField('itemName', 'Golf GTI')
      result.current.setFields({ goalId: 'car', itemPrice: '18000', takeHome: '2400' })
      result.current.revealStep(4)
    })
    expect(result.current.state).not.toEqual(DEFAULT_STATE)

    act(() => {
      result.current.reset()
    })

    expect(result.current.state).toEqual(DEFAULT_STATE)
  })
})

describe('useCalculator', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('throws its documented error when called outside a CalculatorProvider', () => {
    // React logs the render-phase throw; silence it so the expected failure
    // doesn't look like a broken test run.
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => renderHook(() => useCalculator())).toThrow('useCalculator must be used within a CalculatorProvider')
  })
})
