// @vitest-environment node
// Node environment (not jsdom) because this reads README.md off disk; nothing
// here needs a DOM.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { CONTACT_EMAIL, contactMailto } from './contact'

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url))

describe('CONTACT_EMAIL', () => {
  it('is the project address', () => {
    expect(CONTACT_EMAIL).toBe('hello@caniaffordthat.co.uk')
  })
})

describe('contactMailto', () => {
  it('builds a mailto: URL for the shared address', () => {
    expect(contactMailto('Salary methodology')).toBe('mailto:hello@caniaffordthat.co.uk?subject=Salary%20methodology')
  })

  // The four live subjects, pinned byte-for-byte against the percent-escapes
  // that were previously hand-written at each call site. These are what proves
  // the refactor changed no href: if encodeURIComponent ever produced
  // something different from the old literals, every one of these would fail.
  it.each([
    ['Can I Afford That? feedback', 'mailto:hello@caniaffordthat.co.uk?subject=Can%20I%20Afford%20That%3F%20feedback'],
    ['Helpful reading suggestion', 'mailto:hello@caniaffordthat.co.uk?subject=Helpful%20reading%20suggestion'],
    ['Salary methodology', 'mailto:hello@caniaffordthat.co.uk?subject=Salary%20methodology'],
    ['Vehicle methodology', 'mailto:hello@caniaffordthat.co.uk?subject=Vehicle%20methodology'],
  ])('encodes %j exactly as the hand-written href did', (subject, expected) => {
    expect(contactMailto(subject)).toBe(expected)
  })

  // A subject carrying a query delimiter must not be able to tack extra
  // mailto: headers (cc, bcc, body) onto the URL — the reason the helper
  // escapes rather than interpolating raw.
  it('escapes characters that would otherwise break out of the query string', () => {
    expect(contactMailto('a?b&c=d#e')).toBe('mailto:hello@caniaffordthat.co.uk?subject=a%3Fb%26c%3Dd%23e')
    expect(contactMailto('&cc=someone@example.com')).not.toContain('&cc=')
  })

  it('handles an empty subject without emitting a stray escape', () => {
    expect(contactMailto('')).toBe('mailto:hello@caniaffordthat.co.uk?subject=')
  })
})

describe('README.md', () => {
  // README.md can't import the constant, so this is what stops its copy
  // drifting from the app's.
  it('names the same contact address as CONTACT_EMAIL', () => {
    const readme = readFileSync(join(REPO_ROOT, 'README.md'), 'utf8')
    expect(readme).toContain(CONTACT_EMAIL)
  })

  it('names no other @caniaffordthat.co.uk address', () => {
    const readme = readFileSync(join(REPO_ROOT, 'README.md'), 'utf8')
    const addresses = new Set(readme.match(/[\w.+-]+@caniaffordthat\.co\.uk/g) ?? [])
    expect([...addresses]).toEqual([CONTACT_EMAIL])
  })
})
