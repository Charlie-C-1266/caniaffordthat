// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import { describe, it, expect } from 'vitest'

/*
 * The `.visually-hidden` utility in src/index.css is what keeps the result
 * card's copy-outcome live region off the screen while leaving it in the
 * accessibility tree. jsdom never loads the stylesheet, so a component test
 * can only check that the class is applied — these assertions pin what the
 * class actually does, which is the half that makes it work.
 *
 * Parsed through jsdom's CSSOM rather than by regex, so a malformed rule
 * fails here instead of being matched as text. Node environment with jsdom
 * driven directly, as seo.test.ts does, because reading the file needs a
 * real file: URL for import.meta.url.
 */
const CSS = readFileSync(fileURLToPath(new URL('../index.css', import.meta.url)), 'utf8')

const SELECTOR = '.visually-hidden'

const { window } = new JSDOM()

function declarations(): CSSStyleDeclaration {
  const style = window.document.createElement('style')
  style.textContent = CSS
  window.document.head.append(style)
  const sheet = style.sheet
  if (!sheet) throw new Error('index.css did not parse as a stylesheet')

  const rule = [...sheet.cssRules].find((r): r is CSSStyleRule => r instanceof window.CSSStyleRule && r.selectorText === SELECTOR)
  style.remove()
  if (!rule) throw new Error(`index.css has no ${SELECTOR} rule`)
  return rule.style
}

describe('the .visually-hidden utility', () => {
  it('exists as a single top-level rule', () => {
    expect(declarations()).toBeTruthy()
  })

  it('collapses the element to a clipped 1px box, so it takes no visible space', () => {
    const style = declarations()
    expect(style.getPropertyValue('position')).toBe('absolute')
    expect(style.getPropertyValue('width')).toBe('1px')
    expect(style.getPropertyValue('height')).toBe('1px')
    expect(style.getPropertyValue('overflow')).toBe('hidden')
    // Both the legacy `clip` and `clip-path`, since neither is honoured
    // everywhere on its own.
    // Matched rather than compared, because the CSSOM normalises the
    // zeroes it serialises (`0` -> `0px`).
    expect(style.getPropertyValue('clip')).toMatch(/^rect\(\s*0(px)?(,?\s*0(px)?){3}\s*\)$/)
    expect(style.getPropertyValue('clip-path')).toBe('inset(50%)')
  })

  it('is absolutely positioned, so it is not a flex item and cannot add a gap', () => {
    // The live region is a child of the result actions' flex row. An
    // absolutely positioned child is not a flex item, so it neither occupies
    // a track nor earns one of the row's 12px gaps — which is what makes
    // adding it a no-op visually.
    expect(declarations().getPropertyValue('position')).toBe('absolute')
  })

  it('does not hide the element from the accessibility tree', () => {
    const style = declarations()
    // `display: none` and `visibility: hidden` both remove an element from
    // the accessibility tree, which would make a live region using this
    // class permanently silent — the exact bug it exists to avoid.
    expect(style.getPropertyValue('display')).toBe('')
    expect(style.getPropertyValue('visibility')).toBe('')
    expect(style.getPropertyValue('opacity')).toBe('')
  })

  it('keeps its text on one line, so a long message is not wrapped away to nothing', () => {
    // Wrapping inside a 1px box leaves some engines reporting the region as
    // empty.
    expect(declarations().getPropertyValue('white-space')).toBe('nowrap')
  })
})
