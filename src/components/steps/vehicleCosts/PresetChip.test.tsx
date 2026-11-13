// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'
import { PresetChip } from './PresetChip'

// A one-tap suggested running-cost amount. Unlike ToggleButton it does set
// `aria-pressed`, so its selected state is announced — these tests hold it to
// that, since the chip row is the only place in the vehicle flow where
// "which of these is picked" is conveyed non-visually.

const ACCENT = 'rgb(139, 92, 246)'

/** The props every test shares, so each one only states what it is varying. */
const chip = (overrides: Partial<Parameters<typeof PresetChip>[0]> = {}) => (
  <PresetChip
    label="Typical"
    active={false}
    accentColor={ACCENT}
    title="Around £120 a month for a mid-size petrol car"
    onClick={() => {}}
    {...overrides}
  />
)

describe('PresetChip', () => {
  afterEach(cleanup)

  it('shows its label as the button is named', () => {
    render(chip({ label: 'Low' }))

    expect(screen.getByRole('button', { name: 'Low' })).toBeDefined()
  })

  it('reports aria-pressed="false" when it is not the chosen preset', () => {
    render(chip({ active: false }))

    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('false')
  })

  it('reports aria-pressed="true" when it is', () => {
    render(chip({ active: true }))

    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true')
  })

  it('carries its explanation in `title`, where the hover tooltip comes from', () => {
    render(chip({ title: 'Around £200 a month for a large diesel' }))

    expect(screen.getByRole('button').getAttribute('title')).toBe('Around £200 a month for a large diesel')
  })

  it('calls onClick once per click', () => {
    const onClick = vi.fn()
    render(chip({ onClick }))

    fireEvent.click(screen.getByRole('button'))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('still calls onClick when it is already the chosen preset', () => {
    // Re-tapping the active preset re-applies its amounts over whatever the
    // user has since typed, which is the point of a preset.
    const onClick = vi.fn()
    render(chip({ active: true, onClick }))

    fireEvent.click(screen.getByRole('button'))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('takes the accent border and selected surface when active', () => {
    render(chip({ active: true }))
    const button = screen.getByRole('button')

    expect(button.style.border).toBe(`1px solid ${ACCENT}`)
    expect(button.style.background).toBe('var(--surface-selected)')
    expect(button.style.color).toBe('var(--text-primary)')
  })

  it('dims to the underline token and secondary text when inactive', () => {
    render(chip({ active: false }))
    const button = screen.getByRole('button')

    expect(button.style.border).toBe('1px solid var(--input-underline)')
    expect(button.style.background).toBe('transparent')
    expect(button.style.color).toBe('var(--text-secondary)')
  })
})
