/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
