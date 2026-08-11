import { useEffect, useRef, useState } from 'react'
import { FieldLabel } from './FieldLabel'
import { Icon } from './Icon'
import {
  friendlyFailure,
  looksLikeProductUrl,
  parseProductUrl,
  type ProductParseSuccess,
} from '../lib/productUrl'

// Wait for typing/pasting to settle before hitting the endpoint, so a pasted
// URL fires one request rather than one per keystroke.
const DEBOUNCE_MS = 700

type Status = 'idle' | 'loading' | 'done' | 'error'

interface ProductUrlFieldProps {
  accentColor: string
  /** Called with the parsed product when a lookup succeeds; the parent decides which fields to fill. */
  onParsed: (result: ProductParseSuccess) => void
}

/**
 * Optional "paste a product link" field shown above the price for product-shaped
 * goals. On a successful parse it hands the result to the parent to autofill the
 * name/price; on any failure it shows one quiet line and leaves the manual
 * inputs untouched — so the feature only ever accelerates, never blocks.
 */
export function ProductUrlField({ accentColor, onParsed }: ProductUrlFieldProps) {
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')
  const [focused, setFocused] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const lastLookup = useRef('')

  useEffect(() => () => clearTimeout(timer.current), [])

  const run = async (value: string) => {
    const trimmed = value.trim()
    if (!looksLikeProductUrl(trimmed) || trimmed === lastLookup.current) return
    lastLookup.current = trimmed
    setStatus('loading')
    setMessage('Reading that page…')

    const result = await parseProductUrl(trimmed)
    if (result.ok && (result.name || result.price)) {
      setStatus('done')
      setMessage(result.retailer ? `Filled in from ${result.retailer}` : 'Filled in from that link')
      onParsed(result)
    } else {
      setStatus('error')
      setMessage(friendlyFailure(result.ok ? 'no-price-found' : result.reason))
    }
  }

  const handleChange = (value: string) => {
    setUrl(value)
    setStatus('idle')
    setMessage('')
    lastLookup.current = ''
    clearTimeout(timer.current)
    if (looksLikeProductUrl(value)) timer.current = setTimeout(() => void run(value), DEBOUNCE_MS)
  }

  const handleBlur = () => {
    setFocused(false)
    clearTimeout(timer.current)
    if (looksLikeProductUrl(url)) void run(url)
  }

  const statusColor =
    status === 'done' ? accentColor : status === 'error' ? 'var(--text-tertiary)' : 'var(--text-tertiary-dim)'

  return (
    <div style={{ marginBottom: 30 }}>
      <FieldLabel>
        Paste a product link <span style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}>· optional</span>
      </FieldLabel>
      <input
        type="url"
        inputMode="url"
        value={url}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={handleBlur}
        placeholder="e.g. https://www.currys.co.uk/…"
        aria-label="Paste a product link to fill in the name and price"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '0 0 12px',
          fontSize: 'var(--fs-input-sm)',
          fontWeight: 600,
          border: 'none',
          borderBottom: `var(--border-width-underline) solid ${focused ? accentColor : 'var(--input-underline)'}`,
          background: 'transparent',
          color: 'var(--text-primary)',
          fontFamily: 'inherit',
          outline: 'none',
        }}
      />
      {message && (
        <div
          role="status"
          aria-live="polite"
          style={{
            marginTop: 8,
            fontSize: 'var(--fs-label)',
            fontWeight: 600,
            color: statusColor,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {status === 'done' && <Icon name="check" size={14} color={accentColor} strokeWidth={2.5} />}
          {message}
        </div>
      )}
    </div>
  )
}
