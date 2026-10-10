// @vitest-environment node
// Guards the reduced-motion half of tokens.css rather than a module, so there
// is no reducedMotion.ts to go with it — the same arrangement as seo.test.ts
// and dependabotConfig.test.ts. The stylesheet is parsed with jsdom's CSSOM
// rather than matched with a regex, so this asserts the cascade a browser
// actually builds: that the rule is a real @media block, that its condition is
// the reduced-motion query, and that it is the last word on --duration-reveal.
//
// Deliberately not an e2e assertion on a running browser: the reveal duration
// is a pure CSS fact, and pinning it here means it can't depend on whether a
// given CI browser build honours Playwright's reducedMotion emulation.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import { describe, it, expect } from 'vitest'

const tokensCss = readFileSync(fileURLToPath(new URL('../styles/tokens.css', import.meta.url)), 'utf8')

/** tokens.css parsed into real CSSOM rules. */
function cssRules(): CSSRule[] {
  const { window } = new JSDOM()
  const style = window.document.createElement('style')
  style.textContent = tokensCss
  window.document.head.append(style)
  return [...((style.sheet as CSSStyleSheet).cssRules as unknown as CSSRule[])]
}

/** Every `@media` rule whose condition mentions prefers-reduced-motion. */
function reducedMotionMediaRules(): CSSMediaRule[] {
  return cssRules().filter(
    (rule): rule is CSSMediaRule =>
      rule.constructor.name === 'CSSMediaRule' && (rule as CSSMediaRule).conditionText.includes('prefers-reduced-motion'),
  )
}

describe('tokens.css reduced-motion support', () => {
  it('has exactly one prefers-reduced-motion block', () => {
    expect(reducedMotionMediaRules()).toHaveLength(1)
  })

  it('keys that block on the reduce value, not merely on the feature', () => {
    // `(prefers-reduced-motion)` alone also matches `reduce`, but spelling the
    // value out is what keeps the intent legible and the query stable.
    expect(reducedMotionMediaRules()[0].conditionText).toContain('prefers-reduced-motion: reduce')
  })

  it('collapses --duration-reveal to effectively instant on :root', () => {
    const [mediaRule] = reducedMotionMediaRules()
    const rootRules = [...(mediaRule.cssRules as unknown as CSSRule[])].filter(
      (rule): rule is CSSStyleRule => (rule as CSSStyleRule).selectorText === ':root',
    )
    expect(rootRules).toHaveLength(1)

    const duration = rootRules[0].style.getPropertyValue('--duration-reveal').trim()
    expect(duration).toBe('0.01ms')
  })

  // The reduced-motion override has the same specificity as the :root block it
  // overrides, so source order is the only thing making it win. A later
  // addition that re-declared the token below it would silently undo this.
  it('declares the override after the default, so the cascade picks it', () => {
    const rules = cssRules()
    const lastDefault = rules.findLastIndex(
      (rule) => (rule as CSSStyleRule).selectorText === ':root' && (rule as CSSStyleRule).style?.getPropertyValue('--duration-reveal'),
    )
    const mediaIndex = rules.findLastIndex(
      (rule) => rule.constructor.name === 'CSSMediaRule' && (rule as CSSMediaRule).conditionText.includes('prefers-reduced-motion'),
    )
    expect(lastDefault).toBeGreaterThanOrEqual(0)
    expect(mediaIndex).toBeGreaterThan(lastDefault)
  })

  it('still animates the reveal by default', () => {
    const rules = cssRules()
    const root = rules.find(
      (rule): rule is CSSStyleRule =>
        (rule as CSSStyleRule).selectorText === ':root' && Boolean((rule as CSSStyleRule).style?.getPropertyValue('--duration-reveal')),
    )
    expect(root?.style.getPropertyValue('--duration-reveal').trim()).toBe('2s')
  })
})
