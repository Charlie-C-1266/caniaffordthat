// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { SourcesLink } from './SourcesLink'

const getLink = () => screen.getByTestId('sources-link')

describe('SourcesLink', () => {
  afterEach(cleanup)

  it('links out to the sources page in a new tab, without leaking the referrer', () => {
    render(<SourcesLink />)
    const link = getLink()
    expect(link.getAttribute('href')).toBe('/sources/')
    expect(link.getAttribute('target')).toBe('_blank')
    // A mid-flow click must not cost the user the figures they've typed, and
    // noopener/noreferrer is the standard guard on a new-tab link.
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    expect(link.textContent).toBe('Our sources')
  })

  it('rests on the plain pill background', () => {
    render(<SourcesLink />)
    expect(getLink().style.background).toBe('var(--pill-bg)')
  })

  it('swaps to the hover background while moused over and back on leave', () => {
    render(<SourcesLink />)
    const link = getLink()
    fireEvent.mouseEnter(link)
    expect(link.style.background).toBe('var(--pill-bg-hover)')
    fireEvent.mouseLeave(link)
    expect(link.style.background).toBe('var(--pill-bg)')
  })

  it('does not stick in the hover background after a touch tap', () => {
    // A real tap fires touchstart/touchend and *then* a synthetic mouseenter,
    // with no mouseleave until the user taps elsewhere — so replay that exact
    // order. Anything that lights the pill up here would leave it looking
    // stuck/broken on a phone.
    render(<SourcesLink />)
    const link = getLink()
    fireEvent.touchStart(link)
    fireEvent.touchEnd(link)
    fireEvent.mouseEnter(link)
    expect(link.style.background).toBe('var(--pill-bg)')
  })

  it('still hovers normally with a mouse after an earlier touch tap', () => {
    // Hybrid touch-and-mouse devices must not lose hover permanently just
    // because the pill was tapped once.
    render(<SourcesLink />)
    const link = getLink()
    fireEvent.touchStart(link)
    fireEvent.touchEnd(link)
    fireEvent.mouseEnter(link)
    fireEvent.mouseLeave(link)

    fireEvent.mouseEnter(link)
    expect(link.style.background).toBe('var(--pill-bg-hover)')
  })

  it('drops the hover background when focus leaves', () => {
    render(<SourcesLink />)
    const link = getLink()
    fireEvent.mouseEnter(link)
    fireEvent.blur(link)
    expect(link.style.background).toBe('var(--pill-bg)')
  })
})
