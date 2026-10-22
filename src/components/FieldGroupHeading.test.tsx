// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { FieldGroupHeading } from './FieldGroupHeading'

// The small uppercase heading over a group of fields: the Budget step's groups
// and the vehicle running-costs groups. It exists so those can't drift apart,
// after the running-costs step's private copy slipped to 2px less space below.
// Its whole job is the handful of style values below, so they're pinned: a
// change to one changes every group heading at once, and should be deliberate.

describe('FieldGroupHeading', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders its text', () => {
    render(<FieldGroupHeading>Monthly outgoings</FieldGroupHeading>)

    expect(screen.getByText('Monthly outgoings')).toBeTruthy()
  })

  it('uses the label styles every group heading shares: small, bold, uppercase, tertiary, 14px below', () => {
    render(<FieldGroupHeading>Fuel</FieldGroupHeading>)

    const { style } = screen.getByText('Fuel')
    expect(style.fontSize).toBe('var(--fs-label)')
    expect(style.fontWeight).toBe('700')
    expect(style.color).toBe('var(--text-tertiary)')
    expect(style.textTransform).toBe('uppercase')
    expect(style.letterSpacing).toBe('0.06em')
    expect(style.marginBottom).toBe('14px')
  })

  it('uppercases through CSS, leaving the text as written for screen readers and copy-paste', () => {
    render(<FieldGroupHeading>Insurance & tax</FieldGroupHeading>)

    expect(screen.getByText('Insurance & tax').textContent).toBe('Insurance & tax')
  })

  it('renders an empty heading without throwing', () => {
    const { container } = render(<FieldGroupHeading>{''}</FieldGroupHeading>)

    const heading = container.firstElementChild
    expect(heading).toBeInstanceOf(HTMLElement)
    expect(heading?.textContent).toBe('')
  })

  it('renders without logging a console error or warning', () => {
    // React reports nesting and prop mistakes through the console rather than
    // by throwing, so the heading would still appear with a warning behind it.
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    render(<FieldGroupHeading>Quiet</FieldGroupHeading>)

    expect(error).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
  })
})
