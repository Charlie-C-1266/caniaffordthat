// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ErrorBoundary } from './ErrorBoundary'

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

  it('navigates with a full page load when no navigate prop is given — the app default', () => {
    // The real app renders <ErrorBoundary> with no `navigate`, so this is the
    // path that actually ships. jsdom refuses real navigation, so
    // window.location is swapped for a recording stand-in that still answers
    // the `origin`/`pathname` reads startOverUrl() makes.
    window.history.replaceState(null, '', '/?g=car')
    const realLocation = window.location
    const assign = vi.fn()
    const stub = { assign, origin: realLocation.origin, pathname: realLocation.pathname, search: realLocation.search }
    Object.defineProperty(window, 'location', { configurable: true, writable: true, value: stub })

    try {
      render(
        <ErrorBoundary>
          <Bomb explode />
        </ErrorBoundary>,
      )
      fireEvent.click(screen.getByRole('button', { name: 'Start over' }))

      expect(assign).toHaveBeenCalledExactlyOnceWith(`${stub.origin}${stub.pathname}`)
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, writable: true, value: realLocation })
      window.history.replaceState(null, '', '/')
    }
  })

  it('logs the error and the component stack for a user report to be diagnosable', () => {
    render(
      <ErrorBoundary>
        <Bomb explode />
      </ErrorBoundary>,
    )

    // React logs the same error itself, so this looks for our own call rather
    // than counting every console.error on the page.
    const ours = vi.mocked(console.error).mock.calls.filter((call) => call[0] === 'Unrecoverable render error:')
    expect(ours).toHaveLength(1)
    expect(ours[0][1]).toBeInstanceOf(Error)
    expect((ours[0][1] as Error).message).toBe('deliberate test crash')
    // The component stack names the component that threw.
    expect(String(ours[0][2])).toContain('Bomb')
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
})
