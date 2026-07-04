import { chromium } from 'playwright'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Renders og.html at 1200x630 (the standard Open Graph / Twitter card size)
// and writes the result to public/og-image.png. Run from anywhere:
//   node scripts/og-image/render.mjs
const dir = path.dirname(fileURLToPath(import.meta.url))
const out = path.resolve(dir, '../../public/og-image.png')

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
await page.goto(`file://${dir}/og.html`, { waitUntil: 'networkidle' })
await page.waitForTimeout(300) // let the web fonts settle before the shot
await page.screenshot({ path: out })
await browser.close()
console.log(`wrote ${out}`)
