import { useState } from 'react'
import { useCalculator } from '../../state/calculatorContext'
import { copyToClipboard } from '../../lib/clipboard'
import { buildShareParams } from '../../lib/urlState'

const COPIED_LABEL_DURATION_MS = 2000

interface ResultActionsProps {
  /** Jumps back to the goal picker (flow index 0 in every flow). */
  scrollToIndex: (index: number) => void
}

/** The result card's action row: copy a shareable link to this result, or start again from the goal picker. */
export function ResultActions({ scrollToIndex }: ResultActionsProps) {
  const { state } = useCalculator()
  const [copied, setCopied] = useState(false)

  const copyLink = async () => {
    const params = buildShareParams(state)
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`
    const succeeded = await copyToClipboard(url)
    if (succeeded) {
      setCopied(true)
      setTimeout(() => setCopied(false), COPIED_LABEL_DURATION_MS)
    }
  }

  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <button
        type="button"
        onClick={copyLink}
        style={{
          flex: 1,
          padding: 14,
          border: '1.5px solid rgba(245,243,255,0.25)',
          borderRadius: 'var(--radius-button)',
          background: 'transparent',
          color: 'var(--text-primary)',
          fontSize: 'var(--fs-body)',
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {copied ? 'Link copied ✓' : 'Copy result link'}
      </button>
      <button
        type="button"
        onClick={() => scrollToIndex(0)}
        style={{
          flex: 1,
          padding: 14,
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
        Pick another goal
      </button>
    </div>
  )
}
