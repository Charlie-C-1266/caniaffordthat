import { defineConfig, devices } from '@playwright/test'
import { resolveE2ETarget, DEFAULT_E2E_PORT, E2E_BASE_URL_ENV } from './src/lib/e2eBaseUrl.ts'

// Either test an already-running deployment (E2E_BASE_URL=https://staging…),
// or — the default — start the dev server on our own port and test that.
// resolveE2ETarget is unit tested in src/lib/e2eBaseUrl.test.ts.
const target = resolveE2ETarget(process.env[E2E_BASE_URL_ENV], DEFAULT_E2E_PORT)

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: target.baseURL,
    trace: 'on-first-retry',
    // Emulate reduced motion so the goal carousel's auto-rotate is disabled
    // during tests — that keeps the focused goal deterministic rather than
    // racing a timer. Manual navigation (dots, prev/next) is unaffected.
    // It has to go through `contextOptions`: `reducedMotion` is a browser
    // context option, not a test option, and placed directly under `use` it
    // was silently ignored (#228). e2e/reduced-motion.spec.ts pins that it
    // takes effect.
    contextOptions: { reducedMotion: 'reduce' },
  },
  // Omitted entirely when a base URL was given: that server is already up, and
  // Playwright must not try to start (or wait on) one of its own.
  ...(target.startDevServer
    ? {
        webServer: {
          command: `npm run dev -- --port ${DEFAULT_E2E_PORT} --strictPort`,
          url: target.baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 30_000,
        },
      }
    : {}),
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
  ],
})
