// @vitest-environment node
// Guards .github/dependabot.yml rather than a module, so there is no
// dependabotConfig.ts to go with it. MegaLinter's yamllint already catches
// malformed YAML in CI; what it can't see is whether an entry points at a
// directory that actually holds that ecosystem's manifest, whether an
// ecosystem is listed twice, whether an entry has quietly drifted off the
// dev branch, or whether two installed packages that have to change major
// together would arrive as two PRs that each fail — which is what this file
// checks.
import { existsSync } from 'node:fs'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import { describe, it, expect } from 'vitest'

/** The ecosystems this repo has manifests for, and the file each one's directory must contain. An entry naming anything else is a typo. */
const ECOSYSTEM_MANIFESTS = {
  npm: 'package.json',
  'github-actions': '.github/workflows',
  docker: 'Dockerfile',
} as const

/** Every entry must target dev: feature and fix PRs batch there, and main only ever takes a release PR. */
const TARGET_BRANCH = 'dev'

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url))

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

/**
 * Everything wrong with a Dependabot config; empty means it's sound.
 * Directory existence is resolved against the real repo root, so a typo in a
 * path is caught rather than taken on trust.
 */
function dependabotProblems(source: string): string[] {
  let config: unknown
  try {
    config = parse(source)
  } catch (error) {
    // A parse failure is the whole story — nothing below can run on it.
    return [`not valid YAML: ${(error as Error).message.split('\n')[0]}`]
  }

  const root = asRecord(config)
  const problems: string[] = []
  if (root.version !== 2) problems.push(`version is ${JSON.stringify(root.version)}, expected 2`)

  const updates = root.updates
  if (!Array.isArray(updates) || updates.length === 0) return [...problems, 'no updates entries']

  const seen = new Set<string>()
  for (const [index, entry] of updates.entries()) {
    const update = asRecord(entry)
    const ecosystem = update['package-ecosystem']
    const directory = update.directory
    const label = typeof ecosystem === 'string' ? ecosystem : `entry ${index}`

    if (typeof ecosystem !== 'string' || !(ecosystem in ECOSYSTEM_MANIFESTS)) {
      problems.push(`${label}: ${JSON.stringify(ecosystem)} is not an ecosystem this repo has a manifest for`)
      continue
    }

    const key = `${ecosystem} ${String(directory)}`
    if (seen.has(key)) problems.push(`${label}: ${String(directory)} is listed twice`)
    seen.add(key)

    if (typeof directory !== 'string' || !directory.startsWith('/')) {
      problems.push(`${label}: directory ${JSON.stringify(directory)} is not a repo-absolute path`)
    } else {
      const manifest = ECOSYSTEM_MANIFESTS[ecosystem as keyof typeof ECOSYSTEM_MANIFESTS]
      if (!existsSync(join(REPO_ROOT, directory, manifest))) problems.push(`${label}: ${directory} holds no ${manifest}`)
    }

    if (update['target-branch'] !== TARGET_BRANCH) {
      problems.push(`${label}: target-branch is ${JSON.stringify(update['target-branch'])}, expected "${TARGET_BRANCH}"`)
    }

    const interval = asRecord(update.schedule).interval
    if (interval !== 'weekly') problems.push(`${label}: schedule interval is ${JSON.stringify(interval)}, expected "weekly"`)

    // A cap is what keeps an unattended weekly run from burying the PR list.
    const limit = update['open-pull-requests-limit']
    if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > 10) {
      problems.push(`${label}: open-pull-requests-limit is ${JSON.stringify(limit)}, expected an integer from 1 to 10`)
    }
  }

  return problems
}

function readRepoFile(relative: string): string {
  return readFileSync(join(REPO_ROOT, relative), 'utf8')
}

/**
 * Two packages that have to change major together: one pins the other through
 * its peerDependencies, and both are published from one repository, so they
 * release as a set. As two Dependabot PRs, each fails `npm ci` with ERESOLVE,
 * which is how vitest 5 and @vitest/coverage-v8 5 arrived (#251 and #252).
 * Held in name order, so a pin in each direction is still one pair.
 */
