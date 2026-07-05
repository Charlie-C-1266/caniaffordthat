import { createContext, useContext } from 'react'
import type { CalculatorState } from './types'

export interface CalculatorContextValue {
  state: CalculatorState
  /** Patches a single field, leaving the rest of the state untouched. */
  setField: <K extends keyof CalculatorState>(key: K, value: CalculatorState[K]) => void
  /** Patches several fields in one update — used when selecting a goal seeds mode, term, etc. at once. */
  setFields: (patch: Partial<CalculatorState>) => void
  /**
   * Marks a step as the active/centered one and, once revealed, keeps it
   * revealed even if the user scrolls away — mirrors the IntersectionObserver
   * behavior described in the design doc.
   */
  revealStep: (index: number) => void
  /** Restores all fields to their defaults (the "Start over" behavior). */
  reset: () => void
}

export const CalculatorContext = createContext<CalculatorContextValue | null>(null)

/** Access the shared calculator state. Must be called under a `CalculatorProvider`. */
export function useCalculator(): CalculatorContextValue {
  const ctx = useContext(CalculatorContext)
  if (!ctx) throw new Error('useCalculator must be used within a CalculatorProvider')
  return ctx
}
