import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join, dirname, basename, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

// Comments used to point readers at `design/adr/*` and `design/glossary.md`,
// documents that have never been in this repository — so the rationale they
// promised was unreachable for anyone reading the code. Those pointers are
// now inline statements of the decision. This guard stops the pattern coming
// back: any `design/…` path written in the source has to resolve to a file
// that actually exists, or the suite fails.

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** Trees that are scanned for doc references. */
const SCANNED_DIRS = ['src', 'e2e']

/** File types that carry comments worth scanning — CSS included, since tokens.css cited the handoff too. */
const SCANNED_EXTENSIONS = ['.ts', '.tsx', '.css', '.md']

// This file is skipped: its fixtures below contain deliberately broken
// references, which are the point of the positive control.
const SELF = basename(fileURLToPath(import.meta.url))

// `design/` plus a path. The character class deliberately excludes the
// closing bracket and quote characters that wrap these in prose.
const DOC_REF = /design\/[A-Za-z0-9._/-]+/g

/** Pulls every `design/…` path out of a blob of text, trimming sentence punctuation. */
function extractDocRefs(text: string): string[] {
  return (text.match(DOC_REF) ?? []).map((ref) => ref.replace(/[.,;:]+$/, ''))
}

/**
 * Expands a range reference into the documents it names. `design/adr/0004-0005`
 * covers two ADRs, so both must exist; anything else is returned untouched
 * (a hyphen inside a real filename, e.g. `0004-emergency-fund.md`, is not a range).
 */
function expandDocRef(ref: string): string[] {
  const leaf = ref.slice(ref.lastIndexOf('/') + 1)
  const range = /^(\d+)-(\d+)$/.exec(leaf)
  if (!range) return [ref]
  const parent = ref.slice(0, ref.lastIndexOf('/') + 1)
  const [, from, to] = range
  const width = from.length
  const start = Number(from)
  const end = Number(to)
  if (end < start) return [ref]
  const refs: string[] = []
  for (let n = start; n <= end; n++) refs.push(parent + String(n).padStart(width, '0'))
  return refs
}

/**
 * Whether a reference resolves to something on disk. An exact path wins;
 * failing that, a numeric ADR stub like `design/adr/0004` resolves to any
 * sibling whose name starts with it (`0004-emergency-fund.md`).
 */
function docRefResolves(ref: string, root: string = REPO_ROOT): boolean {
  const target = join(root, ref)
  if (existsSync(target)) return true
  const parent = dirname(target)
  if (!existsSync(parent) || !statSync(parent).isDirectory()) return false
  const prefix = basename(target)
  return readdirSync(parent).some((entry) => entry.startsWith(prefix))
}

/** Every scannable file under the given tree. */
function filesUnder(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      found.push(...filesUnder(path))
    } else if (SCANNED_EXTENSIONS.some((ext) => entry.name.endsWith(ext)) && entry.name !== SELF) {
      found.push(path)
    }
  }
  return found
}

describe('extractDocRefs', () => {
  it('finds references in TS comments, JSDoc and CSS comments alike', () => {
    const fixture = [
      '// see design/adr/0003 for the re-theme',
      '/** Writes to `savings` (see design/adr/0005). */',
      '/* Transcribed from design/design_handoff_scrolly_affordability_calculator/README.md. */',
    ].join('\n')
    expect(extractDocRefs(fixture)).toEqual([
      'design/adr/0003',
      'design/adr/0005',
      'design/design_handoff_scrolly_affordability_calculator/README.md',
    ])
  })

  it('returns nothing for text with no design references', () => {
    expect(extractDocRefs('// nothing to see here, just src/lib/goals.ts')).toEqual([])
  })
})

describe('expandDocRef', () => {
  it('expands a range reference into every document it covers', () => {
    expect(expandDocRef('design/adr/0004-0005')).toEqual(['design/adr/0004', 'design/adr/0005'])
    expect(expandDocRef('design/adr/0008-0010')).toEqual(['design/adr/0008', 'design/adr/0009', 'design/adr/0010'])
  })

  it('leaves a single reference, a descriptive filename and a backwards range alone', () => {
    expect(expandDocRef('design/adr/0004')).toEqual(['design/adr/0004'])
    expect(expandDocRef('design/adr/0004-emergency-fund.md')).toEqual(['design/adr/0004-emergency-fund.md'])
    expect(expandDocRef('design/adr/0005-0004')).toEqual(['design/adr/0005-0004'])
  })
})

describe('docRefResolves', () => {
  it('rejects a reference whose file is not in the repository (positive control)', () => {
    // The exact shape the comments used to carry. If this ever passes, the
    // scanner has stopped detecting dead references and the guard is useless.
    expect(docRefResolves('design/adr/0001')).toBe(false)
    expect(docRefResolves('design/glossary.md')).toBe(false)
    expect(docRefResolves('design/design_handoff_scrolly_affordability_calculator/README.md')).toBe(false)
  })

  it('accepts a path that does exist, including a prefix-matched stub', () => {
    expect(docRefResolves('src/lib/goals.ts')).toBe(true)
    // `src/lib/goals` is not a file, but a sibling starts with it.
    expect(docRefResolves('src/lib/goals')).toBe(true)
  })
})

describe('design references in the source', () => {
  it('every design/… path written in src and e2e resolves to a real file', () => {
    const dangling: string[] = []
    for (const dir of SCANNED_DIRS) {
      for (const file of filesUnder(join(REPO_ROOT, dir))) {
        for (const ref of extractDocRefs(readFileSync(file, 'utf8'))) {
          for (const expanded of expandDocRef(ref)) {
            if (!docRefResolves(expanded)) dangling.push(`${relative(REPO_ROOT, file)} → ${expanded}`)
          }
        }
      }
    }
    expect(dangling).toEqual([])
  })
})
