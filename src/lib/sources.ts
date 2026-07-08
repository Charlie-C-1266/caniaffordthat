/** One cited guidance page: what it's called in the UI and where it lives. */
export interface Source {
  label: string
  url: string
}

// The actual pages behind the app's thresholds and vehicle figures — all UK.
// Keyed by id so the methodology page can cite an individual source inline;
// the "Our sources" panel lists them all. One module so a URL can't drift
// between the two.
export const SOURCES = {
  saveOrInvest: {
    label: 'MoneyHelper — Should I save or invest? (the 5-year rule)',
    url: 'https://www.moneyhelper.org.uk/en/savings/how-to-save/should-i-save-or-invest',
  },
  emergencySavings: {
    label: 'MoneyHelper — Emergency savings: how much is enough? (3–6 months)',
    url: 'https://www.moneyhelper.org.uk/en/savings/types-of-savings/emergency-savings-how-much-is-enough',
  },
  rentAffordability: {
    label: 'MoneyHelper — Can I afford to rent? (the 30% rule)',
    url: 'https://www.moneyhelper.org.uk/en/homes/renting/how-much-rent-can-you-afford',
  },
  mortgageSpend: {
    label: 'MoneyHelper — How much should I spend on a mortgage?',
    url: 'https://www.moneyhelper.org.uk/en/blog/buy-or-rent-a-home/how-much-should-i-spend-on-a-mortgage',
  },
  fiftyThirtyTwenty: {
    label: 'Halifax — The 50/30/20 rule',
    url: 'https://www.halifax.co.uk/helpcentre/support-and-wellbeing/managing-your-money/50-30-20.html',
  },
  // Vehicle flow: what the finance shapes, tax figures, fuel default and
  // depreciation curve in lib/vehicle.ts are based on.
  pcp: {
    label: 'MoneyHelper — Buying a car with PCP',
    url: 'https://www.moneyhelper.org.uk/en/everyday-money/buying-and-running-a-car/financing-buying-car-personal-contract-purchase-pcp',
  },
  hirePurchase: {
    label: 'MoneyHelper — Buying a car with hire purchase',
    url: 'https://www.moneyhelper.org.uk/en/everyday-money/buying-and-running-a-car/buying-a-car-through-hire-purchase',
  },
  vedRates: {
    label: 'GOV.UK — Vehicle tax rates (incl. the over-£40k supplement)',
    url: 'https://www.gov.uk/vehicle-tax-rate-tables',
  },
  fuelWatch: {
    label: 'RAC Fuel Watch — current pump prices',
    url: 'https://www.rac.co.uk/drive/advice/fuel-watch/',
  },
  depreciation: {
    label: 'The AA — how quickly new cars lose value (depreciation)',
    url: 'https://www.theaa.com/car-buying/depreciation',
  },
} as const satisfies Record<string, Source>

/** All sources in display order, for the "Our sources" panel. */
export const SOURCE_LIST: readonly Source[] = Object.values(SOURCES)

/** The vehicle-specific sources, cited on the vehicle methodology page. */
export const VEHICLE_SOURCES: readonly Source[] = [
  SOURCES.pcp,
  SOURCES.hirePurchase,
  SOURCES.vedRates,
  SOURCES.fuelWatch,
  SOURCES.depreciation,
]
