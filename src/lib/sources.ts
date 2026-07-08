/** One cited guidance page: what it's called in the UI, where it lives, and what we use it for. */
export interface Source {
  label: string
  url: string
  /** One line on which figure or threshold in the app this page backs — shown on the sources & ethos page. */
  usedFor: string
}

// The actual pages behind the app's thresholds and vehicle figures — all UK.
// Keyed by id so the doc pages can cite an individual source inline; the
// "Our sources" panel lists them all. One module so a URL can't drift
// between consumers.
export const SOURCES = {
  saveOrInvest: {
    label: 'MoneyHelper — Should I save or invest? (the 5-year rule)',
    url: 'https://www.moneyhelper.org.uk/en/savings/how-to-save/should-i-save-or-invest',
    usedFor: 'The 60-month cap on saving-up plans: past five years, cash savings for a single purchase stop being the right tool.',
  },
  emergencySavings: {
    label: 'MoneyHelper — Emergency savings: how much is enough? (3–6 months)',
    url: 'https://www.moneyhelper.org.uk/en/savings/types-of-savings/emergency-savings-how-much-is-enough',
    usedFor: 'The emergency fund\'s recommended 3–6 months of essential outgoings, and its default 3-month starting target.',
  },
  rentAffordability: {
    label: 'MoneyHelper — Can I afford to rent? (the 30% rule)',
    url: 'https://www.moneyhelper.org.uk/en/homes/renting/how-much-rent-can-you-afford',
    usedFor: 'The upper "tight" cutoff in every verdict: 30% of income for one major commitment, restated as 60% of spare cash.',
  },
  mortgageSpend: {
    label: 'MoneyHelper — How much should I spend on a mortgage?',
    url: 'https://www.moneyhelper.org.uk/en/blog/buy-or-rent-a-home/how-much-should-i-spend-on-a-mortgage',
    usedFor: 'Background for the affordability bands, and groundwork for the mortgage calculator when it lands.',
  },
  fiftyThirtyTwenty: {
    label: 'Halifax — The 50/30/20 rule',
    url: 'https://www.halifax.co.uk/helpcentre/support-and-wellbeing/managing-your-money/50-30-20.html',
    usedFor: 'The lower "comfortable" cutoff in every verdict: the 20%-of-income savings bucket, restated as 40% of spare cash.',
  },
  // Vehicle flow: what the finance shapes, tax figures, fuel default and
  // depreciation curve in lib/vehicle.ts are based on.
  pcp: {
    label: 'MoneyHelper — Buying a car with PCP',
    url: 'https://www.moneyhelper.org.uk/en/everyday-money/buying-and-running-a-car/financing-buying-car-personal-contract-purchase-pcp',
    usedFor: 'How the vehicle calculator models PCP: deposit, monthly payments bridging to a balloon (GMFV), and the keep-or-return choice.',
  },
  hirePurchase: {
    label: 'MoneyHelper — Buying a car with hire purchase',
    url: 'https://www.moneyhelper.org.uk/en/everyday-money/buying-and-running-a-car/buying-a-car-through-hire-purchase',
    usedFor: 'How the vehicle calculator models HP: equal instalments against the car, yours after the final payment.',
  },
  vedRates: {
    label: 'GOV.UK — Vehicle tax rates (incl. the over-£40k supplement)',
    url: 'https://www.gov.uk/vehicle-tax-rate-tables',
    usedFor: 'The road-tax figures: the £200/year standard rate and the £440/year expensive-car supplement (2026-27 rates).',
  },
  fuelWatch: {
    label: 'RAC Fuel Watch — current pump prices',
    url: 'https://www.rac.co.uk/drive/advice/fuel-watch/',
    usedFor: 'Where to check today\'s pump price — the fuel field ships a static, editable default rather than a live feed.',
  },
  depreciation: {
    label: 'The AA — how quickly new cars lose value (depreciation)',
    url: 'https://www.theaa.com/car-buying/depreciation',
    usedFor: 'The generic depreciation curve behind estimated balloons: ~25% off in year one, around half the value gone by year three.',
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

/** A general money-guidance resource we point people at — not something a calculation depends on. */
export interface HelpfulLink {
  label: string
  url: string
  /** One line on why it's worth a visit. */
  blurb: string
}

// The "helpful reading" list on the sources & ethos page: places we'd send a
// friend, not citations. Grows over time — add entries here and the page
// picks them up.
export const HELPFUL_LINKS: readonly HelpfulLink[] = [
  {
    label: 'MoneyHelper',
    url: 'https://www.moneyhelper.org.uk/en',
    blurb: 'The government-backed free money guidance service — the first stop for almost any money question, and the source behind most of our thresholds.',
  },
  {
    label: 'Citizens Advice — debt and money',
    url: 'https://www.citizensadvice.org.uk/debt-and-money/',
    blurb: 'Free, confidential help with debt, budgeting and money problems, including what to do when bills have already slipped.',
  },
  {
    label: 'StepChange',
    url: 'https://www.stepchange.org/',
    blurb: 'A debt charity offering free, judgement-free debt advice and managed plans — the place to go if repayments have become unmanageable.',
  },
  {
    label: 'MoneySavingExpert',
    url: 'https://www.moneysavingexpert.com/',
    blurb: 'Practical UK consumer-finance journalism: deals, switching guides and calculators for cutting the costs the calculator asks you about.',
  },
]
