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
  // fetch two scripts that 404 on every page load. A `define` (not a runtime
  // lookup) so the branch in components/VercelInsights.tsx folds away.
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
    exclude: ['e2e/**', 'node_modules/**'],
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
    },
  },
})
