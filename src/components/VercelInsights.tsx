import { SpeedInsights } from '@vercel/speed-insights/react'
import { Analytics } from '@vercel/analytics/react'

/**
 * Whether this bundle was built on Vercel.
 *
 * Replaced at build time by Vite's `define` (see vite.config.ts), which reads
 * Vercel's own `VERCEL` environment variable, so no deploy has to remember to
 * set a `VITE_`-prefixed variable. The two Vercel packages are still bundled
 * either way — the `enabled` prop below stops the minifier proving the branch
 * dead — but off Vercel they're never mounted, so nothing is fetched.
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
