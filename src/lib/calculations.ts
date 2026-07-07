// Pure, framework-agnostic formulas ported from the design prototype's
// `class Component extends DCLogic` block. Unlike the prototype — which
// anchored "now" to a fixed reference date for demo purposes — the date
// helpers here anchor to the real current date, per the design doc's
// explicit note that this needed wiring up before building.

/** Formats a number as whole-pound GBP, e.g. `1234.5` -> `"£1,235"`. Falsy input -> `"£0"`. */
export function fmt(n: number): string {
  return (n || 0).toLocaleString('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  })
}

/** Parses a form field's value, treating anything non-positive or non-finite as 0. */
export function num(v: number | string): number {
  const n = Number(v)
  return isFinite(n) && n > 0 ? n : 0
}

/**
 * Months to reach `target` saving `contribution` per month, compounding
 * monthly at `annualRatePct` APR. Returns `Infinity` ("never") past a cap of
 * 600 months, and `0` for an already-met target.
 */
export function monthsToSave(target: number, contribution: number, annualRatePct: number): number {
  if (target <= 0) return 0
  if (contribution <= 0) return Infinity
  const i = annualRatePct / 100 / 12
  let n = 0
  let bal = 0
  while (bal < target && n < 600) {
    n++
    bal = bal * (1 + i) + contribution
  }
  return n >= 600 ? Infinity : n
}

/**
 * Monthly contribution required to reach `target` in exactly `n` months
 * (floored at 1), via the annuity formula at `annualRatePct` APR.
 */
export function contributionForGoal(target: number, n: number, annualRatePct: number): number {
  if (target <= 0) return 0
  n = Math.max(1, n)
  const i = annualRatePct / 100 / 12
  if (i === 0) return target / n
  return (target * i) / (Math.pow(1 + i, n) - 1)
}

/**
 * Monthly payment to amortize `principal` over `n` months (floored at 1) at
 * `annualRatePct` APR, via the standard loan amortization formula.
 */
export function paymentForFinance(principal: number, n: number, annualRatePct: number): number {
  if (principal <= 0) return 0
  n = Math.max(1, n)
  const i = annualRatePct / 100 / 12
  if (i === 0) return principal / n
  return (principal * i) / (1 - Math.pow(1 + i, -n))
}

/** Midnight on the 1st of the current month — the anchor all the date helpers below count months from. */
function startOfCurrentMonth(): Date {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

/** "Month Year" label for `n` months from now, e.g. "September 2027". */
export function addMonths(n: number): string {
  const d = startOfCurrentMonth()
  d.setMonth(d.getMonth() + n)
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

/** "YYYY-MM" for `n` months from now — matches the `<input type="month">` format. */
export function isoFromMonths(n: number): string {
  const d = startOfCurrentMonth()
  d.setMonth(d.getMonth() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Number of months from now until an "YYYY-MM" goal date. Clamped to a
 * minimum of 1 (the goal-date picker's own minimum is next month anyway).
 */
export function monthsFromIso(iso: string): number {
  const [y, m] = iso.split('-').map(Number)
  const now = startOfCurrentMonth()
  return Math.max(1, (y - now.getFullYear()) * 12 + (m - (now.getMonth() + 1)))
}

/**
 * "MM-YYYY" for `n` months from now, e.g. "08-2026" — used by the goal-date
 * field instead of a native `<input type="month">`, which clamps/snaps back
 * to a fallback value the moment the field is cleared or made temporarily
 * invalid while typing.
 */
export function monthYearFromMonths(n: number): string {
  const d = startOfCurrentMonth()
  d.setMonth(d.getMonth() + n)
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`
}

/**
 * Masks free text to the "MM-YYYY" shape as it's typed: keeps only digits (at
 * most MMYYYY), and inserts the hyphen as soon as the two-digit month is
 * complete. Drops letters, stray separators, and overflow digits, so the
 * goal-date field can only ever hold MM-YYYY-shaped input — range validity is
 * a separate concern (see `monthsFromMonthYear`). Callers should suppress the
 * trailing hyphen while the user is deleting so it isn't sticky to backspace.
 */
export function formatMonthYearDraft(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 6)
  if (digits.length < 2) return digits
  return `${digits.slice(0, 2)}-${digits.slice(2)}`
}

/**
 * Parses "MM-YYYY" into months from now. Returns null (not a clamped
 * fallback) for anything that isn't a fully valid month/year, so callers can
 * tell "still being typed" apart from "a real date" and decide what to do —
 * unlike `monthsFromIso`, this never silently coerces bad input into NaN.
 */
export function monthsFromMonthYear(value: string): number | null {
  const match = /^(\d{1,2})-(\d{4})$/.exec(value.trim())
  if (!match) return null
  const month = Number(match[1])
  const year = Number(match[2])
  if (month < 1 || month > 12) return null
  const now = startOfCurrentMonth()
  return (year - now.getFullYear()) * 12 + (month - (now.getMonth() + 1))
}
