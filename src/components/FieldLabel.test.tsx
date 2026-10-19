// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { FieldLabel } from './FieldLabel'

// FieldLabel exists so label typography can't drift between steps, and its
// only branch is the md/sm size. These pin the element it renders (a real
// `<label>`, which issue #91's for/id association builds on) and the two
// token sets, so a swapped size would fail here rather than in a screenshot.

/** The `<label>` the component renders. */
function label(container: HTMLElement): HTMLLabelElement {
  const el = container.querySelector('label')
  if (!el) throw new Error('expected FieldLabel to render a label element')
  return el
}

describe('FieldLabel', () => {
  afterEach(cleanup)

  it('renders a label element carrying its text', () => {
    const { container } = render(<FieldLabel>Rent or mortgage</FieldLabel>)
    expect(label(container).textContent).toBe('Rent or mortgage')
    expect(screen.getByText('Rent or mortgage').tagName).toBe('LABEL')
  })

  it('uses the helper-size token and 8px gap by default', () => {
    const { style } = label(render(<FieldLabel>Price</FieldLabel>).container)
    expect(style.fontSize).toBe('var(--fs-helper)')
    expect(style.marginBottom).toBe('8px')
    expect(style.display).toBe('block')
    expect(style.color).toBe('var(--text-secondary-dim)')
  })

  it('uses the same defaults when size is passed as undefined', () => {
    // Call sites compute the size inline (`grid ? 'sm' : 'md'`), so an
    // undefined slipping through must still land on the default.
    const { style } = label(render(<FieldLabel size={undefined}>Price</FieldLabel>).container)
    expect(style.fontSize).toBe('var(--fs-helper)')
    expect(style.marginBottom).toBe('8px')
  })

  it('renders the md size explicitly the same as the default', () => {
    const { style } = label(render(<FieldLabel size="md">Price</FieldLabel>).container)
    expect(style.fontSize).toBe('var(--fs-helper)')
    expect(style.marginBottom).toBe('8px')
  })

  it('switches to the compact label token and 7px gap at size sm', () => {
    const { style } = label(render(<FieldLabel size="sm">Council tax</FieldLabel>).container)
    expect(style.fontSize).toBe('var(--fs-label-sm)')
    expect(style.marginBottom).toBe('7px')
  })

  it('gives the two sizes different typography', () => {
    const md = label(render(<FieldLabel>Price</FieldLabel>).container).style
    const sm = label(render(<FieldLabel size="sm">Price</FieldLabel>).container).style
    expect(md.fontSize).not.toBe(sm.fontSize)
    expect(md.marginBottom).not.toBe(sm.marginBottom)
  })

  it('accepts rich (non-string) children', () => {
    const { container } = render(
      <FieldLabel>
        Insurance <small>a year</small>
      </FieldLabel>,
    )
    expect(label(container).textContent).toBe('Insurance a year')
    expect(label(container).querySelector('small')?.textContent).toBe('a year')
  })
})
