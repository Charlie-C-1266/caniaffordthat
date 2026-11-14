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
    usedFor: "The emergency fund's recommended 3–6 months of essential outgoings, and its default 3-month starting target.",
  },
  rentAffordability: {
    label: 'MoneyHelper — Can I afford to rent? (the 30% rule)',
    url: 'https://www.moneyhelper.org.uk/en/homes/renting/how-much-rent-can-you-afford',
    usedFor: 'The upper "tight" cutoff in every verdict: 30% of take-home pay for one major commitment.',
  },
  mortgageSpend: {
    label: 'MoneyHelper — How much should I spend on a mortgage?',
    url: 'https://www.moneyhelper.org.uk/en/blog/buy-or-rent-a-home/how-much-should-i-spend-on-a-mortgage',
    usedFor: 'Background for the affordability bands, and groundwork for the mortgage calculator when it lands.',
  },
  fiftyThirtyTwenty: {
    label: 'Halifax — The 50/30/20 rule',
    url: 'https://www.halifax.co.uk/helpcentre/support-and-wellbeing/managing-your-money/50-30-20.html',
    usedFor: 'The lower "comfortable" cutoff in every verdict: the 20%-of-income savings bucket, applied to take-home pay.',
  },
  // Vehicle flow: what the finance shapes, tax figures, fuel default and
  // depreciation curve in lib/vehicle.ts are based on.
  pcp: {
    label: 'MoneyHelper — Buying a car with PCP',
    url: 'https://www.moneyhelper.org.uk/en/everyday-money/buying-and-running-a-car/financing-buying-car-personal-contract-purchase-pcp',
    usedFor:
      'How the vehicle calculator models PCP: deposit, monthly payments bridging to a balloon (GMFV), and the keep-or-return choice.',
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
    usedFor: "Where to check today's pump price — the fuel field ships a static, editable default rather than a live feed.",
  },
  depreciation: {
    label: 'The AA — how quickly new cars lose value (depreciation)',
    url: 'https://www.theaa.com/car-buying/depreciation',
    usedFor: 'The generic depreciation curve behind estimated balloons: ~25% off in year one, around half the value gone by year three.',
  },
  // The salary engine: the income-tax and NI bands the gross↔take-home
  // engine uses, and the median the required salary is compared against.
  incomeTax: {
    label: 'GOV.UK — Income Tax rates and personal allowances',
    url: 'https://www.gov.uk/income-tax-rates',
    usedFor:
      'The reverse "what salary would I need?" engine: the £12,570 personal allowance (tapered over £100k) and the 20/40/45% bands (2026-27, England/Wales/NI).',
  },
  nationalInsurance: {
    label: 'GOV.UK — National Insurance rates and categories',
    url: 'https://www.gov.uk/national-insurance-rates-letters',
    usedFor: 'The employee (Class 1) National Insurance in the salary engine: 8% between £12,570 and £50,270, 2% above (2026-27).',
  },
  medianSalary: {
    label: 'ONS — Annual Survey of Hours and Earnings (median pay)',
    url: 'https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/earningsandworkinghours/bulletins/annualsurveyofhoursandearnings/latest',
    usedFor: 'The "above/below the UK median" context on the required-salary panel: median gross pay for full-time employees.',
  },
  // Student loans and workplace pensions: the thresholds, rules and caveats
  // behind "About your pay" on the Budget step (lib/deductions.ts).
  studentLoanRepayments: {
    label: 'GOV.UK — Repaying your student loan: how much you repay',
    url: 'https://www.gov.uk/repaying-your-student-loan/what-you-pay',
    usedFor:
      'Student loan repayments: 9% over £26,900 (Plan 1), £29,385 (Plan 2), £33,795 (Plan 4) or £25,000 (Plan 5), the Postgraduate Loan at 6% over £21,000 on top of any plan, and one repayment over the lowest threshold for more than one plan (2026-27).',
  },
  studentLoanPlans: {
    label: "GOV.UK — Which repayment plan you're on",
    url: 'https://www.gov.uk/repaying-your-student-loan/which-repayment-plan-you-are-on',
    usedFor: 'The "which plan?" hint: where and when you applied for funding decides your plan, not where you live now.',
  },
  studentLoanEmployers: {
    label: 'GOV.UK — Student loan and postgraduate loan repayment guidance for employers',
    url: 'https://www.gov.uk/guidance/special-rules-for-student-loans',
    usedFor:
      'Repayments are worked out on the same pay as employer National Insurance, each payday, rounded down to the pound — why salary sacrifice lowers a repayment and net pay does not.',
  },
  pensionNationalInsurance: {
    label: 'HMRC — National Insurance Manual: pension contributions (NIM02365)',
    url: 'https://www.gov.uk/hmrc-internal-manuals/national-insurance-manual/nim02365',
    usedFor: 'National Insurance is charged on pay before pension contributions, so a net pay pension lowers income tax but not NI.',
  },
  salarySacrifice: {
    label: 'GOV.UK — Salary sacrifice and the effects on PAYE',
    url: 'https://www.gov.uk/guidance/salary-sacrifice-and-the-effects-on-paye',
    usedFor: 'Salary sacrifice lowers the pay that income tax and National Insurance are charged on.',
  },
  pensionArrangements: {
    label: 'GOV.UK — Workplace pensions: managing your pension',
    url: 'https://www.gov.uk/workplace-pensions/managing-your-pension',
    usedFor:
      'How a net pay pension comes out of pay before income tax, as the pension options describe it, and that your employer can tell you which arrangement you have.',
  },
  pensionTaxRelief: {
    label: 'GOV.UK — Tax on your private pension: pension tax relief',
    url: 'https://www.gov.uk/tax-on-your-private-pension/pension-tax-relief',
    usedFor:
      'Tax relief covers contributions up to 100% of your earnings, so the calculator never puts more than your salary into a pension.',
  },
  autoEnrolment: {
    label: 'GOV.UK — Workplace pensions: what you, your employer and the government pay',
    url: 'https://www.gov.uk/workplace-pensions/what-you-your-employer-and-the-government-pay',
    usedFor:
      'The 5% employee minimum, and the £6,240–£50,270 band it is often worked out on, behind the note that a percentage here is of your whole salary.',
  },
  pensionTaxReliefGuide: {
    label: 'MoneyHelper — Pension tax relief',
    url: 'https://www.moneyhelper.org.uk/en/pensions-and-retirement/tax-and-pensions/tax-relief-and-your-pension',
    usedFor:
      'How each kind of pension gets tax relief, including the top-up HMRC pays low earners in a net pay scheme after the year, which the payslip figures leave out.',
  },
  salarySacrificeReform: {
    label: 'GOV.UK — Salary sacrifice reform for pension contributions from 6 April 2029',
    url: 'https://www.gov.uk/government/publications/salary-sacrifice-reform-for-pension-contributions-effective-from-6-april-2029/salary-sacrifice-reform-for-pension-contributions',
    usedFor:
      'Why salary sacrifice figures will change from April 2029, when National Insurance applies to sacrifice over £2,000 a year. Noted, not yet modelled.',
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

/** The tax, student loan, pension and earnings sources behind the salary engine, cited on the salary methodology page. */
export const SALARY_SOURCES: readonly Source[] = [
  SOURCES.incomeTax,
  SOURCES.nationalInsurance,
  SOURCES.medianSalary,
  SOURCES.studentLoanRepayments,
  SOURCES.studentLoanPlans,
  SOURCES.studentLoanEmployers,
  SOURCES.pensionNationalInsurance,
  SOURCES.salarySacrifice,
  SOURCES.pensionArrangements,
  SOURCES.pensionTaxRelief,
  SOURCES.autoEnrolment,
  SOURCES.pensionTaxReliefGuide,
  SOURCES.salarySacrificeReform,
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
    blurb:
      'The government-backed free money guidance service — the first stop for almost any money question, and the source behind most of our thresholds.',
  },
  {
    label: 'Citizens Advice — debt and money',
    url: 'https://www.citizensadvice.org.uk/debt-and-money/',
    blurb: 'Free, confidential help with debt, budgeting and money problems, including what to do when bills have already slipped.',
  },
  {
    label: 'StepChange',
    url: 'https://www.stepchange.org/',
    blurb:
      'A debt charity offering free, judgement-free debt advice and managed plans — the place to go if repayments have become unmanageable.',
  },
  {
    label: 'MoneySavingExpert',
    url: 'https://www.moneysavingexpert.com/',
    blurb:
      'Practical UK consumer-finance journalism: deals, switching guides and calculators for cutting the costs the calculator asks you about.',
  },
]
