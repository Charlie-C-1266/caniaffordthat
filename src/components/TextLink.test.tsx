// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { TextLink } from './TextLink'

// The one underlined in-text link the footer, the calculator's "how this is
// worked out" links and the doc pages share. Its only branch is `newTab`, and
// that branch carries the security-relevant half: a new tab without
// rel="noopener" hands the opened page a live window.opener handle back to ours.
describe('TextLink', () => {
  afterEach(cleanup)

  it('opens in the same tab by default, with no target or rel', () => {
    render(<TextLink href="/sources/">see our sources &amp; ethos page</TextLink>)
    const link = screen.getByRole('link', { name: 'see our sources & ethos page' })
    expect(link.getAttribute('href')).toBe('/sources/')
    expect(link.hasAttribute('target')).toBe(false)
    expect(link.hasAttribute('rel')).toBe(false)
  })

  it('opens in a new tab behind the full noopener/noreferrer guard when asked', () => {
    render(
      <TextLink href="/methodology/vehicle/" newTab>
        How we estimate this
      </TextLink>,
    )
    const link = screen.getByRole('link', { name: 'How we estimate this' })
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('looks the same either way: underlined, in the secondary text colour', () => {
    render(
      <>
        <TextLink href="/a">same tab</TextLink>
        <TextLink href="/b" newTab>
          new tab
        </TextLink>
      </>,
    )
    for (const name of ['same tab', 'new tab']) {
      const { style } = screen.getByRole('link', { name })
      expect(style.textDecoration).toBe('underline')
      expect(style.color).toBe('var(--text-secondary)')
    }
  })
})
