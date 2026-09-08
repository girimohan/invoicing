// Finnish filing procedure reference — VAT returns and the sole-trader annual
// business tax return, as published by Verohallinto (vero.fi).
//
// ─────────────────────────────────────────────────────────────────────────────
// MAINTENANCE: tax rules change every year. Everything here was checked against
// vero.fi on the date in VERIFIED_ON below. Re-check it each January, and after
// any Budget announcement, before trusting it for a filing. Every step carries
// the source page it came from so it can be re-verified quickly.
// ─────────────────────────────────────────────────────────────────────────────

export const VERIFIED_ON = '2026-09-08'

export const SOURCES = {
  whenToFile:      'https://www.vero.fi/en/businesses-and-corporations/taxes-and-charges/vat/when-to-file-and-pay/',
  vatReturnFields: 'https://www.vero.fi/en/businesses-and-corporations/taxes-and-charges/vat/when-to-file-and-pay/instructions-for-completing-the-vat-return/',
  taxPeriod:       'https://www.vero.fi/en/businesses-and-corporations/taxes-and-charges/vat/when-to-file-and-pay/tax-period/',
  vatRates:        'https://www.vero.fi/en/businesses-and-corporations/taxes-and-charges/vat/rates-of-vat/',
  smallBusiness:   'https://www.vero.fi/en/businesses-and-corporations/taxes-and-charges/vat/vat-for-small-business/',
  vatRelief:       'https://www.vero.fi/en/businesses-and-corporations/taxes-and-charges/vat/vat-relief-scheme/',
  selfEmployed:    'https://www.vero.fi/en/businesses-and-corporations/taxes-and-charges/taxation-of-self-employed-individuals/instructions-for-filing/',
  form5:           'https://www.vero.fi/en/About-us/contact-us/forms/descriptions/5_business_tax_return_for_business_oper/',
  vatPayment:      'https://www.vero.fi/en/businesses-and-corporations/taxes-and-charges/vat/how-to-find-the-information-needed-for-paying-vat-in-mytax/',
} as const

// ─── Current rates and thresholds ────────────────────────────────────────────

export const VAT_RATES = [
  { rate: 25.5, label: 'Standard', note: 'Most goods and services, including courier and delivery work. Raised from 24% on 1 Sep 2024.' },
  { rate: 13.5, label: 'Reduced',  note: 'Groceries, restaurant meals, books, medicines, passenger transport, accommodation, culture and sport. Was 14% — lowered to 13.5% on 1 Jan 2026.' },
  { rate: 10,   label: 'Reduced',  note: 'Newspapers and magazines, print and electronic.' },
  { rate: 0,    label: 'Zero',     note: 'Exports outside the EU and intra-EU sales to VAT-registered buyers. Input VAT on related purchases stays deductible.' },
] as const

export const THRESHOLDS = {
  vatRegistration: 20_000,   // € turnover per calendar year, current and preceding
  quarterlyPeriod: 100_000,  // € turnover — max for a quarterly VAT period
  annualPeriod: 30_000,      // € turnover — max for a calendar-year VAT period
} as const

export type GuideStep = {
  title: string
  body: string
  /** Which computed figure from the client's books this step needs, if any. */
  figure?: 'outputVat' | 'deductibleVat' | 'netVat' | 'zeroRatedTurnover' | 'turnover' | 'expenses' | 'depreciation' | 'taxableProfit'
  /** Official MyTax field name this figure is typed into. */
  field?: string
  source?: keyof typeof SOURCES
  /** Shown as a caution rather than an instruction. */
  warn?: boolean
}

// ─── VAT return ───────────────────────────────────────────────────────────────

export const VAT_STEPS: GuideStep[] = [
  {
    title: 'Check the period is complete before you start',
    body: 'Every Wolt pay period and every receipt for these months must already be entered in Client Books. A receipt entered after you file means filing a corrected return, so reconcile first.',
  },
  {
    title: 'Log in to MyTax and open the return',
    body: 'MyTax → Tax matters tab → Self-assessed taxes → Tax returns on self-assessed taxes. Under VAT click Select period, choose the period, then File return.',
    source: 'whenToFile',
  },
  {
    title: 'Enter VAT on domestic sales, by tax rate',
    body: 'The figure below is the total output VAT for the period. Enter it on the row for the rate it was charged at — courier and delivery work is standard-rated at 25.5%. If the books contain sales at more than one rate, split the figure across the rate rows accordingly.',
    figure: 'outputVat',
    field: 'Tax on domestic sales by tax rate',
    source: 'vatReturnFields',
  },
  {
    title: 'Enter deductible VAT on purchases',
    body: 'Input VAT on business purchases for the period — expenses, and VAT on any invoices received. Only the business-use share is deductible; if something is partly private, deduct only the business proportion.',
    figure: 'deductibleVat',
    field: 'Tax deductible for the tax period',
    source: 'vatReturnFields',
  },
  {
    title: 'Report zero-rated turnover if there is any',
    body: 'This box is for sales taxable at 0% where input VAT still deducts — exports and certain international services. Tips are recorded at 0% in these books, but that does not automatically make them zero-rated turnover: tips given voluntarily by a customer are generally outside the scope of VAT rather than zero-rated. Confirm the treatment before entering anything here.',
    figure: 'zeroRatedTurnover',
    field: 'Turnover taxable at zero VAT rate',
    source: 'vatReturnFields',
    warn: true,
  },
  {
    title: 'Check the calculated result',
    body: 'MyTax works out tax payable, or a negative amount qualifying for refund, from the two figures above. It should match the net figure below. If it does not, something was entered wrongly — stop and reconcile rather than submitting.',
    figure: 'netVat',
    field: 'Tax payable / Negative tax that qualifies for refund',
    source: 'vatReturnFields',
  },
  {
    title: 'File a nil return if there was no activity',
    body: 'A return is required for every period even with no activity. Tick "No activities during the tax period" rather than skipping the filing — a missed return means a late-filing penalty.',
    source: 'vatReturnFields',
  },
  {
    title: 'Preview, submit, then pay',
    body: 'Stage 2 is Preview and send — check the figures and Submit. Pay separately using the reference number and bank details under Payment status → Paying taxes and payment details in MyTax. Filing is not paying; both are due on the same date.',
    source: 'vatPayment',
  },
  {
    title: 'Do not expect an extension',
    body: 'VAT return due dates cannot be extended. Late filing triggers a late-filing penalty, and late payment accrues interest.',
    source: 'whenToFile',
    warn: true,
  },
]

