// Shared contract for the product-URL parse endpoint. The frontend keeps its
// own mirror of these shapes in `src/lib/productUrl.ts` — the two live in
// different tsconfig projects (Node function vs. DOM app), so the small
// interface is duplicated rather than imported across the boundary. Keep them
// in step: a field added here is added there too.

/** Why a parse didn't yield a usable result. Each maps to friendly frontend copy. */
export type ParseReason =
  | 'invalid-url' // not an https URL, or points at a private/loopback host
  | 'no-price-found' // page fetched, but no name/price could be extracted
  | 'blocked' // retailer refused us (403/429/503, bot wall)
  | 'timeout' // retailer took too long
  | 'not-gbp' // a price was found, but in a non-GBP currency (the app is GBP-only)
  | 'unreachable' // network error, or the endpoint itself isn't deployed (static/self-host)

/** Which extraction tier produced the fields — the metric for whether a paid fallback is ever needed. */
export type ExtractSource = 'json-ld' | 'og' | 'microdata' | 'title'

/**
 * Optional, non-sensitive diagnostics returned when the request carries
 * `?debug=1`. Intended for working through a range of URLs on the preview — it
 * exposes *why* a URL failed (upstream status, which structured data was
 * present) without ever returning page content. Gate or drop this before the
 * feature is publicised (Phase 3).
 */
export interface ParseDebug {
  /** The HTTP status the retailer returned to the function (undefined on a network-level failure). */
  upstreamStatus?: number
  /** The URL actually fetched after following redirects. */
  finalUrl?: string
  /** Size of the fetched HTML, in bytes. */
  htmlBytes?: number
  /** Whether the raw HTML contained any `application/ld+json` block. */
  hadJsonLd?: boolean
  /** Whether one of those blocks was a schema.org Product. */
  hadProductJsonLd?: boolean
  /** Whether an OG/product price meta tag was present. */
  hadOgPrice?: boolean
}

export interface ParseSuccess {
  ok: true
  /** Product name, or `null` when only a price was found. */
  name: string | null
  /** Cleaned numeric price string (e.g. `"299.00"`), or `null` when only a name was found. */
  price: string | null
  /** Detected currency (best-effort). `null` when unknown — treated as GBP by the app. */
  currency: string | null
  /** Product image URL when the page exposed one. Not currently rendered by the frontend. */
  image: string | null
  source: ExtractSource
  /** Bare retailer hostname, e.g. `"currys.co.uk"`. */
  retailer: string
  debug?: ParseDebug
}

export interface ParseFailure {
  ok: false
  reason: ParseReason
  debug?: ParseDebug
}

export type ParseResult = ParseSuccess | ParseFailure

/** Thrown internally to carry a `ParseReason` up to the orchestrator, which maps it to a `ParseFailure`. */
export class ParseError extends Error {
  reason: ParseReason
  /** The upstream HTTP status, when the failure came from a response (e.g. a 403 bot wall). */
  status?: number
  constructor(reason: ParseReason, status?: number) {
    super(reason)
    this.name = 'ParseError'
    this.reason = reason
    this.status = status
  }
}
