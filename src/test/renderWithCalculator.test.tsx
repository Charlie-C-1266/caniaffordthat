// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { cleanup, screen, act } from '@testing-library/react'
import { DEFAULT_STATE } from '../state/defaults'
import { renderWithCalculator, calculator } from './renderWithCalculator'
import { useCalculator } from '../state/calculatorContext'

// The shared helper the step tests drive their state through (#166). Its whole
// reason for existing is that the ten hand-rolled copies it replaced reached
// the context through `calculator?.setFields(...)`, so a broken capture did
// nothing *silently*. That failure mode is what these pin.

/** Reads a field back out of the provider, so a seeded patch is observable in the DOM. */
function ShowPrice() {
  const { state } = useCalculator()
  return <output data-testid="price">{state.itemPrice}</output>
}

describe('renderWithCalculator', () => {
  afterEach(cleanup)

  it('throws a message naming the cause when no render has captured a context', async () => {
    // A fresh copy of the module, so this does not depend on running before
    // the tests below — module state would otherwise leak between them, which
    // is exactly the staleness the helper guards against.
    vi.resetModules()
    const fresh = await import('./renderWithCalculator')

    expect(() => fresh.calculator()).toThrow(/context was never captured/)
    expect(() => fresh.calculator()).toThrow(/renderWithCalculator/)
  })

  it('exposes the provider context after a render', () => {
    renderWithCalculator(<ShowPrice />)
    expect(calculator().state).toBeDefined()
    expect(typeof calculator().setFields).toBe('function')
  })

  it('applies a state patch, so a component sees the seeded value', () => {
    renderWithCalculator(<ShowPrice />, { itemPrice: '4200' })
    expect(screen.getByTestId('price').textContent).toBe('4200')
    expect(calculator().state.itemPrice).toBe('4200')
  })

  it('leaves state at the defaults when no patch is given', () => {
    renderWithCalculator(<ShowPrice />)
    expect(calculator().state).toEqual(DEFAULT_STATE)
  })

  it('returns the accessor alongside Testing Library’s own result', () => {
    const result = renderWithCalculator(<ShowPrice />, { itemPrice: '15' })
    expect(result.calculator().state.itemPrice).toBe('15')
    // Still a render result: the container is there to query against.
    expect(result.container.querySelector('output')).not.toBeNull()
  })

  it('reflects a write made after the render, the way the step tests drive state', () => {
    renderWithCalculator(<ShowPrice />)
    expect(screen.getByTestId('price').textContent).toBe('')

    act(() => calculator().setField('itemPrice', '999'))

    expect(screen.getByTestId('price').textContent).toBe('999')
    expect(calculator().state.itemPrice).toBe('999')
  })

  it("does not let a previous render's context stand in for a failed capture", () => {
    // Two renders in a row: the second must expose its own provider, not the
    // one the first left in the module-level slot.
    renderWithCalculator(<ShowPrice />, { itemPrice: '111' })
    const first = calculator()
    cleanup()

    renderWithCalculator(<ShowPrice />, { itemPrice: '222' })

    expect(calculator()).not.toBe(first)
    expect(calculator().state.itemPrice).toBe('222')
  })
})
