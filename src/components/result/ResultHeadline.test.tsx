// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ResultHeadline } from './ResultHeadline'

// Every result the user sees is headed by this component, and it is the page's
// only `h1` — so a refactor that demoted the headline to a `div`, swapped the
// eyebrow and sub-line, or dropped the caller-supplied eyebrow colour (the one
// thing that differs between a "Yes" and a "No") would still pass the cards'
// own tests. These assert on the rendered text, the element roles and the
// colour actually applied, not on the component's internals.

/** The eyebrow, headline and sub-line in the order the fragment renders them. */
function parts(container: HTMLElement) {
  const [eyebrow, headline, subheadline] = Array.from(container.children)
  return { eyebrow, headline, subheadline }
}

describe('ResultHeadline', () => {
  afterEach(cleanup)

  it('renders the eyebrow, the headline as an h1, and the sub-line', () => {
    const { container } = render(
      <ResultHeadline
        eyebrow="YOU CAN AFFORD THIS"
        eyebrowColor="var(--accent-savings)"
        headline="£240 a month"
        subheadline="Put that aside each month and you hit the goal on time."
      />,
    )

    const { eyebrow, headline, subheadline } = parts(container)

    expect(eyebrow.textContent).toBe('YOU CAN AFFORD THIS')
    expect(headline.tagName).toBe('H1')
    expect(headline.textContent).toBe('£240 a month')
    expect(subheadline.tagName).toBe('P')
    expect(subheadline.textContent).toBe('Put that aside each month and you hit the goal on time.')

    // Document order: eyebrow, then headline, then sub-line.
    expect(container.textContent).toBe('YOU CAN AFFORD THIS£240 a monthPut that aside each month and you hit the goal on time.')
  })

  it('paints the eyebrow in the colour the card supplies', () => {
    const { container: yes } = render(
      <ResultHeadline eyebrow="YES" eyebrowColor="var(--accent-savings)" headline="£240" subheadline="sub" />,
    )
    const { container: no } = render(<ResultHeadline eyebrow="NO" eyebrowColor="var(--text-tertiary)" headline="£900" subheadline="sub" />)

    // The accent on a "Yes", the neutral tone on a "No" — the colour is the
    // caller's, so it must reach the element unchanged rather than being
    // decided here.
    expect((parts(yes).eyebrow as HTMLElement).style.color).toBe('var(--accent-savings)')
    expect((parts(no).eyebrow as HTMLElement).style.color).toBe('var(--text-tertiary)')
    expect((parts(yes).eyebrow as HTMLElement).style.color).not.toBe((parts(no).eyebrow as HTMLElement).style.color)
  })

  it('renders exactly one h1', () => {
    render(<ResultHeadline eyebrow="YES" eyebrowColor="var(--accent-savings)" headline="£240" subheadline="sub" />)

    // The page has exactly one h1 and this is it; a second would be an
    // accessibility regression.
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('renders without throwing when the eyebrow or sub-line is empty', () => {
    const { container } = render(<ResultHeadline eyebrow="" eyebrowColor="var(--text-tertiary)" headline="£240 a month" subheadline="" />)

    const { eyebrow, headline, subheadline } = parts(container)

    // The headline still carries the figure; the two optional-in-practice
    // lines are simply blank.
    expect(headline.tagName).toBe('H1')
    expect(headline.textContent).toBe('£240 a month')
    expect(eyebrow.textContent).toBe('')
    expect(subheadline.textContent).toBe('')
    expect(container.textContent).toBe('£240 a month')
  })
})
