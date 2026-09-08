// Finnish VAT filing deadlines (arvonlisäveroilmoitus) — pure, framework-free
// so both the dashboard and any future filing-status UI compute the same dates.
//
// Rule (vero.fi, "Arvonlisäveron ilmoittaminen ja maksaminen"): the return and
// the payment for a VAT period fall due on the 12th of the SECOND month after
// the period ends — Q1 (Jan–Mar) → 12 May, Q2 → 12 Aug, Q3 → 12 Nov,
// Q4 → 12 Feb of the following year. The annual period is the exception: it is
// due on the last day of February of the following year.
//
// A due date landing on a Saturday or Sunday moves to the next weekday. Public
// holidays shift it further, but those are not encoded here — treat a deadline
// within a day or two of a Finnish holiday as indicative, not authoritative.

import type { VatFilingFrequency } from './vat-report'

export type VatPeriodBounds = {
  key: string          // matches the period keys produced by computePeriods()
  label: string
  startMonth: number   // 0-11, inclusive
  endMonth: number     // 0-11, inclusive
  year: number
  dueDate: Date
}

const MS_PER_DAY = 86_400_000

/** Shift a Saturday/Sunday due date forward to the following Monday. */
function nextWeekday(d: Date): Date {
  const day = d.getDay()
  if (day === 6) return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 2)
  if (day === 0) return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
  return d
}

/**
 * Due date for a VAT period ending in `endMonth` (0-11) of `year`.
 * Annual periods are due the last day of the following February; every other
 * frequency is due the 12th of the second month after the period end.
 */
export function vatDueDate(endMonth: number, year: number, frequency: VatFilingFrequency): Date {
  if (frequency === 'annual') {
    // Day 0 of March = last day of February, leap years included.
    return nextWeekday(new Date(year + 1, 2, 0))
  }
  const dueMonth = endMonth + 2
  return nextWeekday(new Date(year + Math.floor(dueMonth / 12), dueMonth % 12, 12))
}

/** All VAT periods of `year` for the given filing frequency, with due dates. */
export function vatPeriodsForYear(year: number, frequency: VatFilingFrequency): VatPeriodBounds[] {
  if (frequency === 'annual') {
    return [{ key: 'annual-0', label: `FY ${year}`, startMonth: 0, endMonth: 11, year, dueDate: vatDueDate(11, year, 'annual') }]
  }
  if (frequency === 'semiannual') {
    return [0, 1].map((h) => {
      const endMonth = h * 6 + 5
      return { key: `half-${h}`, label: `H${h + 1} ${year}`, startMonth: h * 6, endMonth, year, dueDate: vatDueDate(endMonth, year, 'semiannual') }
    })
  }
  return [0, 1, 2, 3].map((q) => {
    const endMonth = q * 3 + 2
    return { key: `q-${q}`, label: `Q${q + 1} ${year}`, startMonth: q * 3, endMonth, year, dueDate: vatDueDate(endMonth, year, 'quarterly') }
  })
}

/**
 * The period a bookkeeper is currently working on: the most recent period that
 * has already ENDED — that is the one with an open filing obligation. Before
 * the year's first period closes (and for any past year) this falls back to the
 * last period of the year, which is what you want when reviewing history.
 */
export function currentOpenPeriod(
  year: number,
  frequency: VatFilingFrequency,
  today: Date = new Date(),
): VatPeriodBounds {
  const periods = vatPeriodsForYear(year, frequency)
  if (today.getFullYear() !== year) return periods[periods.length - 1]
  const ended = periods.filter((p) => today > new Date(year, p.endMonth + 1, 0, 23, 59, 59))
  return ended.length > 0 ? ended[ended.length - 1] : periods[0]
}

/** Whole days from `today` until `due`. Negative once the deadline has passed. */
export function daysUntil(due: Date, today: Date = new Date()): number {
  const a = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime()
  const b = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  return Math.round((a - b) / MS_PER_DAY)
}

export function formatDueDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}
