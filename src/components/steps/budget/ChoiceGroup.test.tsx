// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, screen, fireEvent, within } from '@testing-library/react'
import { ChoiceGroup } from './ChoiceGroup'
import { neutralOption } from './neutralOption'

// The labelled choice "About your pay" is built from. What it owns: naming
// its buttons' group after the label, so "None" is never announced bare, and
// showing a hint only when one is given.

const OPTIONS = [neutralOption('none', 'None'), neutralOption('plan2', 'Plan 2')] as const

describe('ChoiceGroup', () => {
  afterEach(cleanup)

  it('names the group of buttons after its label', () => {
    render(<ChoiceGroup label="Student loan plan" options={OPTIONS} value="none" onChange={() => {}} />)
    const group = screen.getByRole('group', { name: 'Student loan plan' })
    expect(within(group).getByRole('button', { name: 'None' }).getAttribute('aria-pressed')).toBe('true')
    expect(within(group).getByRole('button', { name: 'Plan 2' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('reports the option chosen', () => {
    const onChange = vi.fn()
    render(<ChoiceGroup label="Student loan plan" options={OPTIONS} value="none" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Plan 2' }))
    expect(onChange).toHaveBeenCalledWith('plan2')
  })

  it('shows a "?" hint only when given one', () => {
    render(<ChoiceGroup label="Plan" options={OPTIONS} value="none" onChange={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Which one?' })).toBeNull()
    cleanup()
    render(<ChoiceGroup label="Plan" hint="Which one?" options={OPTIONS} value="none" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Which one?' })).toBeTruthy()
  })

  it('styles every option neutrally, never with the mode accent', () => {
    expect(OPTIONS.map((option) => option.activeBackground)).toEqual(['var(--surface-selected)', 'var(--surface-selected)'])
    expect(OPTIONS.map((option) => option.activeColor)).toEqual(['var(--text-primary)', 'var(--text-primary)'])
  })
})
