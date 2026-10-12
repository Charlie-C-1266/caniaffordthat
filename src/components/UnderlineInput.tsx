import { useState, type KeyboardEvent } from 'react'

interface UnderlineInputProps {
  /** `id` for the `<input>`, so a `<FieldLabel htmlFor>` can point at it. */
  id?: string
  value: string
  onChange: (value: string) => void
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void
  placeholder?: string
  fontSize: string
  accentColor: string
  /** Border color while unfocused. Defaults to the neutral underline token. */
  idleColor?: string
  /** Caps how much the field will accept, matching the cap hydration applies to the same value. */
  maxLength?: number
}

/**
 * A borderless, bottom-underlined text input whose underline switches to the
 * active mode's accent color on focus. Used for the item-name field.
 */
export function UnderlineInput({
  id,
  value,
  onChange,
  onKeyDown,
  placeholder,
  fontSize,
  accentColor,
  idleColor = 'var(--input-underline)',
  maxLength,
}: UnderlineInputProps) {
  const [focused, setFocused] = useState(false)

  return (
    <input
      id={id}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
      maxLength={maxLength}
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
