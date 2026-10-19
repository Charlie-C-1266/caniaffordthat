import { Component, type ErrorInfo, type ReactNode } from 'react'
import { startOverUrl } from '../lib/urlState'

interface ErrorBoundaryProps {
  children: ReactNode
  /**
   * How "Start over" navigates. Injectable because jsdom can't perform real
   * navigation; the app default is a full page load of `startOverUrl()`.
   */
  navigate?: (url: string) => void
}

interface ErrorBoundaryState {
  hasError: boolean
}

/**
 * The app's top-level (and only) error boundary. Without one, any uncaught
 * render exception unmounts the whole tree and leaves a blank white page
 * with no way back. The fallback keeps the app's tone: a short message and
 * a single "Start over" action that reloads the app clean.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // No error-reporting service is wired up; surface it for devtools so a
    // user report ("it went blank") is diagnosable from their console.
    console.error('Unrecoverable render error:', error, info.componentStack)
  }

  readonly handleStartOver = (): void => {
    const navigate = this.props.navigate ?? ((url: string) => window.location.assign(url))
    navigate(startOverUrl())
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children

    return (
      <div
        role="alert"
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          padding: '0 24px',
          textAlign: 'center',
          background: 'var(--bg-dark-1)',
          color: 'var(--text-primary)',
        }}
      >
        <div style={{ fontSize: 'var(--fs-body-lg)', fontWeight: 800 }}>Well, that wasn't in the budget.</div>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', margin: 0, maxWidth: 420, fontWeight: 500 }}>
          Something went wrong and this page can't recover on its own. Your numbers aren't saved anywhere, so starting over is safe.
        </p>
        <button
          type="button"
          onClick={this.handleStartOver}
          style={{
            padding: '12px 28px',
            border: 'none',
            borderRadius: 'var(--radius-button)',
            background: 'var(--text-primary)',
            color: 'var(--bg-dark-1)',
            fontSize: 'var(--fs-body)',
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Start over
        </button>
      </div>
    )
  }
}
