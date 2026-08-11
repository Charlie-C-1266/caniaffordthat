import { ParseError } from './types'

// URL validation + SSRF guards for the fetch endpoint. A user-supplied URL that
// we then fetch server-side is a textbook Server-Side Request Forgery target
// (http://169.254.169.254/ metadata, internal hosts, redirect tricks), so this
// is deliberately strict: https only, and no private/loopback/link-local hosts.
// The runtime DNS check lives in fetchHtml.ts (it re-checks every redirect hop);
// the pure checks here are unit-tested without touching the network.

/** True for a bare IP literal (dotted-quad IPv4, or a bracketed `[::1]` IPv6). */
export function isIpLiteral(host: string): boolean {
  if (host.startsWith('[') && host.endsWith(']')) return true
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host)
}

/** Strips the surrounding brackets from a bracketed IPv6 hostname. */
export function stripBrackets(host: string): string {
  return host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host
}

/**
 * Whether an IP address is in a private, loopback, link-local, or otherwise
 * non-public range — the set we must never fetch from. Covers both IPv4 and the
 * common IPv6 cases (including IPv4-mapped addresses like `::ffff:10.0.0.1`).
 */
export function isPrivateAddress(ip: string): boolean {
  if (ip.includes(':')) {
    const lower = ip.toLowerCase()
    if (lower === '::1' || lower === '::') return true
    if (lower.startsWith('fe80')) return true // link-local
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true // unique-local fc00::/7
    const mapped = lower.match(/(?:::ffff:)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)
    if (mapped) return isPrivateAddress(mapped[1])
    return false
  }

  const parts = ip.split('.').map((p) => Number(p))
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return false
  const [a, b] = parts
  if (a === 0 || a === 10 || a === 127) return true // "this network", private, loopback
  if (a === 169 && b === 254) return true // link-local + cloud metadata (169.254.169.254)
  if (a === 172 && b >= 16 && b <= 31) return true // private
  if (a === 192 && b === 168) return true // private
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT (100.64.0.0/10)
  if (a >= 224) return true // multicast / reserved
  return false
}

/**
 * Parses and validates a user-supplied product URL, returning a `URL` on
 * success or throwing `ParseError('invalid-url')`. Enforces https, rejects
 * localhost, and rejects IP-literal hosts that resolve to a private range.
 * Hostnames are additionally DNS-checked at fetch time.
 */
export function validateProductUrl(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    throw new ParseError('invalid-url')
  }

  if (url.protocol !== 'https:') throw new ParseError('invalid-url')

  const host = url.hostname.toLowerCase()
  if (!host || host === 'localhost' || host.endsWith('.localhost')) throw new ParseError('invalid-url')

  if (isIpLiteral(host) && isPrivateAddress(stripBrackets(host))) throw new ParseError('invalid-url')

  return url
}
