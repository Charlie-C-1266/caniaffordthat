import { describe, it, expect, vi, afterEach } from 'vitest'
import { parseProductUrl, looksLikeProductUrl, friendlyFailure } from './productUrl'

// Runs in the default node environment (undici provides `fetch`/`Response`), so
// the client helper is tested against real Response objects with `fetch` mocked.

afterEach(() => vi.restoreAllMocks())

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

describe('looksLikeProductUrl', () => {
  it('accepts http(s) URLs with a dotted host', () => {
    expect(looksLikeProductUrl('https://www.currys.co.uk/products/x')).toBe(true)
    expect(looksLikeProductUrl('http://example.com')).toBe(true)
  })

  it('rejects plain text and hostless strings', () => {
    expect(looksLikeProductUrl('New sofa')).toBe(false)
    expect(looksLikeProductUrl('')).toBe(false)
    expect(looksLikeProductUrl('https://localhost')).toBe(false)
  })
})

describe('parseProductUrl', () => {
  it('short-circuits a non-URL without touching the network', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    expect(await parseProductUrl('not a link')).toEqual({ ok: false, reason: 'invalid-url' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('passes a JSON success result straight through', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ ok: true, name: 'Sony XM6', price: '299.00', currency: 'GBP', image: null, source: 'json-ld', retailer: 'currys.co.uk' }),
    )
    await expect(parseProductUrl('https://currys.co.uk/p')).resolves.toMatchObject({
      ok: true,
      price: '299.00',
      retailer: 'currys.co.uk',
    })
  })

  it('treats a non-JSON response (static host SPA fallback) as unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<!doctype html><title>app</title>', { status: 200, headers: { 'content-type': 'text/html' } }),
    )
    expect(await parseProductUrl('https://currys.co.uk/p')).toEqual({ ok: false, reason: 'unreachable' })
  })

  it('treats a network error as unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
    expect(await parseProductUrl('https://currys.co.uk/p')).toEqual({ ok: false, reason: 'unreachable' })
  })
})

describe('friendlyFailure', () => {
  it('gives a tailored line for known reasons and a default otherwise', () => {
    expect(friendlyFailure('not-gbp')).toMatch(/pounds/i)
    expect(friendlyFailure('blocked')).toMatch(/shop/i)
    expect(friendlyFailure('no-price-found')).toMatch(/pop the price/i)
  })
})
