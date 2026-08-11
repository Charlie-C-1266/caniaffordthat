import * as cheerio from 'cheerio'
import type { ExtractSource } from './types'

// The extraction waterfall, cheapest and most reliable first:
//   1. JSON-LD (schema.org/Product) — maintained by retailers for Google
//      Shopping, so it's the gold standard.
//   2. Open Graph / product meta tags — usually a name + image, sometimes a price.
//   3. Microdata (itemprop) — older markup, a cheap extra check.
//   4. <title> — a last-ditch name source only.
// Everything here is pure (HTML string in, fields out) so it's unit-tested
// against saved fixtures with no network.

export interface Extracted {
  name: string | null
  price: string | null
  currency: string | null
  image: string | null
  source: ExtractSource
}

const KNOWN_CURRENCIES = new Set(['GBP', 'EUR', 'USD', 'AUD', 'CAD', 'JPY', 'CHF', 'NZD', 'SEK', 'NOK', 'DKK'])

/** Narrows unknown JSON to a plain object, or `null`. */
function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

/**
 * Cleans a raw price into a canonical `"1234.56"` string, or `null` if it isn't
 * a sensible positive amount. Handles currency symbols, thousands separators,
 * and both `1,234.56` (UK) and `1.234,56` (EU) groupings.
 */
export function cleanPrice(raw: unknown): string | null {
  if (raw == null) return null
  let s = String(raw)
    .trim()
    .replace(/[^\d.,]/g, '')
  if (!s) return null

  const hasComma = s.includes(',')
  const hasDot = s.includes('.')
  if (hasComma && hasDot) {
    // Whichever separator comes last is the decimal point; the other groups thousands.
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  } else if (hasComma) {
    const parts = s.split(',')
    // A trailing 2-digit group reads as a decimal (`12,99`); anything else is thousands (`1,299`).
    s = parts[parts.length - 1].length === 2 ? parts.slice(0, -1).join('') + '.' + parts[parts.length - 1] : parts.join('')
  }

  const n = Number(s)
  if (!Number.isFinite(n) || n <= 0) return null
  return n.toFixed(2)
}

/** Guesses a currency code from an ISO code, a symbol, or the raw price text. */
function detectCurrency(explicit: unknown, rawPrice: unknown): string | null {
  if (typeof explicit === 'string') {
    const code = explicit.trim().toUpperCase()
    if (KNOWN_CURRENCIES.has(code)) return code
  }
  const text = String(rawPrice ?? '')
  if (text.includes('£')) return 'GBP'
  if (text.includes('€')) return 'EUR'
  if (text.includes('$')) return 'USD'
  return null
}

function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const name = raw.replace(/\s+/g, ' ').trim().slice(0, 200)
  return name || null
}

/** Pulls the first usable image URL out of a JSON-LD `image` value (string, array, or object). */
function firstImage(image: unknown): string | null {
  if (typeof image === 'string') return image
  if (Array.isArray(image)) {
    for (const entry of image) {
      const found = firstImage(entry)
      if (found) return found
    }
    return null
  }
  const obj = asRecord(image)
  if (obj && typeof obj.url === 'string') return obj.url
  return null
}

/** Flattens JSON-LD into a list of candidate nodes, unwrapping arrays and `@graph` wrappers. */
function collectNodes(data: unknown, out: Record<string, unknown>[]): void {
  if (Array.isArray(data)) {
    for (const entry of data) collectNodes(entry, out)
    return
  }
  const node = asRecord(data)
  if (!node) return
  out.push(node)
  if (node['@graph']) collectNodes(node['@graph'], out)
}

function isProductNode(node: Record<string, unknown>): boolean {
  const type = node['@type']
  if (typeof type === 'string') return type.toLowerCase().includes('product')
  if (Array.isArray(type)) return type.some((t) => typeof t === 'string' && t.toLowerCase().includes('product'))
  return false
}

/** Extracts price + currency from a JSON-LD `offers` value (object, array, or nested priceSpecification). */
function fromOffers(offers: unknown): { price: string | null; currency: string | null } {
  const list = Array.isArray(offers) ? offers : [offers]
  for (const entry of list) {
    const offer = asRecord(entry)
    if (!offer) continue
    const spec = asRecord(offer.priceSpecification)
    const rawPrice = offer.price ?? offer.lowPrice ?? spec?.price
    if (rawPrice == null) continue
    const price = cleanPrice(rawPrice)
    if (!price) continue
    const currency = detectCurrency(offer.priceCurrency ?? spec?.priceCurrency, rawPrice)
    return { price, currency }
  }
  return { price: null, currency: null }
}

