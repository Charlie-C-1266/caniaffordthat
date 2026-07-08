/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // Multi-page build: the calculator plus the methodology page(s). Each
      // is its own HTML entry, served as a plain directory index — works on
      // both nginx (`try_files $uri $uri/`) and Vercel without extra config.
      input: {
        main: fileURLToPath(new URL('index.html', import.meta.url)),
        vehicleMethodology: fileURLToPath(new URL('methodology/vehicle/index.html', import.meta.url)),
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
      exclude: ['src/**/*.test.{ts,tsx}', 'src/main.tsx', 'src/**/*.d.ts'],
      reporter: ['text', 'html'],
    },
  },
})
