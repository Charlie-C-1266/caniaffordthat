import { useEffect, useState, type KeyboardEvent } from 'react'
import { formatMonthYearDraft, monthYearFromMonths, monthsFromMonthYear } from '../lib/calculations'

interface MonthYearInputProps {
  /** Committed value, in months from now. */
  months: number
  /** Earliest value that counts as valid, in months from now (the goal-date picker's floor is "next month"). */
  minMonths: number
  accentColor: string
  onChange: (months: number) => void
}

/**
 * A masked "MM-YYYY" text field for the goal-date input. Deliberately not a
 * native `<input type="month">` — those round-trip an invalid/cleared value
 * back through as NaN, which snaps the displayed date to a fallback (its
 * `min` bound) the moment you try to clear the field to type a new one,
 * making it impossible to actually change. Input is masked to the MM-YYYY
 * shape (see `formatMonthYearDraft`); it keeps its own draft text while
 * typing and only commits once it's a fully valid, in-range date.
 */
export function MonthYearInput({ months, minMonths, accentColor, onChange }: MonthYearInputProps) {
  const [draft, setDraft] = useState(() => monthYearFromMonths(months))
  const [focused, setFocused] = useState(false)

  // Stay in sync with external changes (e.g. "Start over") but only while
  // the user isn't actively typing, so we don't clobber an in-progress edit.
  useEffect(() => {
    if (!focused) setDraft(monthYearFromMonths(months))
  }, [months, focused])

  const commitIfValid = (value: string) => {
    const parsed = monthsFromMonthYear(value)
    if (parsed !== null && parsed >= minMonths) onChange(parsed)
  }

  const handleChange = (value: string) => {
    let masked = formatMonthYearDraft(value)
    // The mask auto-adds the hyphen after the two-digit month. When the user is
    // deleting and has just removed that separator, don't stickily re-add it —
    // let the backspace fall through to the month digit instead.
    if (value.length < draft.length && masked.endsWith('-') && !value.endsWith('-')) {
      masked = masked.slice(0, -1)
    }
    setDraft(masked)
    commitIfValid(masked)
  }

  const handleBlur = () => {
    setFocused(false)
    // Snap back to the last valid committed value if what's left isn't one —
    // e.g. the field was left cleared or mid-edit.
    setDraft(monthYearFromMonths(months))
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') commitIfValid(draft)
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder="MM-YYYY"
      maxLength={7}
      value={draft}
      onChange={(e) => handleChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      style={{
        width: '100%',
        boxSizing: 'border-box',
        padding: '12px 14px',
        fontSize: 16,
        fontWeight: 600,
        border: `var(--border-width-card) solid ${focused ? accentColor : 'var(--input-underline)'}`,
        borderRadius: 10,
        background: 'var(--tile-bg)',
        color: 'var(--text-primary)',
        fontFamily: 'inherit',
        outline: 'none',
      }}
    />
  )
}
