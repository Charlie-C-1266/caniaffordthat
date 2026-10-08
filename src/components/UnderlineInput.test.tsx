// @vitest-environment jsdom
import { useState } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { UnderlineInput } from './UnderlineInput'

const ACCENT = 'rgb(124, 207, 255)'
const CUSTOM_IDLE = 'rgb(51, 51, 51)'

const getInput = () => screen.getByRole<HTMLInputElement>('textbox')

/** A controlled harness, mirroring how the item-name field owns its value in state. */
function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial)
  return <UnderlineInput value={value} onChange={setValue} placeholder="a new sofa" fontSize="28px" accentColor={ACCENT} />
}

describe('UnderlineInput', () => {
  afterEach(cleanup)

  it('underlines with the default idle colour before focus', () => {
    render(<UnderlineInput value="" onChange={() => {}} fontSize="28px" accentColor={ACCENT} />)
    expect(getInput().style.borderBottom).toContain('var(--input-underline)')
  })

  it('underlines with a caller-supplied idleColor before focus', () => {
    // idleColor is overridable here but not on LabeledUnitField, so the
    // default and the override both need pinning.
    render(<UnderlineInput value="" onChange={() => {}} fontSize="28px" accentColor={ACCENT} idleColor={CUSTOM_IDLE} />)
    expect(getInput().style.borderBottom).toContain(CUSTOM_IDLE)
  })

  it('switches the underline to the accent colour while focused, and back on blur', () => {
    // A focus/blur pair wired backwards would show the unfocused colour while
    // typing — visible to a user, invisible to every other test.
    render(<UnderlineInput value="" onChange={() => {}} fontSize="28px" accentColor={ACCENT} idleColor={CUSTOM_IDLE} />)

    fireEvent.focus(getInput())
    expect(getInput().style.borderBottom).toContain(ACCENT)
    expect(getInput().style.borderBottom).not.toContain(CUSTOM_IDLE)

    fireEvent.blur(getInput())
    expect(getInput().style.borderBottom).toContain(CUSTOM_IDLE)
    expect(getInput().style.borderBottom).not.toContain(ACCENT)
  })

  it('reports typed text to onChange as the raw string', () => {
    const onChange = vi.fn()
    render(<UnderlineInput value="" onChange={onChange} fontSize="28px" accentColor={ACCENT} />)
    fireEvent.change(getInput(), { target: { value: 'a new sofa' } })
    expect(onChange).toHaveBeenCalledExactlyOnceWith('a new sofa')
  })

  it('renders the controlled value and the placeholder it was given', () => {
    render(<Harness initial="a new sofa" />)
    expect(getInput().value).toBe('a new sofa')
    expect(getInput().placeholder).toBe('a new sofa')
  })

  it('round-trips edits through a controlled parent', () => {
    render(<Harness />)
    fireEvent.change(getInput(), { target: { value: 'holiday' } })
    expect(getInput().value).toBe('holiday')
  })

  it('forwards keystrokes to a caller-supplied onKeyDown', () => {
    // Call sites use this for Enter-to-advance, so a dropped handler would
    // strand the user on the step.
    const onKeyDown = vi.fn()
    render(<UnderlineInput value="" onChange={() => {}} onKeyDown={onKeyDown} fontSize="28px" accentColor={ACCENT} />)

    fireEvent.keyDown(getInput(), { key: 'Enter' })
    expect(onKeyDown).toHaveBeenCalledTimes(1)
    expect(onKeyDown.mock.calls[0][0]).toMatchObject({ key: 'Enter' })
  })

  it('does not require an onKeyDown handler', () => {
    render(<UnderlineInput value="" onChange={() => {}} fontSize="28px" accentColor={ACCENT} />)
    expect(() => fireEvent.keyDown(getInput(), { key: 'Enter' })).not.toThrow()
  })
})
