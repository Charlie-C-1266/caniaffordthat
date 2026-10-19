import { describe, it, expect } from 'vitest'
import { HELPFUL_LINKS, SALARY_SOURCES, SOURCE_LIST, SOURCES, VEHICLE_SOURCES, type Source } from './sources'

describe('SOURCES lookup', () => {
  it('returns the expected entry for known keys cited elsewhere in the app', () => {
    // Keys referenced inline by the methodology pages (VehicleMethodologyPage,
    // SalaryMethodologyPage) — a renamed or dropped key would break those
    // citations, so pin the ones the app actually reaches for.
    expect(SOURCES.rentAffordability.url).toBe('https://www.moneyhelper.org.uk/en/homes/renting/how-much-rent-can-you-afford')
    expect(SOURCES.rentAffordability.label).toBe('MoneyHelper — Can I afford to rent? (the 30% rule)')
    expect(SOURCES.incomeTax.url).toBe('https://www.gov.uk/income-tax-rates')
    expect(SOURCES.pcp.label).toContain('PCP')
    expect(SOURCES.vedRates.url).toBe('https://www.gov.uk/vehicle-tax-rate-tables')
  })

  it('returns undefined for an unknown key (plain object access, no throwing accessor)', () => {
    // SOURCES is a plain object literal, so an unknown key is a compile-time
    // error in TS and plain `undefined` at runtime — pin that deliberately so
    // a future refactor to a throwing lookup shows up as a test change.
    const lookup = SOURCES as unknown as Record<string, Source | undefined>
    expect(lookup['notARealSourceKey']).toBeUndefined()
  })
})

describe('SOURCE_LIST', () => {
  it('is non-empty and contains every entry of SOURCES exactly once, in declaration order', () => {
    const values = Object.values(SOURCES)
    expect(SOURCE_LIST.length).toBeGreaterThan(0)
    expect(SOURCE_LIST).toEqual(values)
  })

  it('gives every entry the non-empty fields its consumers render', () => {
    for (const source of SOURCE_LIST) {
      expect(source.label).toBeTruthy()
      expect(source.usedFor).toBeTruthy()
      // Every url must be a valid, secure absolute URL — these render as
      // external links on the sources & methodology pages.
      expect(() => new URL(source.url)).not.toThrow()
      expect(new URL(source.url).protocol).toBe('https:')
    }
  })

  it('has no duplicate URLs — one module exists precisely so a URL cannot drift between consumers', () => {
    const urls = SOURCE_LIST.map((s) => s.url)
    expect(new Set(urls).size).toBe(urls.length)
  })
})

describe('curated sub-lists', () => {
  it('VEHICLE_SOURCES is a non-empty subset of SOURCES, citing the vehicle figures', () => {
    expect(VEHICLE_SOURCES.length).toBeGreaterThan(0)
    for (const source of VEHICLE_SOURCES) {
      expect(SOURCE_LIST).toContain(source)
    }
    expect(VEHICLE_SOURCES).toContain(SOURCES.pcp)
    expect(VEHICLE_SOURCES).toContain(SOURCES.vedRates)
  })

  it('SALARY_SOURCES is a non-empty subset of SOURCES, citing the tax/earnings figures', () => {
    expect(SALARY_SOURCES.length).toBeGreaterThan(0)
    for (const source of SALARY_SOURCES) {
      expect(SOURCE_LIST).toContain(source)
    }
    expect(SALARY_SOURCES).toEqual([SOURCES.incomeTax, SOURCES.nationalInsurance, SOURCES.medianSalary])
  })
})

describe('HELPFUL_LINKS', () => {
  it('is non-empty and every entry has the fields the sources page renders', () => {
    expect(HELPFUL_LINKS.length).toBeGreaterThan(0)
    for (const link of HELPFUL_LINKS) {
      expect(link.label).toBeTruthy()
      expect(link.blurb).toBeTruthy()
      expect(() => new URL(link.url)).not.toThrow()
      expect(new URL(link.url).protocol).toBe('https:')
    }
  })

  it('has no duplicate URLs — the same resource listed twice reads as an editing slip on a public page', () => {
    const urls = HELPFUL_LINKS.map((link) => link.url)
    expect(new Set(urls).size).toBe(urls.length)
  })
})

describe('the two registries together', () => {
  // The likelier slip than a within-list duplicate: the same page landing in
  // both lists, which neither per-registry check above notices. It's plausible
  // precisely because a page we cite is often also worth reading — but the
  // sources & ethos page renders the two lists as separate tables ("what we use
  // it for" vs "why it's worth a look"), so one URL in both shows up twice on
  // the same page. Cite the specific page under sources; point at the site, or
  // its hub, under helpful reading.
  it('never lists the same URL as both a cited source and helpful reading', () => {
    const urls = [...SOURCE_LIST, ...HELPFUL_LINKS].map((entry) => entry.url)
    expect(new Set(urls).size).toBe(urls.length)
  })
})