function fromJsonLd($: cheerio.CheerioAPI): Extracted | null {
  const nodes: Record<string, unknown>[] = []
  $('script[type="application/ld+json"]').each((_, el) => {
    const text = $(el).contents().text().trim()
    if (!text) return
    try {
      collectNodes(JSON.parse(text), nodes)
    } catch {
      // Ignore malformed JSON-LD blocks — a broken one shouldn't sink the whole parse.
    }
  })

  const product = nodes.find(isProductNode)
  if (!product) return null

  const name = cleanName(product.name)
  const { price, currency } = fromOffers(product.offers)
  const image = firstImage(product.image)
  if (!name && !price) return null
  return { name, price, currency, image, source: 'json-ld' }
}

function fromOpenGraph($: cheerio.CheerioAPI): Extracted | null {
  const metaContent = (selectors: string[]): string | null => {
    for (const sel of selectors) {
      const content = $(sel).first().attr('content')
      if (content && content.trim()) return content.trim()
    }
    return null
  }

  const name = cleanName(
    metaContent(['meta[property="og:title"]', 'meta[name="og:title"]', 'meta[name="twitter:title"]']),
  )
  const rawPrice = metaContent([
    'meta[property="product:price:amount"]',
    'meta[property="og:price:amount"]',
    'meta[itemprop="price"]',
  ])
  const price = cleanPrice(rawPrice)
  const currency = detectCurrency(
    metaContent(['meta[property="product:price:currency"]', 'meta[property="og:price:currency"]']),
    rawPrice,
  )
  const image = metaContent(['meta[property="og:image"]', 'meta[name="twitter:image"]'])

  if (!name && !price) return null
  return { name, price, currency, image, source: 'og' }
}

function fromMicrodata($: cheerio.CheerioAPI): Extracted | null {
  const priceEl = $('[itemprop="price"]').first()
  const rawPrice = priceEl.attr('content') ?? priceEl.text()
  const price = cleanPrice(rawPrice)
  const currency = detectCurrency($('[itemprop="priceCurrency"]').first().attr('content'), rawPrice)
  const name = cleanName($('[itemprop="name"]').first().attr('content') ?? $('[itemprop="name"]').first().text())

  if (!price) return null // without a price, microdata name alone isn't worth trusting over <title>
  return { name, price, currency, image: null, source: 'microdata' }
}

function fromTitle($: cheerio.CheerioAPI): Extracted | null {
  const raw = $('title').first().text()
  // Trim a trailing " | Retailer" / " - Retailer" site-name suffix, if present.
  const name = cleanName(raw.replace(/\s*[|–—-]\s*[^|–—-]{1,40}$/, ''))
  if (!name) return null
  return { name, price: null, currency: null, image: null, source: 'title' }
}

/**
 * Runs the extraction waterfall over a page's HTML. Returns the best result, or
 * `null` when nothing usable (a name or a price) could be found.
 */
export function extractProduct(html: string): Extracted | null {
  const $ = cheerio.load(html)
  return fromJsonLd($) ?? fromOpenGraph($) ?? fromMicrodata($) ?? fromTitle($)
}

/** Non-sensitive signals about what structured data a page exposed — for the debug mode only. */
export function probeStructuredData(html: string): { hadJsonLd: boolean; hadProductJsonLd: boolean; hadOgPrice: boolean } {
  const $ = cheerio.load(html)
  const blocks = $('script[type="application/ld+json"]')
  let hadProductJsonLd = false
  blocks.each((_, el) => {
    if (hadProductJsonLd) return
    try {
      const nodes: Record<string, unknown>[] = []
      collectNodes(JSON.parse($(el).contents().text()), nodes)
      if (nodes.some(isProductNode)) hadProductJsonLd = true
    } catch {
      // Ignore malformed blocks.
    }
  })
  const hadOgPrice = $('meta[property="product:price:amount"], meta[property="og:price:amount"]').length > 0
  return { hadJsonLd: blocks.length > 0, hadProductJsonLd, hadOgPrice }
}
