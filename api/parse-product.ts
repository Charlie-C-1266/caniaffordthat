import type { VercelRequest, VercelResponse } from '@vercel/node'
import { parseProductFromUrl } from './_lib/parseProduct'

// GET /api/parse-product?url=<encoded product URL>
//
// The only server-side code in the project. It fetches a retailer page on the
// user's behalf (the browser can't, thanks to CORS) and returns the product
// name + price for the calculator to autofill. Everything degrades gracefully:
// any failure is a `{ ok: false, reason }` the frontend turns into a quiet
// "just type the price" nudge. GET (not POST) so the Vercel CDN can cache
// repeat pastes of the same trending product via `s-maxage`.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    res.status(405).json({ ok: false, reason: 'invalid-url' })
    return
  }

  const raw = req.query.url
  const url = typeof raw === 'string' ? raw : Array.isArray(raw) ? (raw[0] ?? '') : ''

  let result
  try {
    result = await parseProductFromUrl(url)
  } catch {
    // parseProductFromUrl is designed not to throw; this is a last-resort guard.
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({ ok: false, reason: 'unreachable' })
    return
  }

  if (result.ok) {
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
  } else {
    res.setHeader('Cache-Control', 'no-store')
  }

  res.status(result.ok ? 200 : result.reason === 'invalid-url' ? 400 : 200).json(result)
}
