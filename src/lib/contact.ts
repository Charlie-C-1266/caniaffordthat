/**
 * The project's single contact address. Previously typed out by hand in the
 * footer and all three docs pages (seven copies in all, counting the visible
 * text beside each link), so a change of address meant finding every copy and
 * a mistyped one would quietly send feedback nowhere.
 *
 * README.md can't import this. `contact.test.ts` reads the README and asserts
 * it still names the same address, so the two can't drift.
 */
export const CONTACT_EMAIL = 'hello@caniaffordthat.co.uk'

/**
 * A `mailto:` URL for {@link CONTACT_EMAIL} with `subject` pre-filled.
 *
 * The subject is escaped with `encodeURIComponent` rather than hand-written
 * percent-escapes, so a subject containing `?`, `&` or `#` can't break out of
 * the query string.
 */
export function contactMailto(subject: string): string {
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`
}
