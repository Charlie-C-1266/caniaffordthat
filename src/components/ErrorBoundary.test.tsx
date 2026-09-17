// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ErrorBoundary, startOverUrl } from './ErrorBoundary'

/** A child that renders fine or throws, depending on props — the two sides of the boundary. */
function Bomb({ explode }: { explode: boolean }) {
  if (explode) throw new Error('deliberate test crash')
  return <div>healthy content</div>
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // Both React and componentDidCatch log the caught error; keep the test
    // output clean without hiding real failures elsewhere.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders its children while nothing throws', () => {
    render(
      <ErrorBoundary>
        <Bomb explode={false} />
      </ErrorBoundary>,
    )
    expect(screen.getByText('healthy content')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows the fallback UI instead of a blank page when a child throws during render', () => {
    render(
      <ErrorBoundary>
        <Bomb explode />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Start over' })).toBeTruthy()
    expect(screen.queryByText('healthy content')).toBeNull()
  })

  it('recovers to a URL with the query params stripped, so a bad shared link cannot re-crash it', () => {
    // Simulate arriving via a shared link whose params triggered the crash.
    window.history.replaceState(null, '', '/?g=car&th=abc')
    expect(window.location.search).not.toBe('')

    const navigate = vi.fn()
    render(
      <ErrorBoundary navigate={navigate}>
        <Bomb explode />
      </ErrorBoundary>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Start over' }))

    expect(navigate).toHaveBeenCalledTimes(1)
    const target = new URL(navigate.mock.calls[0][0] as string)
    expect(target.search).toBe('')
    expect(`${target.origin}${target.pathname}`).toBe(`${window.location.origin}${window.location.pathname}`)

    window.history.replaceState(null, '', '/')
  })

  it('startOverUrl is the bare origin + pathname', () => {
    window.history.replaceState(null, '', '/some/path?x=1')
    expect(startOverUrl()).toBe(`${window.location.origin}/some/path`)
    window.history.replaceState(null, '', '/')
  })
})
