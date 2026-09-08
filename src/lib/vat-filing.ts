// What to do when the books move after a VAT return has already been filed.
//
// Finnish rules (vero.fi, "How to make corrections to a VAT return") provide
// for this explicitly, so a late entry is never blocked — it just has to be
// visible, together with which correction route applies:
//
//   • difference of 500 € or less — do NOT file a replacement. Adjust the
//     amount on the next return that falls due.
//   • more than 500 €            — file a replacement return for the period.
//     It replaces the original in full, so every figure is resubmitted.
//
// A replacement filed more than 45 days after the original due date attracts a
// late-filing penalty. Corrections must be made within 3 years, counted from
// the start of the year following the tax year.
//
// Verified against vero.fi on 2026-09-08 — see SOURCES in lib/filing-guide.

import { round2 } from './calculations'

export const MINOR_ERROR_THRESHOLD = 500
export const PENALTY_FREE_DAYS = 45
export const CORRECTION_YEARS = 3

export type CorrectionRoute =
  | 'none'          // nothing changed since filing
  | 'next-return'   // small enough to roll into the next period
  | 'replacement'   // needs a replacement return for this period

export type FiledSnapshot = {
  netVat: number
  filedOn: Date
  dueDate: Date
  year: number
}

export type CorrectionAssessment = {
  route: CorrectionRoute
  /** Signed: positive = more VAT now owed than was filed. */
  difference: number
  /** Last day a replacement avoids a late-filing penalty (dueDate + 45 days). */
  penaltyFreeUntil: Date
  /** True once that window has closed and a replacement would be penalised. */
  penaltyRisk: boolean
  /** Last day any correction can be made at all. */
  correctionDeadline: Date
  /** True once even a correction is out of time. */
  expired: boolean
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

function atMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/**
 * Compare what was filed against what the books now say.
 *
 * `currentNetVat` is the freshly recomputed figure; `filed` is the stored
 * snapshot. Amounts are compared to the cent — anything smaller than half a
 * cent is treated as no change, since float arithmetic can leave dust.
 */
export function assessCorrection(
  filed: FiledSnapshot,
  currentNetVat: number,
  today: Date = new Date(),
): CorrectionAssessment {
  const difference = round2(currentNetVat - filed.netVat)
  const magnitude = Math.abs(difference)

  // 3 years from the beginning of the year following the tax year, so a 2026
  // period can be corrected until the end of 2029.
  const correctionDeadline = new Date(filed.year + CORRECTION_YEARS + 1, 0, 0)
  const penaltyFreeUntil = addDays(filed.dueDate, PENALTY_FREE_DAYS)
  const now = atMidnight(today)

  const route: CorrectionRoute =
    magnitude < 0.005 ? 'none'
    : magnitude <= MINOR_ERROR_THRESHOLD ? 'next-return'
    : 'replacement'

  return {
    route,
    difference,
    penaltyFreeUntil,
    penaltyRisk: route === 'replacement' && now > atMidnight(penaltyFreeUntil),
    correctionDeadline,
    expired: now > atMidnight(correctionDeadline),
  }
}

/** One-line instruction for the assessment, phrased as the next action. */
export function correctionAdvice(a: CorrectionAssessment, periodLabel: string): string {
  const amount = `${Math.abs(a.difference).toFixed(2)} €`
  const direction = a.difference > 0 ? 'more' : 'less'

  if (a.route === 'none') return `Books still match what was filed for ${periodLabel}.`
  if (a.expired) {
    return `${periodLabel} now shows ${amount} ${direction} VAT than was filed, but the three-year `
      + `correction window closed on ${a.correctionDeadline.toLocaleDateString('fi-FI')}.`
  }
  if (a.route === 'next-return') {
    return `${periodLabel} now shows ${amount} ${direction} VAT than was filed. That is within the `
      + `${MINOR_ERROR_THRESHOLD} € threshold — do not file a replacement, just adjust the amount on the next return.`
  }
  return `${periodLabel} now shows ${amount} ${direction} VAT than was filed. That is over the `
    + `${MINOR_ERROR_THRESHOLD} € threshold — file a replacement return for ${periodLabel}, which replaces the original in full.`
    + (a.penaltyRisk
        ? ` The penalty-free window closed on ${a.penaltyFreeUntil.toLocaleDateString('fi-FI')}, so a late-filing penalty applies.`
        : ` Filing by ${a.penaltyFreeUntil.toLocaleDateString('fi-FI')} avoids a late-filing penalty.`)
}
