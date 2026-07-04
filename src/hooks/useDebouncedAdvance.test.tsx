// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDebouncedAdvance } from './useDebouncedAdvance'
import { useCalculator } from '../state/calculatorContext'
import { CalculatorProvider } from '../state/CalculatorProvider'

function wrapper({ children }: { children: ReactNode }) {
  return <CalculatorProvider>{children}</CalculatorProvider>
}

// Combines the hook under test with `revealStep`, so tests can put the
// harness "on" a given step (activeIndex) before scheduling, and simulate
// the user manually moving to a different step while a timer is pending.
function useHarness(scrollToIndex: (index: number) => void) {
  const schedule = useDebouncedAdvance(scrollToIndex)
  const { state, revealStep } = useCalculator()
  return { schedule, revealStep, activeIndex: state.activeIndex }
}

describe('useDebouncedAdvance', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('fires scrollToIndex after the default 700ms delay', () => {
    const scrollToIndex = vi.fn()
    const { result } = renderHook(() => useHarness(scrollToIndex), { wrapper })

    act(() => {
      result.current.revealStep(1) // put the harness "on" step 1, matching the scheduled fromIndex
    })
    act(() => {
      result.current.schedule(1, 2)
    })
    expect(scrollToIndex).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(700)
    })
    expect(scrollToIndex).toHaveBeenCalledTimes(1)
    expect(scrollToIndex).toHaveBeenCalledWith(2)
  })

  it('resets the timer on repeated calls instead of stacking up scrolls', () => {
    const scrollToIndex = vi.fn()
    const { result } = renderHook(() => useHarness(scrollToIndex), { wrapper })

    act(() => {
      result.current.revealStep(1)
    })
    act(() => {
      result.current.schedule(1, 2)
    })
    act(() => {
      vi.advanceTimersByTime(400)
    })
    act(() => {
      result.current.schedule(1, 2) // simulates another keystroke — should reset the 700ms window
    })
    act(() => {
      vi.advanceTimersByTime(400)
    })
    expect(scrollToIndex).not.toHaveBeenCalled() // only 400ms elapsed since the reset

    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(scrollToIndex).toHaveBeenCalledTimes(1)
  })

  it('supports a custom delay', () => {
    const scrollToIndex = vi.fn()
    const { result } = renderHook(() => useHarness(scrollToIndex), { wrapper })

    act(() => {
      result.current.schedule(0, 1, 250) // default activeIndex is already 0
    })
    act(() => {
      vi.advanceTimersByTime(249)
    })
    expect(scrollToIndex).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(scrollToIndex).toHaveBeenCalledTimes(1)
    expect(scrollToIndex).toHaveBeenCalledWith(1)
  })

  it('does not fire if the user has already moved to a different step by the time the timer elapses', () => {
    const scrollToIndex = vi.fn()
    const { result } = renderHook(() => useHarness(scrollToIndex), { wrapper })

    act(() => {
      result.current.revealStep(1)
    })
    act(() => {
      result.current.schedule(1, 2)
    })
    act(() => {
      result.current.revealStep(3) // user manually scrolled away from step 1 before the timer fired
    })
    act(() => {
      vi.advanceTimersByTime(700)
    })
    expect(scrollToIndex).not.toHaveBeenCalled()
  })

  it('clears the pending timer on unmount', () => {
    const scrollToIndex = vi.fn()
    const { result, unmount } = renderHook(() => useHarness(scrollToIndex), { wrapper })

    act(() => {
      result.current.revealStep(1)
    })
    act(() => {
      result.current.schedule(1, 2)
    })
    unmount()

    act(() => {
      vi.advanceTimersByTime(700)
    })
    expect(scrollToIndex).not.toHaveBeenCalled()
  })
})
