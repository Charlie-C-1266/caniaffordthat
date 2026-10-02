// Shared constraints for the form fields that a "Copy result link" URL
// round-trips. The inputs that capture these values and `urlState`'s
// hydration of a shared link both read the rules below, so a crafted or
// stale link can't carry a value the UI itself would have refused.

/**
 * Whether a raw money-field string is negative. `MoneyInput` clamps these to
 * "0" at the keystroke and on paste so the figure on screen can never
 * disagree with the one `num()` hands the maths (see #30/#33). The
 * `startsWith` test is what catches "-" and "-0", which `Number(raw) < 0`
 * alone does not.
 */
export function isNegativeMoney(raw: string): boolean {
  return raw.trimStart().startsWith('-') || Number(raw) < 0
}

/**
 * Whether a raw money-field string is a figure the app is willing to hold:
 * non-blank, finite and not negative. A blank field is perfectly legitimate
 * while typing — the user has cleared it — but carries no figure in a shared
 * link, so hydration falls back to the field's default rather than displaying
 * nothing while the maths uses 0.
 *
 * Note `Number('')` and `Number(' ')` are both `0`, so the blank check has to
 * come before the numeric one.
 */
export function isMoneyValue(raw: string): boolean {
  const value = raw.trim()
  if (value === '') return false
  if (isNegativeMoney(value)) return false
  return Number.isFinite(Number(value))
}

/**
 * Longest goal title the name input accepts, and the cap a shared link's
 * `itemName` is truncated to. Comfortably fits a real title ("Kitchen
 * extension deposit" is 26), while keeping an unbounded link from stretching
 * the result headline and card (`StandardResultCard`, `VehicleResultCard`).
 */
export const ITEM_NAME_MAX_LENGTH = 60

/**
 * Normalises a goal title from an untrusted source. The name is rendered as
 * React text, so there's no injection to escape here — this is about length
 * and legibility: strip control characters (C0, DEL and C1, which can't be
 * typed into the field and would render as blanks or reorder the line), then
 * cap the length.
 *
 * Both steps work on code points rather than UTF-16 code units, so a title
 * ending in an emoji or other astral character is never cut in half into a
 * lone surrogate (which renders as a replacement glyph). That makes this
 * marginally more generous than the input's own `maxLength`, which the
 * browser counts in code units — erring towards keeping a character whole.
 */
export function sanitiseItemName(raw: string): string {
  return Array.from(raw)
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0
      return code > 0x1f && code !== 0x7f && !(code >= 0x80 && code <= 0x9f)
    })
    .slice(0, ITEM_NAME_MAX_LENGTH)
    .join('')
}
