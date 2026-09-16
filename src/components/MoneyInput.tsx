import { useState, type KeyboardEvent } from 'react'

// `min={0}` only affects the browser's validity styling — a typed or pasted
// negative still lands in the value, and num() would then silently floor it
// to 0 downstream, leaving the displayed figure disagreeing with the one the
// calculations use. Clamp to "0" here so the two can never diverge.
const clampNegative = (raw: string): string => (raw.startsWith('-') || Number(raw) < 0 ? '0' : raw)

interface MoneyInputProps {
  value: string
  onChange: (value: string) => void
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void
  accentColor: string
  /** Border color while unfocused. Pass the same value as `accentColor` for fields that should always show the accent (the hero price/take-home fields don't change on focus). */
  idleColor?: string
  fontSize: string
  fontWeight?: number
  fontFamily?: string
  borderWidth?: string
  prefixFontSize: string
  /** Nudges the "£" glyph to align with the input's baseline — varies per field size. */
  prefixTop: number
  paddingBottom: number
  paddingLeft: number
}

/**
 * A borderless, bottom-underlined numeric input with a static "£" prefix.
 * Reused (with different sizing) for the item price, take-home pay, and the
 * six optional budget fields.
 */
export function MoneyInput({
  value,
  onChange,
  onKeyDown,
  accentColor,
  idleColor = accentColor,
  fontSize,
  fontWeight = 800,
  fontFamily = 'var(--font-mono)',
  borderWidth = 'var(--border-width-underline-thick)',
  prefixFontSize,
  prefixTop,
  paddingBottom,
  paddingLeft,
}: MoneyInputProps) {
  const [focused, setFocused] = useState(false)

  return (
    <div style={{ position: 'relative' }}>
      <span
        style={{
          position: 'absolute',
          left: 0,
          top: prefixTop,
          fontSize: prefixFontSize,
          fontWeight: 800,
          color: 'var(--text-tertiary-dim)',
        }}
      >
        £
      </span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(clampNegative(e.target.value))}
        onKeyDown={(e) => {
          // Block the minus sign at the keystroke, so "-500" can't be typed at
          // all — the paste path is covered by the onChange clamp instead.
          if (e.key === '-') e.preventDefault()
          onKeyDown?.(e)
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="0"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: `0 0 ${paddingBottom}px ${paddingLeft}px`,
          fontSize,
          fontWeight,
          border: 'none',
          borderBottom: `${borderWidth} solid ${focused ? accentColor : idleColor}`,
          background: 'transparent',
          color: 'var(--text-primary)',
          fontFamily,
          outline: 'none',
        }}
      />
    </div>
  )
}
