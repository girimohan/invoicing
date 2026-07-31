// Finnish sole-trader depreciation (poistot) for movable business assets —
// EVL 30§ / vero.fi "Poistot ja pienhankinnat". A purchase over the small-
// acquisition threshold can't be deducted in full the year it's bought; it
// joins a pooled "menojäännös" depreciated at max 25%/year on the declining
// balance, written off in full once the remaining balance drops to the
// threshold or below. Pure, framework-free — no persisted schedule, the pool
// is re-derived each time from the raw asset acquisitions.

import { round2 } from './calculations'

export const SMALL_ACQUISITION_THRESHOLD = 1200
export const DEPRECIATION_RATE = 0.25
export const DEPRECIABLE_CATEGORIES = ['EQUIPMENT', 'VEHICLE']

export type DepreciationYear = {
  year: number
  openingBalance: number
  additions: number
  depreciation: number
  closingBalance: number
}

export type DepreciationSchedule = {
  currentYear: DepreciationYear
  history: DepreciationYear[]
}

const emptyYear = (year: number): DepreciationYear =>
  ({ year, openingBalance: 0, additions: 0, depreciation: 0, closingBalance: 0 })

// `assets` should already be filtered to qualifying capital purchases only
// (category in DEPRECIABLE_CATEGORIES and amountExVat > SMALL_ACQUISITION_THRESHOLD).
export function computeDepreciationSchedule(
  assets: { date: Date; amountExVat: number }[],
  throughYear: number
): DepreciationSchedule {
  if (assets.length === 0) {
    return { currentYear: emptyYear(throughYear), history: [] }
  }

  const additionsByYear = new Map<number, number>()
  for (const a of assets) {
    const y = new Date(a.date).getFullYear()
    additionsByYear.set(y, round2((additionsByYear.get(y) ?? 0) + a.amountExVat))
  }

  const earliestYear = Math.min(...additionsByYear.keys())
  const history: DepreciationYear[] = []
  let balance = 0

  for (let year = earliestYear; year <= throughYear; year++) {
    const openingBalance = balance
    const additions = additionsByYear.get(year) ?? 0
    const balanceBeforeDepreciation = round2(openingBalance + additions)
    const depreciation = balanceBeforeDepreciation <= SMALL_ACQUISITION_THRESHOLD
      ? balanceBeforeDepreciation
      : round2(balanceBeforeDepreciation * DEPRECIATION_RATE)
    const closingBalance = round2(balanceBeforeDepreciation - depreciation)
    history.push({ year, openingBalance, additions, depreciation, closingBalance })
    balance = closingBalance
  }

  return { currentYear: history[history.length - 1] ?? emptyYear(throughYear), history }
}
