// @vitest-environment jsdom
import { useState } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MoneyInput } from './MoneyInput'

// Sizing props are irrelevant to the behavior under test — one shared set.
const SIZING = {
  accentColor: '#fff',
  fontSize: '20px',
  prefixFontSize: '14px',
  prefixTop: 0,
  paddingBottom: 4,
  paddingLeft: 18,
}

/** A minimal controlled harness, mirroring how every real call site owns the value as a string in state. */
function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial)
  return <MoneyInput value={value} onChange={setValue} {...SIZING} />
}

const getInput = () => screen.getByPlaceholderText<HTMLInputElement>('0')

describe('MoneyInput', () => {
  afterEach(cleanup)

  it('passes an ordinary positive amount through unchanged', () => {
    render(<Harness />)
    fireEvent.change(getInput(), { target: { value: '1500' } })
    expect(getInput().value).toBe('1500')
  })

  it('clamps a typed negative number to 0 so the display and calculations agree', () => {
    render(<Harness initial="500" />)
    fireEvent.change(getInput(), { target: { value: '-500' } })
    expect(getInput().value).toBe('0')
  })

  it('clamps a pasted negative number to 0', () => {
    render(<Harness />)
    // A paste surfaces as a single change event carrying the pasted text.
    fireEvent.change(getInput(), { target: { value: '-100' } })
    expect(getInput().value).toBe('0')
  })

  it('never lets a bare "-" produce NaN downstream, without crashing', () => {
    render(<Harness />)
    fireEvent.change(getInput(), { target: { value: '-' } })
    // A number input reports a lone "-" as the empty string (jsdom matches
    // browsers here); if one ever did surface, the clamp maps it to "0".
    // Either way nothing NaN-able can land in state.
    expect(['', '0']).toContain(getInput().value)
  })

  it('blocks the minus key at the keystroke', () => {
    render(<Harness />)
    // fireEvent returns false when a handler called preventDefault.
    expect(fireEvent.keyDown(getInput(), { key: '-' })).toBe(false)
    expect(fireEvent.keyDown(getInput(), { key: '5' })).toBe(true)
  })

  it('still forwards other keystrokes to a caller-supplied onKeyDown', () => {
    const onKeyDown = vi.fn()
    render(<MoneyInput value="" onChange={() => {}} onKeyDown={onKeyDown} {...SIZING} />)
    fireEvent.keyDown(getInput(), { key: 'Enter' })
    expect(onKeyDown).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(getInput(), { key: '-' })
    expect(onKeyDown).toHaveBeenCalledTimes(2) // forwarded even when the "-" itself is blocked
  })

  it('allows clearing the field to empty', () => {
    render(<Harness initial="250" />)
    fireEvent.change(getInput(), { target: { value: '' } })
    expect(getInput().value).toBe('')
  })
})
