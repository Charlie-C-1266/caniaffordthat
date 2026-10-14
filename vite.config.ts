/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { themeBootstrapPlugin } from './src/lib/themeBootstrap.ts'
import { noscriptFallbackPlugin } from './src/lib/noscriptFallback.ts'

// https://vite.dev/config/
export default defineConfig({
  // themeBootstrapPlugin injects the pre-paint theme script into every HTML
  // entry below, replacing the four hand-copied inline <script> blocks.
  // noscriptFallbackPlugin does the same for the no-JavaScript fallback, so
  // neither has to be kept in step across the four entries by hand.
  plugins: [react(), themeBootstrapPlugin(), noscriptFallbackPlugin()],
  // Vercel's Speed Insights and Analytics scripts live under /_vercel/, a path
  // only Vercel's edge serves. Gate them on Vercel's own build-time `VERCEL`
  // variable so the self-hosted Docker/nginx build and `vite preview` don't
  // fetch two scripts that 404 on every page load. A `define` rather than an
  // import.meta.env value, because those arrive as strings and the string
  // 'false' is truthy (see src/vite-env.d.ts).
  define: { __ON_VERCEL__: JSON.stringify(Boolean(process.env.VERCEL)) },
  build: {
    rollupOptions: {
      // Multi-page build: the calculator plus the methodology page(s). Each
      // is its own HTML entry, served as a plain directory index — works on
      // both nginx (`try_files $uri $uri/`) and Vercel without extra config.
      input: {
        main: fileURLToPath(new URL('index.html', import.meta.url)),
        vehicleMethodology: fileURLToPath(new URL('methodology/vehicle/index.html', import.meta.url)),
        salaryMethodology: fileURLToPath(new URL('methodology/salary/index.html', import.meta.url)),
        sourcesEthos: fileURLToPath(new URL('sources/index.html', import.meta.url)),
      },
    },
  },
  test: {
    // Playwright's e2e specs live alongside unit tests but run via a
    // separate runner (`npm run test:e2e`), so exclude them here.
    //
    // .claude/** is Claude Code's local git worktrees, each a full copy of the
    // repo (see .gitignore). Vitest doesn't read .gitignore, so without this
    // `npm test` also runs every worktree's copy of the suite, and picks up
    // its Playwright specs too: 'e2e/**' only matches the root's e2e/ folder,
    // and Playwright's test.describe() throws when Vitest loads it.
    exclude: ['e2e/**', 'node_modules/**', '.claude/**'],
    coverage: {
      provider: 'v8',
      // Report on the app source only; measure every source file (not just the
      // imported ones) so untested files show up as 0% rather than vanishing.
      include: ['src/**/*.{ts,tsx}'],
      // Excluded: the tests themselves, type-only declarations, and the
      // per-page bootstrap entry points. An entry point is `createRoot(...)
      // .render(<Page />)` glue with no logic of its own and nothing worth
      // asserting; the pages it mounts are tested directly. Measuring them
      // only parks a permanent 0% row in the CI coverage table, where it
      // sits among the real gaps and makes a genuinely untested file harder
      // to spot. `src/docs/*-main.tsx` covers the three docs pages' entries
      // (sources, salary, vehicle) by the naming convention they share, so a
      // fourth docs page is excluded without touching this list.
      exclude: ['src/**/*.test.{ts,tsx}', 'src/**/*.d.ts', 'src/main.tsx', 'src/docs/*-main.tsx'],
      reporter: ['text', 'html'],
      /*
       * The gate (#178). A flat 100% on all four metrics: the backlog that
       * made a threshold premature is closed, and #207 removed the last
       * uncovered branch, so there is no headroom to leave and nothing to
       * ratchet upward — `thresholds.autoUpdate` would have nothing to do.
       *
       * No `perFile`: a global floor of 100 is already per-file in effect,
       * since one uncovered line anywhere drops the global below 100. That is
       * the point of picking 100 over "just below today's figure" — a floor
       * with slack lets a new 0%-covered file hide inside the average, which
       * is exactly what #178 set out to prevent.
       *
       * The cost is real and deliberate: the build now fails on the first
       * uncovered line, so genuinely untestable code needs an `exclude` entry
       * above (with the reason, as the existing ones have) rather than a
       * lowered floor.
       */
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
    },
  },
})