// ─── Annual business tax return (Form 5) ─────────────────────────────────────

export const ANNUAL_STEPS: GuideStep[] = [
  {
    title: 'Confirm the deadline for the tax year',
    body: 'The sole-trader business tax return (Form 5) is due at the start of April following the tax year — 1 April 2026 for tax year 2025. It must be filed for every year, including years with no activity at all.',
    source: 'selfEmployed',
  },
  {
    title: 'Close the year in the books first',
    body: 'All twelve months of income and expenses must be entered, and every capital purchase categorised, before the figures below mean anything. Check each quarter against what was actually filed for VAT.',
  },
  {
    title: 'Open the return in MyTax',
    body: 'MyTax → Individual income tax → select the tax year → "Open business tax return – business operator or self-employed person (5)". The form runs through four stages: Revenues, Expenses and reserves, Net worth, Other details.',
    source: 'selfEmployed',
  },
  {
    title: 'Enter net sales under Revenues',
    body: 'Business turnover excluding VAT. VAT itself is never income — it passes through. Report the figure below as net sales (liikevaihto).',
    figure: 'turnover',
    field: 'Net sales',
    source: 'selfEmployed',
  },
  {
    title: 'Enter deductible expenses',
    body: 'Business costs excluding VAT, itemised into the categories the form asks for. Capital purchases are not included here — they are depreciated instead, in the next step.',
    figure: 'expenses',
    field: 'Expenses (by category)',
    source: 'selfEmployed',
  },
  {
    title: 'Enter depreciation on fixed assets',
    body: 'Answer Yes under Depreciation expenses if depreciation was entered in the accounts. Equipment and vehicles above the small-acquisition threshold are pooled and written down by at most 25% a year on the declining balance (EVL 30§). The figure below is this year\'s allowed depreciation, calculated from the capital purchases in the books.',
    figure: 'depreciation',
    field: 'Depreciation on fixed assets',
    source: 'selfEmployed',
  },
  {
    title: 'Report vehicle use and keep the trip log',
    body: 'The form asks for business versus private kilometres. A driver\'s log (ajopäiväkirja) must back up whatever is claimed — record it before filing, not afterwards, and keep it with the year\'s records.',
    source: 'selfEmployed',
    warn: true,
  },
  {
    title: 'Complete Net worth and Other details',
    body: 'Report business assets and liabilities; MyTax calculates net worth itself, which determines how the profit splits between capital income and earned income.',
    source: 'selfEmployed',
  },
  {
    title: 'Check the resulting profit',
    body: 'Revenue minus deductible expenses minus depreciation. This should match the figure below from the Tax Return tab in Client Books. A gap means something is categorised differently in the two places — find it before submitting.',
    figure: 'taxableProfit',
    field: 'Taxable profit (verotettava tulos)',
  },
  {
    title: 'Review prepayment tax for the year ahead',
    body: 'If profit has moved substantially, the prepayment tax (ennakkovero) for the current year is probably set against stale figures. Adjusting it in MyTax after filing avoids both a large back-tax bill and needless overpayment.',
  },
]

// ─── Things that recently changed ────────────────────────────────────────────
// Surfaced in the UI because they are the most likely source of a stale habit.

export const RECENT_CHANGES = [
  {
    what: 'VAT relief for small businesses (alarajehuojennus) is gone',
    detail: 'Abolished for accounting periods beginning on or after 1 January 2025. There is no relief box to complete for 2025 or 2026. Relief for periods that ended before 2025 can still be claimed retroactively for three years.',
    source: 'vatRelief' as const,
  },
  {
    what: 'Reduced VAT rate is 13.5%, not 14%',
    detail: 'Lowered from 14% to 13.5% on 1 January 2026. The standard rate is unchanged at 25.5%.',
    source: 'vatRates' as const,
  },
  {
    what: 'VAT registration threshold is €20,000',
    detail: 'Registration is not required while turnover stays at or below €20,000 in both the current and the preceding calendar year.',
    source: 'smallBusiness' as const,
  },
]
