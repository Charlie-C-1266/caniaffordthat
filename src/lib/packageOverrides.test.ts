// @vitest-environment node
// Guards the `overrides` block in package.json rather than a module, so there
// is no packageOverrides.ts to go with it.
//
// An override pins a transitive dependency that the packages above it haven't
// caught up with yet — today `minimatch`, which reached the tree at 10.x
// through the ESLint toolchain as 11 moderate `npm audit` findings
// (GHSA-g3hv-75wg-m249). It is a blunt instrument: npm applies it to every
// copy in the tree, silently, with no warning if the range stops matching
// anything or the reason for it has passed. So it can rot in three ways, and
// this file catches each one:
//
//   - the range stops being valid semver, and npm resolves something nobody
//     intended;
//   - nobody records why it is there, so no one dares remove it;
//   - the upstream packages move on, the override does nothing, and it stays
//     anyway — or worse, it holds a package *back*.
//
// The last of those is why the installed-version check below reads
// node_modules rather than trusting the lockfile.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url))

function readRepoFile(relative: string): string {
  return readFileSync(join(REPO_ROOT, relative), 'utf8')
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

/**
 * One semver comparator: an optional operator, then a version whose major is
 * required and whose minor, patch, prerelease and build are each optional.
 * `*`, `x` and `X` stand in for a numeric part, so `1.x` and `*` both pass.
 */
const COMPARATOR = /^(?:[\^~]|[<>]=?|=)?\s*(?:[*xX]|\d+)(?:\.(?:[*xX]|\d+))?(?:\.(?:[*xX]|\d+))?(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/

/**
 * Whether a string is a semver range npm can resolve: comparator sets joined
 * by `||`, each a space-separated run of comparators or a single `a - b`
 * hyphen range. Deliberately narrower than npm's own parser — a URL or a
 * `npm:` alias is not something this repo should be pinning a transitive
 * dependency to, so those are rejected rather than waved through.
 */
function isSemverRange(range: string): boolean {
  if (range.trim() === '') return false
  return range.split('||').every((set) => {
    const parts = set.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return false
    // `a - b`: exactly three parts, the middle one a bare hyphen.
    if (parts.length === 3 && parts[1] === '-') return COMPARATOR.test(parts[0]) && COMPARATOR.test(parts[2])
    return parts.every((part) => COMPARATOR.test(part))
  })
}

/** The flat `name: range` overrides in package.json. Nested objects are not used here and would need their own handling, so they are reported as a problem rather than skipped. */
function overrideEntries(packageJson: string): [string, unknown][] {
  return Object.entries(asRecord(asRecord(JSON.parse(packageJson)).overrides))
}

const packageJson = readRepoFile('package.json')
const overrides = overrideEntries(packageJson)

describe('the overrides block in package.json', () => {
  it('pins at least one package, so the checks below are not passing on an empty list', () => {
    // If the last override is ever removed, delete this file with it.
    expect(overrides.length).toBeGreaterThan(0)
  })

  it.each(overrides)('pins %s to a valid semver range', (_name, range) => {
    expect(typeof range).toBe('string')
    expect(isSemverRange(String(range))).toBe(true)
  })

  it.each(overrides)('explains %s in the README, with the condition for removing it', (name) => {
    // An override with no written reason is one nobody will ever dare delete.
    const readme = readRepoFile('README.md')
    expect(readme).toContain('### Dependency overrides')
    expect(readme).toContain(`\`${name}\``)
  })

  it.each(overrides)('has %s actually applied: one installed version, and it satisfies the pin', (name, range) => {
    // Reads node_modules rather than the lockfile: this is the version the
    // lint and build steps really load. A range that matches nothing would
    // leave the old copy here and the audit red.
    const installed = String(asRecord(JSON.parse(readRepoFile(`node_modules/${name}/package.json`))).version)
    const floor = String(range).replace(/^[\^~]/, '')
    expect(isSemverRange(installed)).toBe(true)
    expect(compareVersions(installed, floor)).toBeGreaterThanOrEqual(0)
  })

  it('holds minimatch at 11 or above, the floor that clears GHSA-g3hv-75wg-m249', () => {
    // Named rather than generic: this is the advisory the block exists for,
    // and the test should fail loudly if the pin is loosened below its fix.
    const range = overrides.find(([name]) => name === 'minimatch')?.[1]
    expect(range).toBeDefined()
    expect(compareVersions(String(range).replace(/^[\^~]/, ''), '11.0.1')).toBeGreaterThanOrEqual(0)
  })
})

/** A version's release numbers, dropping any prerelease tag. */
function releaseParts(version: string): number[] {
  return version.split('-')[0].split('.').map(Number)
}

/** -1, 0 or 1 comparing two release versions numerically, part by part. Prerelease tags are not compared; no override here uses one. */
function compareVersions(a: string, b: string): number {
  const [left, right] = [releaseParts(a), releaseParts(b)]
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0)
    if (diff !== 0) return diff > 0 ? 1 : -1
  }
  return 0
}

// The checks above are only worth as much as their willingness to reject the
// mistakes they describe, so each failure mode is pinned against a fixture.
describe('the semver range check rejects what npm could not resolve', () => {
  it.each([
    ['a caret range', '^11.0.3'],
    ['a tilde range', '~11.0.3'],
    ['an exact version', '11.0.3'],
    ['a comparator', '>=11.0.1'],
    ['a two-comparator set', '>=11.0.1 <12.0.0'],
    ['an or of two sets', '^11.0.3 || ^12.0.0'],
    ['a hyphen range', '11.0.1 - 11.9.9'],
    ['an x-range', '11.x'],
    ['any version', '*'],
    ['a prerelease', '^11.0.0-rc.1'],
  ])('accepts %s', (_case, range) => {
    expect(isSemverRange(range)).toBe(true)
  })

  it.each([
    ['an empty string', ''],
    ['only whitespace', '   '],
    ['a typo for a caret', '^^11.0.3'],
    ['a missing version', '>='],
    ['a tag', 'latest'],
    ['a git URL', 'git+https://github.com/isaacs/minimatch.git'],
    ['an npm alias', 'npm:minimatch@^11.0.3'],
    ['a trailing or with nothing after it', '^11.0.3 ||'],
    ['a hyphen range missing its upper bound', '11.0.1 -'],
    ['a version with a stray comma', '11.0.3,'],
  ])('rejects %s', (_case, range) => {
    expect(isSemverRange(range)).toBe(false)
  })
})

describe('the overrides reader', () => {
  it('finds nothing when package.json has no overrides block, so the count check above is what fails', () => {
    expect(overrideEntries(JSON.stringify({ name: 'x' }))).toEqual([])
  })

  it('reads a flat name-to-range map', () => {
    expect(overrideEntries(JSON.stringify({ overrides: { minimatch: '^11.0.3' } }))).toEqual([['minimatch', '^11.0.3']])
  })

  it('surfaces a nested override as a non-string range, which the semver check then rejects', () => {
    // Nested form (`{ "foo": { "bar": "1" } }`) isn't used here. If it ever
    // is, this test is the prompt to teach the checks above about it.
    const nested = overrideEntries(JSON.stringify({ overrides: { foo: { bar: '1.0.0' } } }))
    expect(nested).toEqual([['foo', { bar: '1.0.0' }]])
    expect(isSemverRange(String(nested[0][1]))).toBe(false)
  })
})