type LockstepPair = readonly [string, string]

/**
 * A package.json `repository` cut down to host/owner/name, so the spellings
 * npm accepts for one repository compare equal: `git+https://github.com/o/r.git`,
 * `git@github.com:o/r`, `github:o/r` and the bare `o/r` shorthand.
 */
function repositoryOf(manifest: Record<string, unknown>): string | undefined {
  const field = manifest.repository
  const url = typeof field === 'string' ? field : asRecord(field).url
  if (typeof url !== 'string' || url === '') return undefined
  const path = url
    .toLowerCase()
    .replace(/^git\+/, '')
    .replace(/^github:/, 'github.com/')
    .replace(/^[a-z]+:\/\//, '')
    .replace(/^git@([^:/]+):/, '$1/')
    .replace(/^git@/, '')
    .replace(/\.git$/, '')
  // The bare shorthand has no host, and npm reads it as GitHub.
  return /^[^./]+\/[^/]+$/.test(path) ? `github.com/${path}` : path
}

/**
 * Every lockstep pair among the given packages, each keyed by name to its
 * package.json. Only pins between the packages given count, so pass the direct
 * dependencies: those are the ones Dependabot raises PRs for.
 */
function lockstepPairs(manifests: Record<string, Record<string, unknown>>): LockstepPair[] {
  const pairs = new Map<string, LockstepPair>()
  for (const [name, manifest] of Object.entries(manifests)) {
    const repository = repositoryOf(manifest)
    if (repository === undefined) continue
    for (const pinned of Object.keys(asRecord(manifest.peerDependencies))) {
      if (pinned === name || !(pinned in manifests) || repositoryOf(manifests[pinned]) !== repository) continue
      const pair = [name, pinned].toSorted() as [string, string]
      pairs.set(pair.join(' '), pair)
    }
  }
  return [...pairs.values()]
}

/** The repo's direct dependencies, each with the package.json npm actually installed for it. */
function installedManifests(): Record<string, Record<string, unknown>> {
  const pkg = asRecord(JSON.parse(readRepoFile('package.json')))
  const names = [...Object.keys(asRecord(pkg.dependencies)), ...Object.keys(asRecord(pkg.devDependencies))]
  return Object.fromEntries(names.map((name) => [name, asRecord(JSON.parse(readRepoFile(`node_modules/${name}/package.json`)))]))
}

/** Whether a Dependabot group pattern matches a package name: `*` stands for any run of characters and case is ignored, as in Dependabot's own matcher. */
function matchesPattern(pattern: string, name: string): boolean {
  const source = pattern
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*')
  return new RegExp(`^${source}$`, 'i').test(name)
}

function patternsOf(group: Record<string, unknown>): string[] {
  return Array.isArray(group.patterns) ? group.patterns.filter((pattern): pattern is string => typeof pattern === 'string') : []
}

/**
 * Every lockstep pair that no npm group brings as one PR when a major lands;
 * empty means each family's majors arrive together. A group counts when its
 * patterns match both packages, it takes majors, and it sets no
 * dependency-type, which would quietly drop a member from the other side of
 * package.json.
 */
function lockstepProblems(groups: Record<string, unknown>, pairs: readonly LockstepPair[]): string[] {
  const takesMajors = Object.values(groups)
    .map(asRecord)
    .filter((group) => {
      const types = group['update-types']
      return (types === undefined || (Array.isArray(types) && types.includes('major'))) && group['dependency-type'] === undefined
    })
  return pairs
    .filter(
      (pair) => !takesMajors.some((group) => pair.every((name) => patternsOf(group).some((pattern) => matchesPattern(pattern, name)))),
    )
    .map(([first, second]) => `${first} + ${second}: no group takes majors for both`)
}

/** The two groups that batch minor and patch bumps. Every other npm group exists for a family that has to change major together. */
const MINOR_PATCH_GROUPS = ['prod-deps', 'dev-deps']

describe('.github/dependabot.yml', () => {
  const source = readRepoFile('.github/dependabot.yml')
  const config = asRecord(parse(source))
  const updates = (Array.isArray(config.updates) ? config.updates : []).map(asRecord)
  const npmGroups = asRecord(updates.find((update) => update['package-ecosystem'] === 'npm')?.groups)
  const familyGroups = Object.keys(npmGroups).filter((name) => !MINOR_PATCH_GROUPS.includes(name))
  const installed = installedManifests()

  it('is sound: every entry parses, targets dev weekly, and points at a real manifest', () => {
    expect(dependabotProblems(source)).toEqual([])
  })

  it('covers exactly the three ecosystems this repo has manifests for', () => {
    expect(updates.map((update) => update['package-ecosystem'])).toEqual(Object.keys(ECOSYSTEM_MANIFESTS))
  })

  it('batches npm minor and patch bumps into a production and a development group', () => {
    expect(asRecord(npmGroups['prod-deps'])['dependency-type']).toBe('production')
    expect(asRecord(npmGroups['dev-deps'])['dependency-type']).toBe('development')
    for (const name of MINOR_PATCH_GROUPS) {
      expect(asRecord(npmGroups[name])['update-types']).toEqual(['minor', 'patch'])
    }
  })

  it('leaves majors on their own apart from the families that have to change major together', () => {
    expect(familyGroups.length).toBeGreaterThan(0)
    // Keyed by group name, so a failure says which group drifted.
    const updateTypes = Object.fromEntries(familyGroups.map((name) => [name, asRecord(npmGroups[name])['update-types']]))
    expect(updateTypes).toEqual(Object.fromEntries(familyGroups.map((name) => [name, ['major']])))
  })

  it('lists the family groups before the minor and patch groups', () => {
    // GitHub's docs describe a package going to the first group it matches.
    // Dependabot itself files it under every match, but in first place a
    // family's majors stay together under either reading.
    const order = Object.keys(npmGroups)
    const lastFamily = Math.max(...familyGroups.map((name) => order.indexOf(name)))
    expect(lastFamily).toBeLessThan(Math.min(...MINOR_PATCH_GROUPS.map((name) => order.indexOf(name))))
  })

  it('brings each family of installed packages its majors as one PR', () => {
    expect(lockstepProblems(npmGroups, lockstepPairs(installed))).toEqual([])
  })

  it('finds the families this repo is known to have, so the check above is not passing on an empty list', () => {
    expect(lockstepPairs(installed)).toEqual(
      expect.arrayContaining([
        ['@vitest/coverage-v8', 'vitest'],
        ['react', 'react-dom'],
        ['@types/react', '@types/react-dom'],
      ]),
    )
  })

  it('gives every family group at least two installed packages, so none is left matching a typo or a removed package', () => {
    const undersized = familyGroups.filter((name) => {
      const patterns = patternsOf(asRecord(npmGroups[name]))
      return Object.keys(installed).filter((pkg) => patterns.some((pattern) => matchesPattern(pattern, pkg))).length < 2
    })
    expect(undersized).toEqual([])
  })

  it('is mentioned in the README, so the weekly PRs are not a surprise', () => {
    expect(readRepoFile('README.md')).toContain('.github/dependabot.yml')
  })
})

/** Serialises a fixture config for the parser. JSON is a subset of YAML, so fixtures go through exactly the parser the real file does. */
function asYaml(updates: Record<string, unknown>[], version: unknown = 2): string {
  return JSON.stringify({ version, updates }, null, 2)
}

const entry = (overrides: Record<string, unknown> = {}) => ({
  'package-ecosystem': 'npm',
  directory: '/',
  'target-branch': TARGET_BRANCH,
  schedule: { interval: 'weekly' },
  'open-pull-requests-limit': 5,
  ...overrides,
})

// The check is only worth as much as its willingness to reject the mistakes
// it describes, so each failure mode is pinned against a fixture.
describe('the check rejects the mistakes it is meant to catch', () => {
  it('accepts a sound config', () => {
    expect(dependabotProblems(asYaml([entry()]))).toEqual([])
  })

  it('rejects malformed YAML instead of reading past it', () => {
    expect(dependabotProblems('version: 2\nupdates:\n  - package-ecosystem: npm\n   directory: /\n')[0]).toMatch(/^not valid YAML/)
  })

  it('rejects a config with no updates entries', () => {
    expect(dependabotProblems(asYaml([]))).toContain('no updates entries')
  })

  it('rejects the wrong version', () => {
    expect(dependabotProblems(asYaml([entry()], 1))).toContain('version is 1, expected 2')
  })

  it('rejects a duplicated ecosystem and directory', () => {
    expect(dependabotProblems(asYaml([entry(), entry()]))).toContain('npm: / is listed twice')
  })

  it('rejects an unknown ecosystem name', () => {
    expect(dependabotProblems(asYaml([entry({ 'package-ecosystem': 'nmp' })]))).toContain(
      'nmp: "nmp" is not an ecosystem this repo has a manifest for',
    )
  })

  it("rejects a directory typo, by looking for the ecosystem's manifest in it", () => {
    expect(dependabotProblems(asYaml([entry({ directory: '/scr' })]))).toContain('npm: /scr holds no package.json')
    expect(dependabotProblems(asYaml([entry({ 'package-ecosystem': 'docker', directory: '/dokcer' })]))).toContain(
      'docker: /dokcer holds no Dockerfile',
    )
  })

  it('rejects a directory that exists but holds no manifest for that ecosystem', () => {
    expect(dependabotProblems(asYaml([entry({ 'package-ecosystem': 'docker', directory: '/src' })]))).toContain(
      'docker: /src holds no Dockerfile',
    )
  })

  it('rejects a relative directory', () => {
    expect(dependabotProblems(asYaml([entry({ directory: 'src' })]))).toContain('npm: directory "src" is not a repo-absolute path')
  })

  it('rejects a missing target-branch, and one pointing anywhere but dev', () => {
    expect(dependabotProblems(asYaml([entry({ 'target-branch': undefined })]))).toContain('npm: target-branch is undefined, expected "dev"')
    expect(dependabotProblems(asYaml([entry({ 'target-branch': 'main' })]))).toContain('npm: target-branch is "main", expected "dev"')
  })

  it('rejects a schedule that is not weekly', () => {
    expect(dependabotProblems(asYaml([entry({ schedule: { interval: 'daily' } })]))).toContain(
      'npm: schedule interval is "daily", expected "weekly"',
    )
    expect(dependabotProblems(asYaml([entry({ schedule: undefined })]))).toContain('npm: schedule interval is undefined, expected "weekly"')
  })

  it('rejects a missing or unreasonable open-pull-requests-limit', () => {
    expect(dependabotProblems(asYaml([entry({ 'open-pull-requests-limit': undefined })]))).toContain(
      'npm: open-pull-requests-limit is undefined, expected an integer from 1 to 10',
    )
    expect(dependabotProblems(asYaml([entry({ 'open-pull-requests-limit': 99 })]))).toContain(
      'npm: open-pull-requests-limit is 99, expected an integer from 1 to 10',
    )
  })

  it('rejects an entry that is not a mapping at all', () => {
    expect(dependabotProblems('version: 2\nupdates:\n  - npm\n')).toContain(
      'entry 0: undefined is not an ecosystem this repo has a manifest for',
    )
  })
})

/** A fixture package.json carrying just the two fields the family check reads. */
const packageJson = (repository: unknown, peerDependencies: Record<string, string> = {}) => ({ repository, peerDependencies })

/** A fixture npm group that takes majors for the given patterns. */
const majorsGroup = (patterns: string[], extra: Record<string, unknown> = {}) => ({ patterns, 'update-types': ['major'], ...extra })

const VITEST_FAMILY: LockstepPair = ['@vitest/coverage-v8', 'vitest']

describe('the family check finds the packages that have to change major together', () => {
  it('pairs a package with one it pins from the same repository, however each spells the repository', () => {
    expect(
      lockstepPairs({
        vitest: packageJson({ type: 'git', url: 'git+https://github.com/vitest-dev/vitest.git', directory: 'packages/vitest' }),
        '@vitest/coverage-v8': packageJson('https://github.com/vitest-dev/vitest', { vitest: '5.0.5' }),
        'react-dom': packageJson('git@github.com:facebook/react.git', { react: '^19.2.7' }),
        react: packageJson('github:facebook/react'),
        'eslint-plugin-x': packageJson('ssh://git@github.com/acme/lint.git', { eslint: '^10.0.0' }),
        eslint: packageJson('acme/lint'),
      }),
    ).toEqual([
      ['@vitest/coverage-v8', 'vitest'],
      ['react', 'react-dom'],
      ['eslint', 'eslint-plugin-x'],
    ])
  })

  it('counts a pin in each direction once', () => {
    const repository = 'https://github.com/vitest-dev/vitest'
    expect(
      lockstepPairs({
        vitest: packageJson(repository, { '@vitest/coverage-v8': '5.0.5' }),
        '@vitest/coverage-v8': packageJson(repository, { vitest: '5.0.5' }),
      }),
    ).toEqual([['@vitest/coverage-v8', 'vitest']])
  })

  it('leaves out a pin on a package from another repository, which a group of majors cannot help', () => {
    // The plugin's support for a new Vite major arrives as its own release,
    // often a minor, so a group that only takes majors would not bring it.
    expect(
      lockstepPairs({
        vite: packageJson('https://github.com/vitejs/vite'),
        '@vitejs/plugin-react': packageJson('https://github.com/vitejs/vite-plugin-react', { vite: '^8.0.0' }),
      }),
    ).toEqual([])
  })

  it('leaves out two packages from one repository that do not pin each other', () => {
    expect(
      lockstepPairs({
        '@types/node': packageJson('https://github.com/DefinitelyTyped/DefinitelyTyped'),
        '@types/jsdom': packageJson('https://github.com/DefinitelyTyped/DefinitelyTyped'),
      }),
    ).toEqual([])
  })

  it('leaves out a pin on a package that is not a direct dependency, and a package with no repository', () => {
    expect(
      lockstepPairs({
        'react-dom': packageJson('https://github.com/facebook/react', { react: '^19.2.7', scheduler: '^0.27.0' }),
        orphan: packageJson(undefined, { 'react-dom': '^19.0.0' }),
      }),
    ).toEqual([])
  })
})

describe('the family check rejects a family whose majors would still arrive apart', () => {
  it('accepts a family under one group that takes majors, wildcards included', () => {
    expect(lockstepProblems({ vitest: majorsGroup(['vitest', '@vitest/*']) }, [VITEST_FAMILY])).toEqual([])
    expect(lockstepProblems({ everything: { patterns: ['*'] } }, [VITEST_FAMILY])).toEqual([])
  })

  it('rejects a family with no group at all', () => {
    expect(lockstepProblems({}, [VITEST_FAMILY])).toEqual(['@vitest/coverage-v8 + vitest: no group takes majors for both'])
  })

  it('rejects a group that matches only one of the two', () => {
    // '@vitest/*' does not reach vitest itself, and 'react' does not reach react-dom.
    expect(lockstepProblems({ vitest: majorsGroup(['@vitest/*']) }, [VITEST_FAMILY])).toHaveLength(1)
    expect(lockstepProblems({ react: majorsGroup(['react']) }, [['react', 'react-dom']])).toHaveLength(1)
  })

  it('rejects a group that leaves majors out', () => {
    expect(
      lockstepProblems({ vitest: majorsGroup(['vitest', '@vitest/*'], { 'update-types': ['minor', 'patch'] }) }, [VITEST_FAMILY]),
    ).toHaveLength(1)
  })

  it('rejects a group narrowed by dependency-type', () => {
    expect(
      lockstepProblems({ vitest: majorsGroup(['vitest', '@vitest/*'], { 'dependency-type': 'development' }) }, [VITEST_FAMILY]),
    ).toHaveLength(1)
  })

  it('rejects a family split across two groups, one each', () => {
    expect(lockstepProblems({ a: majorsGroup(['vitest']), b: majorsGroup(['@vitest/*']) }, [VITEST_FAMILY])).toHaveLength(1)
  })
})
