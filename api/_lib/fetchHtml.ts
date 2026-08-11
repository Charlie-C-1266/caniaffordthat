import { lookup } from 'node:dns/promises'
import { ParseError } from './types'
import { isIpLiteral, isPrivateAddress, stripBrackets } from './validateUrl'

// SSRF-safe fetch of a retailer page. Redirects are followed manually (not by
// `fetch`) so every hop is re-validated, and the response body is read through
// a size cap so a hostile or huge page can't exhaust the function's memory.

const MAX_REDIRECTS = 3
const TIMEOUT_MS = 8000
const MAX_BYTES = 2_000_000 // ~2 MB — product pages with a price in the HTML are far smaller

// As close to a real desktop Chrome request as fetch allows. Retailers serve
// JSON-LD/OG for Google's crawler, but many gate it behind a browser-like
// fingerprint. This won't beat a full Akamai/Cloudflare bot-management
// challenge (those also fingerprint TLS/IP), but it clears the simpler filters.
const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-GB,en;q=0.9',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
}

/** What a completed fetch yields — the HTML plus the diagnostics the debug mode surfaces. */
export interface FetchedPage {
  html: string
  status: number
  finalUrl: string
}

/** Resolves the host and throws `ParseError('blocked')` if it (or any resolved address) is private. */
async function assertPublicHost(url: URL): Promise<void> {
  const host = url.hostname.toLowerCase()
  if (isIpLiteral(host)) {
    if (isPrivateAddress(stripBrackets(host))) throw new ParseError('blocked')
    return
  }
  let addresses: { address: string }[]
  try {
    addresses = await lookup(host, { all: true })
  } catch {
    throw new ParseError('unreachable')
  }
  if (addresses.length === 0) throw new ParseError('unreachable')
  for (const { address } of addresses) {
    if (isPrivateAddress(address)) throw new ParseError('blocked')
  }
}

/** Reads a response body as UTF-8, stopping once `MAX_BYTES` have been received. */
async function readCapped(res: Response): Promise<string> {
  if (!res.body) return res.text()
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    total += value.length
    chunks.push(value)
    if (total > MAX_BYTES) {
      await reader.cancel()
      break
    }
  }
  return Buffer.concat(chunks).toString('utf8')
}

/**
 * Fetches the HTML at `startUrl`, following up to `MAX_REDIRECTS` redirects and
 * re-validating the host on every hop. Throws `ParseError` with a `blocked`,
 * `timeout`, or `unreachable` reason on failure; a `blocked` from a bot wall
 * carries the upstream status so the debug mode can report it.
 */
export async function fetchProductHtml(startUrl: URL): Promise<FetchedPage> {
  let url = startUrl

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(url)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    let res: Response
    try {
      res = await fetch(url, { redirect: 'manual', signal: controller.signal, headers: BROWSER_HEADERS })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw new ParseError('timeout')
      throw new ParseError('unreachable')
    } finally {
      clearTimeout(timer)
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      if (!location) throw new ParseError('unreachable', res.status)
      let next: URL
      try {
        next = new URL(location, url)
      } catch {
        throw new ParseError('unreachable', res.status)
      }
      if (next.protocol !== 'https:') throw new ParseError('blocked', res.status)
      url = next
      continue
    }

    // Bot walls and rate limits surface as these statuses — fail fast with a clear reason.
    if (res.status === 403 || res.status === 429 || res.status === 503) throw new ParseError('blocked', res.status)
    if (!res.ok) throw new ParseError('unreachable', res.status)

    return { html: await readCapped(res), status: res.status, finalUrl: url.href }
  }

  throw new ParseError('unreachable') // exhausted the redirect budget
}
