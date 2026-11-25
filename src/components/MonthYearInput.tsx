import { useId, useState, type KeyboardEvent } from 'react'
import { formatMonthYearDraft, monthYearError, monthYearFromMonths, monthsFromMonthYear } from '../lib/calculations'

interface MonthYearInputProps {
  /** `id` for the `<input>`, so the goal-date `<FieldLabel htmlFor>` can point at it. */
  id?: string
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
 *
 * A complete date it won't commit is now said out loud (#287). It used to be
 * dropped in silence: typing `01-2020` left `01-2020` on screen while the
 * result was still worked out from the previous date, and on blur the draft
 * quietly snapped back with no explanation. Nothing marked the field invalid
 * for assistive tech either, so a screen-reader user was never told — WCAG 2.2
 * SC 3.3.1 Error Identification (A).
 *
 * The message **clears on blur**, along with `aria-invalid`, rather than
 * lingering to explain the snap-back. The snap-back restores a valid date, so
 * a message left behind would be describing a value no longer on screen —
 * worse than none. While the field has focus the message stays put, which is
 * where it is needed, and the field is only ever left by blurring.
 */
export function MonthYearInput({ id, months, minMonths, accentColor, onChange }: MonthYearInputProps) {
  const [draft, setDraft] = useState(() => monthYearFromMonths(months))
  const [focused, setFocused] = useState(false)
  const errorId = useId()

  // Stay in sync with external changes (e.g. "Start over") but only while
  // the user isn't actively typing, so we don't clobber an in-progress edit.
  // Adjusted during render rather than in an effect, React's pattern for state
  // that follows a prop, which saves the extra render an effect would cost.
  // Blurring needs nothing here: handleBlur snaps the draft back itself.
  const [syncedMonths, setSyncedMonths] = useState(months)
  if (months !== syncedMonths && !focused) {
    setSyncedMonths(months)
    setDraft(monthYearFromMonths(months))
  }

  const error = monthYearError(draft, minMonths)

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
    // e.g. the field was left cleared or mid-edit. This also clears any error,
    // since the message is derived from the draft.
    setDraft(monthYearFromMonths(months))
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') commitIfValid(draft)
  }

  return (
    <>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder="MM-YYYY"
        maxLength={7}
        value={draft}
        // Absent rather than "false" while valid: assistive tech handles a
        // missing attribute uniformly, which is the same choice ProgressRail
        // makes for aria-current.
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
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
      {/*
       * The live region is always in the DOM, with only its text appearing and
       * disappearing. A region added to the page at the same moment it gains
       * content is unreliably announced; one that is already there is not.
       *
       * `--text-secondary` rather than the dimmer `--text-tertiary` the plain
       * captions use: this is the one caption a user has to be able to read.
       * It is an existing token, so no new colour is introduced.
       */}
      <div
        id={errorId}
        // `role="status"` implies a polite live region; `aria-live` is stated
        // alongside it because older assistive tech honours one or the other.
        role="status"
        aria-live="polite"
        style={{
          marginTop: 8,
          minHeight: error ? undefined : 0,
          fontSize: 'var(--fs-label)',
          fontWeight: 600,
          lineHeight: 1.45,
          color: 'var(--text-secondary)',
        }}
      >
        {error}
      </div>
    </>
  )
}
