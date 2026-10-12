// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { resolveE2ETarget, DEFAULT_E2E_PORT, E2E_BASE_URL_ENV } from './e2eBaseUrl.ts'

describe('resolveE2ETarget', () => {
  it('starts the dev server on the default port when the variable is unset', () => {
    expect(resolveE2ETarget(undefined)).toEqual({
      baseURL: `http://localhost:${DEFAULT_E2E_PORT}`,
      startDevServer: true,
    })
  })

  it('treats an empty or whitespace-only value as unset', () => {
    for (const raw of ['', '   ', '\t\n']) {
      expect(resolveE2ETarget(raw)).toEqual({
        baseURL: `http://localhost:${DEFAULT_E2E_PORT}`,
        startDevServer: true,
      })
    }
  })

  it('honours an explicit port when no base URL is given', () => {
    expect(resolveE2ETarget(undefined, 5173)).toEqual({ baseURL: 'http://localhost:5173', startDevServer: true })
  })

  it('uses a valid URL as-is and starts no server', () => {
    expect(resolveE2ETarget('https://staging.example.com')).toEqual({
      baseURL: 'https://staging.example.com',
      startDevServer: false,
    })
  })

  it('accepts a plain http URL with a port and a path', () => {
    expect(resolveE2ETarget('http://127.0.0.1:4322')).toEqual({ baseURL: 'http://127.0.0.1:4322', startDevServer: false })
    expect(resolveE2ETarget('https://example.com/preview')).toEqual({
      baseURL: 'https://example.com/preview',
      startDevServer: false,
    })
  })

  it('normalises trailing slashes away, so joining a path cannot produce //', () => {
    expect(resolveE2ETarget('https://example.com/').baseURL).toBe('https://example.com')
    expect(resolveE2ETarget('https://example.com///').baseURL).toBe('https://example.com')
    expect(resolveE2ETarget('https://example.com/preview/').baseURL).toBe('https://example.com/preview')
  })

  it('trims surrounding whitespace, which a shell export easily leaves behind', () => {
    expect(resolveE2ETarget('  https://example.com/  ')).toEqual({ baseURL: 'https://example.com', startDevServer: false })
  })

  it('rejects a value that is not an absolute URL, naming the variable and the value', () => {
    expect(() => resolveE2ETarget('example.com')).toThrow(E2E_BASE_URL_ENV)
    expect(() => resolveE2ETarget('example.com')).toThrow('"example.com"')
    expect(() => resolveE2ETarget('/sources/')).toThrow('absolute http(s) URL')
  })

  it('rejects a non-http(s) scheme even though it parses as a URL', () => {
    expect(() => resolveE2ETarget('file:///tmp/dist/index.html')).toThrow('http:// or https://')
    expect(() => resolveE2ETarget('ftp://example.com')).toThrow('http:// or https://')
  })
})
