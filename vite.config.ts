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
  },
})
