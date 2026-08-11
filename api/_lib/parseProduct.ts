import { ParseError, type ParseDebug, type ParseResult } from './types'
import { validateProductUrl } from './validateUrl'
import { fetchProductHtml } from './fetchHtml'
import { extractProduct, probeStructuredData } from './extract'

interface ParseOptions {
  /** When true, the result carries a `debug` block explaining what happened. */
  debug?: boolean
}

/**
 * End-to-end: validate the URL, fetch the page (SSRF-safe), run the extraction
 * waterfall, and map the outcome onto the response contract. Never throws — any
 * failure becomes a `{ ok: false, reason }`, so the handler stays trivial.
 */
export async function parseProductFromUrl(raw: string, options: ParseOptions = {}): Promise<ParseResult> {
  const { debug = false } = options
  const withDebug = <T extends ParseResult>(result: T, extra?: ParseDebug): T =>
    debug ? { ...result, debug: { ...extra } } : result

  let url: URL
  try {
    url = validateProductUrl(raw)
  } catch {
    return withDebug({ ok: false, reason: 'invalid-url' })
  }

  let html: string
  let status: number | undefined
  let finalUrl: string | undefined
  try {
    const page = await fetchProductHtml(url)
    html = page.html
    status = page.status
    finalUrl = page.finalUrl
  } catch (err) {
    if (err instanceof ParseError) {
      return withDebug({ ok: false, reason: err.reason }, { upstreamStatus: err.status })
    }
    return withDebug({ ok: false, reason: 'unreachable' })
  }

  const probe: ParseDebug = {
    upstreamStatus: status,
    finalUrl,
    htmlBytes: html.length,
    ...(debug ? probeStructuredData(html) : {}),
  }

  const extracted = extractProduct(html)
  if (!extracted || (!extracted.name && !extracted.price)) return withDebug({ ok: false, reason: 'no-price-found' }, probe)

  // A price in the wrong currency is worse than no price — the app is GBP-only,
  // and silently filling a €299 figure into a £ field would mislead.
  if (extracted.price && extracted.currency && extracted.currency !== 'GBP') {
    return withDebug({ ok: false, reason: 'not-gbp' }, probe)
  }

  return withDebug(
    {
      ok: true,
      name: extracted.name,
      price: extracted.price,
      currency: extracted.currency,
      image: extracted.image,
      source: extracted.source,
      retailer: url.hostname.replace(/^www\./, ''),
    },
    probe,
  )
}
