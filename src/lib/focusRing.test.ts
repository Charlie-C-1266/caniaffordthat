import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

// The keyboard focus ring's colour lives in CSS, which unit tests can't
// render, so these parse the stylesheets and guard the rule from #346: the
// ring must take a theme token, never the control's own `currentColor`.

const readCss = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
const indexCss = readCss('../index.css')
const tokensCss = readCss('../styles/tokens.css')

/** The declarations inside the first rule whose selector is exactly `selector`. */
function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(css)
  if (!match) throw new Error(`No "${selector}" rule found`)
  return match[1]
}

describe('focus ring', () => {
  it.each([':focus-visible', '.doc-scroller:focus-visible'])('%s draws its ring in --focus-ring, not currentColor', (selector) => {
    const body = ruleBody(indexCss, selector)
    expect(body).toMatch(/outline:\s*2px solid var\(--focus-ring\);/)
    expect(body).not.toMatch(/currentColor/i)
  })

  it.each([':root', ":root[data-theme='light']"])('%s defines --focus-ring', (selector) => {
    expect(ruleBody(tokensCss, selector)).toMatch(/--focus-ring:\s*var\(--text-primary\);/)
  })
})
