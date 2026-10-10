import { SpeedInsights } from '@vercel/speed-insights/react'
import { Analytics } from '@vercel/analytics/react'

/**
 * Whether this bundle was built on Vercel.
 *
 * Replaced at build time by Vite's `define` (see vite.config.ts), which reads
 * Vercel's own `VERCEL` environment variable. A compile-time literal rather
 * than a runtime lookup, so the branch below folds away in the build and no
 * deploy has to remember to set a `VITE_`-prefixed variable.
 */
export const ON_VERCEL: boolean = __ON_VERCEL__

/**
 * Vercel's Speed Insights and Analytics, mounted only where they can work.
 *
 * Both scripts live at `/_vercel/…`, a path only Vercel's edge serves. Every
 * entry point used to render them unconditionally, so the self-hosted Docker /
 * nginx build and `vite preview` fetched two scripts that **404 on every page
 * load** — console errors and two wasted requests per page, for analytics that
 * can't report anywhere anyway.
 *
 * One shared component rather than the gate repeated in all four entries.
 *
 * `enabled` exists so tests can exercise both sides of the gate; production
 * code never passes it.
 */
export function VercelInsights({ enabled = ON_VERCEL }: { enabled?: boolean }) {
  if (!enabled) return null
  return (
    <>
      <SpeedInsights />
      <Analytics />
    </>
  )
}
