/**
 * Where the Playwright suite points, and whether it has to start a server to
 * get there. Lives in a DOM-free module because playwright.config.ts imports
 * it from the repository root (the same arrangement as themeBootstrap.ts and
 * vite.config.ts), and because the decision is worth unit testing on its own:
 * a deployed run that silently fell back to localhost would pass against the
 * wrong site entirely.
 */

/** Environment variable naming an already-running server to test against. Unset (the default) means "start the dev server and test that". */
export const E2E_BASE_URL_ENV = 'E2E_BASE_URL'

/**
 * The port the suite's own dev server uses — distinct from the Docker
 * container's 4321 and Vite's default 5173, so running the tests doesn't
 * collide with either running locally at the same time.
 */
export const DEFAULT_E2E_PORT = 4322

/** What playwright.config.ts needs to know: the URL to resolve `page.goto('/')` against, and whether to spawn a web server first. */
export interface E2ETarget {
  baseURL: string
  /** True when nothing external was named, so Playwright must start the dev server itself. */
  startDevServer: boolean
}

/** The only schemes a browser can be driven against. A `file:` or `ftp:` URL parses fine but is never a running site. */
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])

/**
 * Normalise a base URL: a trailing slash is dropped so that joining a path
 * can't produce `//`, and anything that isn't an absolute http(s) URL is
 * rejected with a message naming the variable and the offending value.
 */
function normaliseBaseUrl(value: string): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${E2E_BASE_URL_ENV} must be an absolute http(s) URL, e.g. https://staging.example.com — got ${JSON.stringify(value)}`)
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new Error(`${E2E_BASE_URL_ENV} must use http:// or https:// — got ${JSON.stringify(value)}`)
  }
  return value.trim().replace(/\/+$/, '')
}

/**
 * Decide what the suite runs against.
 *
 * Unset, empty or whitespace-only means "unset": behave exactly as the suite
 * always has, starting the dev server on DEFAULT_E2E_PORT. Any other value is
 * an already-running deployment (staging, production, a preview), so no server
 * is started and the suite simply visits it.
 */
export function resolveE2ETarget(raw: string | undefined, port: number = DEFAULT_E2E_PORT): E2ETarget {
  const trimmed = raw?.trim() ?? ''
  if (trimmed === '') {
    return { baseURL: `http://localhost:${port}`, startDevServer: true }
  }
  return { baseURL: normaliseBaseUrl(trimmed), startDevServer: false }
}
