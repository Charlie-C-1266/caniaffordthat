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

// Distinct, unmistakable colors: an assertion on one can't pass by coincidence
// if the focused/idle ternary is inverted or collapsed to a single branch.
const ACCENT = '#ff0000'
const IDLE = '#0000ff'
const ACCENT_RGB = 'rgb(255, 0, 0)'
const IDLE_RGB = 'rgb(0, 0, 255)'

// A concrete border width, so jsdom parses the `border-bottom` shorthand into
// its longhands and `borderBottomColor` can be read directly. Production passes
// a `var(...)` width, which jsdom leaves as an unparsed shorthand — the last
// case below asserts that real configuration through `style.borderBottom`.
const UNDERLINE = { ...SIZING, accentColor: ACCENT, idleColor: IDLE, borderWidth: '2px' }

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

  // The `focused` state exists only to pick the underline color, so a flipped
  // or collapsed ternary here is a silent visual regression on every price,
  // take-home and optional budget field.
  describe('focus/blur underline color', () => {
    it('starts on the idle color before any interaction', () => {
      render(<MoneyInput value="" onChange={() => {}} {...UNDERLINE} />)
      expect(getInput().style.borderBottomColor).toBe(IDLE_RGB)
    })

    it('switches the underline to the accent color on focus', () => {
      render(<MoneyInput value="" onChange={() => {}} {...UNDERLINE} />)
      fireEvent.focus(getInput())
      expect(getInput().style.borderBottomColor).toBe(ACCENT_RGB)
    })

    it('reverts the underline to the idle color on blur', () => {
      render(<MoneyInput value="" onChange={() => {}} {...UNDERLINE} />)
      fireEvent.focus(getInput())
      fireEvent.blur(getInput())
      expect(getInput().style.borderBottomColor).toBe(IDLE_RGB)
    })

    it('keeps the accent underline across focus and blur when idleColor is omitted', () => {
      // `idleColor` defaults to `accentColor` for the hero fields, which should
      // show the accent throughout. Asserted separately so that default can't
      // be the only thing the two cases above are really exercising.
      render(<MoneyInput value="" onChange={() => {}} {...SIZING} accentColor={ACCENT} borderWidth="2px" />)
      expect(getInput().style.borderBottomColor).toBe(ACCENT_RGB)
      fireEvent.focus(getInput())
      expect(getInput().style.borderBottomColor).toBe(ACCENT_RGB)
      fireEvent.blur(getInput())
      expect(getInput().style.borderBottomColor).toBe(ACCENT_RGB)
    })

    it('still flips with the production `var(...)` border width', () => {
      // No `borderWidth` override: the component's default is a CSS custom
      // property, which jsdom keeps as a verbatim shorthand string rather than
      // splitting out `borderBottomColor`.
      render(<MoneyInput value="" onChange={() => {}} {...SIZING} accentColor={ACCENT} idleColor={IDLE} />)
      expect(getInput().style.borderBottom).toContain(IDLE)
      fireEvent.focus(getInput())
      expect(getInput().style.borderBottom).toContain(ACCENT)
      fireEvent.blur(getInput())
      expect(getInput().style.borderBottom).toContain(IDLE)
    })
  })
})
