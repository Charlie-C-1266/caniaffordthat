// @vitest-environment node
// Guards .github/dependabot.yml rather than a module, so there is no
// dependabotConfig.ts to go with it. MegaLinter's yamllint already catches
// malformed YAML in CI; what it can't see is whether an entry points at a
// directory that actually holds that ecosystem's manifest, whether an
// ecosystem is listed twice, or whether an entry has quietly drifted off the
// dev branch — which is what this file checks.
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

describe('.github/dependabot.yml', () => {
  const source = readRepoFile('.github/dependabot.yml')
  const config = asRecord(parse(source))
  const updates = (Array.isArray(config.updates) ? config.updates : []).map(asRecord)

  it('is sound: every entry parses, targets dev weekly, and points at a real manifest', () => {
    expect(dependabotProblems(source)).toEqual([])
  })

  it('covers exactly the three ecosystems this repo has manifests for', () => {
    expect(updates.map((update) => update['package-ecosystem'])).toEqual(Object.keys(ECOSYSTEM_MANIFESTS))
  })

  it('batches npm minor and patch bumps into a production and a development group, leaving majors on their own', () => {
    const npm = updates.find((update) => update['package-ecosystem'] === 'npm')
    const groups = asRecord(npm?.groups)
    expect(Object.keys(groups).toSorted()).toEqual(['dev-deps', 'prod-deps'])
    expect(asRecord(groups['prod-deps'])['dependency-type']).toBe('production')
    expect(asRecord(groups['dev-deps'])['dependency-type']).toBe('development')
    for (const name of ['prod-deps', 'dev-deps']) {
      expect(asRecord(groups[name])['update-types']).toEqual(['minor', 'patch'])
    }
  })

  it('is mentioned in the README, so the weekly PRs are not a surprise', () => {
    expect(readRepoFile('README.md')).toContain('.github/dependabot.yml')
  })
})

/** Serialises a fixture config for the parser. JSON is a subset of YAML, so fixtures go through exactly the parser the real file does. */
function asYaml(updates: Record<string, unknown>[], version: unknown = 2): string {
  return JSON.stringify({ version, updates }, null, 2)
}

// The check is only worth as much as its willingness to reject the mistakes
// it describes, so each failure mode is pinned against a fixture.
describe('the check rejects the mistakes it is meant to catch', () => {
  const entry = (overrides: Record<string, unknown> = {}) => ({
    'package-ecosystem': 'npm',
    directory: '/',
    'target-branch': TARGET_BRANCH,
    schedule: { interval: 'weekly' },
    'open-pull-requests-limit': 5,
    ...overrides,
  })

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
    expect(dependabotProblems(asYaml([entry({ 'package-ecosystem': 'docker', directory: '/docker' })]))).toContain(
      'docker: /docker holds no Dockerfile',
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
