import { useState, type KeyboardEvent } from 'react'

interface UnderlineInputProps {
  value: string
  onChange: (value: string) => void
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void
  placeholder?: string
  fontSize: string
  accentColor: string
  /** Border color while unfocused. Defaults to the neutral underline token. */
  idleColor?: string
}

/**
 * A borderless, bottom-underlined text input whose underline switches to the
 * active mode's accent color on focus. Used for the item-name field.
 */
export function UnderlineInput({
  value,
  onChange,
  onKeyDown,
  placeholder,
  fontSize,
  accentColor,
  idleColor = 'var(--input-underline)',
}: UnderlineInputProps) {
  const [focused, setFocused] = useState(false)

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
      style={{
        width: '100%',
        boxSizing: 'border-box',
        padding: '0 0 12px',
        fontSize,
        fontWeight: 600,
        border: 'none',
        borderBottom: `var(--border-width-underline) solid ${focused ? accentColor : idleColor}`,
        background: 'transparent',
        color: 'var(--text-primary)',
        fontFamily: 'inherit',
        outline: 'none',
      }}
    />
  )
}
