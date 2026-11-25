import { describe, it, expect } from 'vitest'
import { ICON_NAMES, ICONS, type IconName } from './iconRegistry'

// A drift guard, in the spirit of budget.test.ts, sources.test.ts and
// docRefs.test.ts: those check that a config and the code that reads it still
// agree, this one checks the registry against the code that renders from it.
//
// Why it's needed: Icon.test.tsx walks ICON_NAMES and asserts each entry
// renders, so an orphaned entry looks tested and nothing flags it. Each one
// also pulls a Lucide component into the bundle for nothing. #283 found `fuel`
// registered under a comment about the running-costs step while no component
// ever asked for it.
//
// The whole non-test source is read as text rather than imported, because an
// icon name is a plain string literal: some reach <Icon> directly, some only
// through data (`goal.icon` in lib/goals.ts, `option.icon` in
// methodOptions.ts), and some only down one arm of a ternary ('check'/'x' in
// VerdictBanner, 'sun'/'moon' in ThemeToggle). Nothing short of the source
// text sees all three.
const SOURCES = import.meta.glob<string>('/src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true })

/** Where a name may be referenced: the app's own source, less the registry itself and the tests. */
const searchable = Object.entries(SOURCES).filter(
  ([path]) => !path.endsWith('/iconRegistry.ts') && !/\.test\.(ts|tsx)$/.test(path) && !path.startsWith('/src/test/'),
)

/**
 * The files that reference `name` as a quoted string literal.
 *
 * Quoted deliberately: `x` is a single letter, so a bare substring search
 * would match the `x` in any identifier and pass every short name by accident.
 * Matching `'x'` or `"x"` means only a real string literal counts.
 */
function referencedIn(name: IconName): string[] {
  const literal = new RegExp(`(?:'${name}'|"${name}")`)
  return searchable.filter(([, text]) => literal.test(text)).map(([path]) => path)
}

describe('icon registry', () => {
  it('reads the app source it searches', () => {
    // Without this the per-name assertions below would pass vacuously if the
    // glob pattern ever stopped matching (a moved source root, say).
    expect(searchable.length).toBeGreaterThan(50)
    expect(searchable.map(([path]) => path)).toContain('/src/components/Icon.tsx')
  })

  it('excludes the registry itself and the tests from the search', () => {
    const paths = searchable.map(([path]) => path)
    expect(paths).not.toContain('/src/components/iconRegistry.ts')
    expect(paths).not.toContain('/src/components/iconRegistry.test.ts')
    expect(paths.filter((path) => path.includes('.test.'))).toEqual([])
  })

  it.each(ICON_NAMES)('%s is referenced by non-test source', (name) => {
    // Fails when an icon is registered but never rendered. Fix it by deleting
    // the entry, or by wiring the icon up to the component that wanted it.
    expect(referencedIn(name)).not.toEqual([])
  })

  it('does not count a name that only appears unquoted', () => {
    // The guard's own edge case: 'x' must match as a literal, not as the
    // letter x inside words like `max` or `boxShadow`, which appear all over
    // the styles. If this ever broke, every short name would pass vacuously.
    const unquoted = searchable.filter(([, text]) => /\bexport\b/.test(text) && !/(?:'x'|"x")/.test(text))
    expect(unquoted.length).toBeGreaterThan(0)
    expect(referencedIn('x')).not.toEqual(unquoted.map(([path]) => path))
    // 'x' is reached only down one arm of VerdictBanner's ternary, and that is
    // the single place that should match.
    expect(referencedIn('x')).toEqual(['/src/components/result/VerdictBanner.tsx'])
  })

  it('counts an icon referenced only through data as used', () => {
    // goal.icon (lib/goals.ts) and option.icon (methodOptions.ts) never reach
    // <Icon name="…"> as a literal at the call site.
    expect(referencedIn('house')).toContain('/src/lib/goals.ts')
    expect(referencedIn('banknote')).toContain('/src/components/steps/vehiclePurchase/methodOptions.ts')
  })

  it('counts an icon referenced only in one arm of a ternary as used', () => {
    expect(referencedIn('check')).toContain('/src/components/result/VerdictBanner.tsx')
    expect(referencedIn('sun')).toContain('/src/components/ThemeToggle.tsx')
    expect(referencedIn('moon')).toContain('/src/components/ThemeToggle.tsx')
  })

  it('has no entry for the icons #283 removed', () => {
    // `fuel` was registered under a comment claiming the running-costs step
    // used it; nothing did. (`chevron-down`, the issue's other candidate, is
    // now AboutYourPay's disclosure chevron, so it stays.)
    expect(ICON_NAMES).not.toContain('fuel')
    expect(ICON_NAMES).toContain('chevron-down')
    expect(referencedIn('chevron-down')).toContain('/src/components/steps/budget/AboutYourPay.tsx')
  })

  it('keeps every registered name pointing at a distinct Lucide component', () => {
    const components = ICON_NAMES.map((name) => ICONS[name])
    expect(new Set(components).size).toBe(components.length)
  })
})
