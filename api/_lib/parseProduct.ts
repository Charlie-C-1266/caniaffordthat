import { ParseError, type ParseResult } from './types'
import { validateProductUrl } from './validateUrl'
import { fetchProductHtml } from './fetchHtml'
import { extractProduct } from './extract'

/**
 * End-to-end: validate the URL, fetch the page (SSRF-safe), run the extraction
 * waterfall, and map the outcome onto the response contract. Never throws — any
 * failure becomes a `{ ok: false, reason }`, so the handler stays trivial.
 */
export async function parseProductFromUrl(raw: string): Promise<ParseResult> {
  let url: URL
  try {
    url = validateProductUrl(raw)
  } catch {
    return { ok: false, reason: 'invalid-url' }
  }

  let html: string
  try {
    html = await fetchProductHtml(url)
  } catch (err) {
    return { ok: false, reason: err instanceof ParseError ? err.reason : 'unreachable' }
  }

  const extracted = extractProduct(html)
  if (!extracted || (!extracted.name && !extracted.price)) return { ok: false, reason: 'no-price-found' }

  // A price in the wrong currency is worse than no price — the app is GBP-only,
  // and silently filling a €299 figure into a £ field would mislead.
  if (extracted.price && extracted.currency && extracted.currency !== 'GBP') {
    return { ok: false, reason: 'not-gbp' }
  }

  return {
    ok: true,
    name: extracted.name,
    price: extracted.price,
    currency: extracted.currency,
    image: extracted.image,
    source: extracted.source,
    retailer: url.hostname.replace(/^www\./, ''),
  }
}
