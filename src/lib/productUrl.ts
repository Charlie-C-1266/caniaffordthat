// Client side of the paste-a-product-link feature. Talks to the
// `/api/parse-product` serverless function and maps the outcome to friendly UI
// copy. The response shapes mirror `api/_lib/types.ts` — the two live in
// separate tsconfig projects (DOM app vs. Node function), so the contract is
// duplicated rather than imported across the boundary.
//
// Everything here degrades gracefully: on a static/self-hosted build the
// endpoint doesn't exist, so the fetch 404s or returns HTML. That's treated
// exactly like a failed parse — the user just types the price as they do today.

export type ProductParseReason = 'invalid-url' | 'no-price-found' | 'blocked' | 'timeout' | 'not-gbp' | 'unreachable'

export interface ProductParseSuccess {
  ok: true
  name: string | null
  price: string | null
  currency: string | null
  image: string | null
  source: string
  retailer: string
}

export interface ProductParseFailure {
  ok: false
  reason: ProductParseReason
}

export type ProductParseResult = ProductParseSuccess | ProductParseFailure

/** A cheap client-side sniff test — is this even worth sending to the endpoint? */
export function looksLikeProductUrl(value: string): boolean {
  return /^https?:\/\/[^\s.]+\.[^\s]{2,}/i.test(value.trim())
}

/**
 * Asks the endpoint to read a product page. Resolves to a typed result and
 * never rejects: network errors and a missing endpoint both become
 * `{ ok: false, reason: 'unreachable' }`.
 */
export async function parseProductUrl(url: string): Promise<ProductParseResult> {
  const trimmed = url.trim()
  if (!looksLikeProductUrl(trimmed)) return { ok: false, reason: 'invalid-url' }

  try {
    const res = await fetch(`/api/parse-product?url=${encodeURIComponent(trimmed)}`, {
      // Ask for JSON so a static host's SPA fallback returns 404 rather than index.html.
      headers: { Accept: 'application/json' },
    })
    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('application/json')) return { ok: false, reason: 'unreachable' }

    const data: unknown = await res.json()
    if (isParseResult(data)) return data
    return { ok: false, reason: 'unreachable' }
  } catch {
    return { ok: false, reason: 'unreachable' }
  }
}

/** The single line shown to the user when a parse doesn't fully succeed. */
export function friendlyFailure(reason: ProductParseReason): string {
  switch (reason) {
    case 'invalid-url':
      return "That doesn't look like a link — paste a product page URL, or just type the price below."
    case 'not-gbp':
      return "That page's price isn't in pounds — pop the £ amount in below."
    case 'blocked':
      return "That shop won't let us read its page — just type the price below."
    case 'timeout':
      return 'That page took too long to load — just type the price below.'
    default:
      return "Couldn't read that page — just pop the price in below."
  }
}

function isParseResult(data: unknown): data is ProductParseResult {
  return typeof data === 'object' && data !== null && typeof (data as { ok?: unknown }).ok === 'boolean'
}
