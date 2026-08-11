import { describe, it, expect } from 'vitest'
import { extractProduct, cleanPrice, probeStructuredData } from './extract'

// Fixtures are inline HTML rather than saved files: each is trimmed to just the
// markup the extractor cares about, so a failing test points straight at the
// tier that broke. Extraction is pure, so none of this touches the network.

describe('cleanPrice', () => {
  it('canonicalises symbols and UK thousands separators', () => {
    expect(cleanPrice('£1,299.00')).toBe('1299.00')
    expect(cleanPrice('299')).toBe('299.00')
    expect(cleanPrice('  £49.99 ')).toBe('49.99')
  })

  it('handles EU-style grouping', () => {
    expect(cleanPrice('1.234,56')).toBe('1234.56')
    expect(cleanPrice('12,99')).toBe('12.99')
  })

  it('rejects empty, non-numeric, and non-positive values', () => {
    expect(cleanPrice('')).toBeNull()
    expect(cleanPrice('abc')).toBeNull()
    expect(cleanPrice('0')).toBeNull()
    expect(cleanPrice(null)).toBeNull()
    expect(cleanPrice(undefined)).toBeNull()
  })
})

describe('extractProduct — JSON-LD', () => {
  it('reads name, price, currency and image from a Product block', () => {
    const html = `<html><head><script type="application/ld+json">
      ${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: 'Sony WH-1000XM6 Wireless Headphones',
        image: ['https://img.example/sony.jpg'],
        offers: { '@type': 'Offer', price: '299.00', priceCurrency: 'GBP' },
      })}
    </script></head><body></body></html>`
    expect(extractProduct(html)).toEqual({
      name: 'Sony WH-1000XM6 Wireless Headphones',
      price: '299.00',
      currency: 'GBP',
      image: 'https://img.example/sony.jpg',
      source: 'json-ld',
    })
  })

  it('unwraps an @graph wrapper and an offers array', () => {
    const html = `<script type="application/ld+json">
      ${JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'BreadcrumbList' },
          {
            '@type': ['Product', 'IndividualProduct'],
            name: 'Bosch Drill',
            offers: [{ '@type': 'Offer', price: 129.99, priceCurrency: 'GBP' }],
          },
        ],
      })}
    </script>`
    expect(extractProduct(html)).toMatchObject({ name: 'Bosch Drill', price: '129.99', currency: 'GBP', source: 'json-ld' })
  })

  it('surfaces a non-GBP currency so the caller can reject it', () => {
    const html = `<script type="application/ld+json">
      ${JSON.stringify({ '@type': 'Product', name: 'EU Item', offers: { price: '199,00', priceCurrency: 'EUR' } })}
    </script>`
    expect(extractProduct(html)).toMatchObject({ currency: 'EUR', source: 'json-ld' })
  })

  it('ignores a malformed JSON-LD block and falls through', () => {
    const html = `<script type="application/ld+json">{ not valid json </script>
      <meta property="og:title" content="Fallback Product">`
    expect(extractProduct(html)).toMatchObject({ name: 'Fallback Product', source: 'og' })
  })
})

describe('extractProduct — Open Graph', () => {
  it('reads name, price and image from product/OG meta tags', () => {
    const html = `<head>
      <meta property="og:title" content="Currys Kettle">
      <meta property="product:price:amount" content="39.99">
      <meta property="product:price:currency" content="GBP">
      <meta property="og:image" content="https://img.example/kettle.jpg">
    </head>`
    expect(extractProduct(html)).toEqual({
      name: 'Currys Kettle',
      price: '39.99',
      currency: 'GBP',
      image: 'https://img.example/kettle.jpg',
      source: 'og',
    })
  })
})

describe('extractProduct — microdata & title fallbacks', () => {
  it('reads an itemprop price + name', () => {
    const html = `<div itemscope itemtype="https://schema.org/Product">
      <span itemprop="name">Widget</span>
      <span itemprop="price" content="14.50">£14.50</span>
      <meta itemprop="priceCurrency" content="GBP">
    </div>`
    expect(extractProduct(html)).toMatchObject({ name: 'Widget', price: '14.50', currency: 'GBP', source: 'microdata' })
  })

  it('falls back to a cleaned <title> when nothing structured exists', () => {
    const html = `<head><title>Great Gadget | ShopName</title></head><body></body>`
    expect(extractProduct(html)).toEqual({ name: 'Great Gadget', price: null, currency: null, image: null, source: 'title' })
  })

  it('returns null when there is nothing usable', () => {
    expect(extractProduct('<html><body><p>hello</p></body></html>')).toBeNull()
  })
})

describe('probeStructuredData', () => {
  it('reports which structured data a page exposed', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({ '@type': 'Product', name: 'X', offers: { price: '9.99', priceCurrency: 'GBP' } })}</script>`
    expect(probeStructuredData(html)).toEqual({ hadJsonLd: true, hadProductJsonLd: true, hadOgPrice: false })
  })

  it('distinguishes a non-Product JSON-LD block and an OG price', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({ '@type': 'WebPage' })}</script>
      <meta property="product:price:amount" content="10.00">`
    expect(probeStructuredData(html)).toEqual({ hadJsonLd: true, hadProductJsonLd: false, hadOgPrice: true })
  })

  it('reports nothing for a bare page', () => {
    expect(probeStructuredData('<html><body>hi</body></html>')).toEqual({
      hadJsonLd: false,
      hadProductJsonLd: false,
      hadOgPrice: false,
    })
  })
})
