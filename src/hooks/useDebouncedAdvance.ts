import { useCallback, useEffect, useRef } from 'react'
import { useCalculator } from '../state/calculatorContext'

const DEFAULT_DEBOUNCE_MS = 1500

/**
 * Schedules an auto-advance scroll from `fromIndex` to `toIndex`, debounced
 * so rapid keystrokes reset the timer rather than stacking up scrolls.
 * Guards against yanking the user forward if they've already scrolled away
 * to review an earlier step by the time the timer fires — mirrors the
 * prototype's `scheduleAdvance`, which checks `this.state.activeIndex`
 * (always the *current* value, not what it was when the timer was set) at
 * fire time.
 */
export function useDebouncedAdvance(scrollToIndex: (index: number) => void) {
  const { state } = useCalculator()
  const activeIndexRef = useRef(state.activeIndex)
  activeIndexRef.current = state.activeIndex

  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  return useCallback(
    (fromIndex: number, toIndex: number, delay: number = DEFAULT_DEBOUNCE_MS) => {
      clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        if (activeIndexRef.current === fromIndex) scrollToIndex(toIndex)
      }, delay)
    },
    [scrollToIndex],
  )
}
