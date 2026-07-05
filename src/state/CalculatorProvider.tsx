import { useCallback, useState, type ReactNode } from 'react'
import { CalculatorContext, type CalculatorContextValue } from './calculatorContext'
import { DEFAULT_STATE } from './defaults'
import { hydrateStateFromUrl } from '../lib/urlState'
import type { CalculatorState } from './types'

interface CalculatorProviderProps {
  children: ReactNode
}

/** Provides the shared calculator state to the component tree, hydrated from a shared-link URL if one was followed. */
export function CalculatorProvider({ children }: CalculatorProviderProps) {
  const [state, setState] = useState<CalculatorState>(() => hydrateStateFromUrl(window.location.search))

  // Memoized with stable identity (setState from useState never changes) so
  // that effects elsewhere — e.g. useStepObserver's IntersectionObserver
  // setup — can safely depend on these without re-running on every keystroke.
  const setField = useCallback<CalculatorContextValue['setField']>((key, value) => {
    setState((prev) => ({ ...prev, [key]: value }))
  }, [])

  const setFields = useCallback<CalculatorContextValue['setFields']>((patch) => {
    setState((prev) => ({ ...prev, ...patch }))
  }, [])

  const revealStep = useCallback<CalculatorContextValue['revealStep']>((index) => {
    setState((prev) => ({
      ...prev,
      activeIndex: index,
      revealed: { ...prev.revealed, [index]: true },
    }))
  }, [])

  const reset = useCallback<CalculatorContextValue['reset']>(() => setState(DEFAULT_STATE), [])

  return (
    <CalculatorContext.Provider value={{ state, setField, setFields, revealStep, reset }}>
      {children}
    </CalculatorContext.Provider>
  )
}
