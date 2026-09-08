import {
  vatDueDate, vatPeriodsForYear, currentOpenPeriod, daysUntil, formatDueDate,
} from './vat-deadlines'

describe('vatDueDate', () => {
  it('puts quarterly periods on the 12th of the second month after period end', () => {
    expect(formatDueDate(vatDueDate(2, 2026, 'quarterly'))).toBe('12.05.2026')  // Q1 → 12 May
    expect(formatDueDate(vatDueDate(5, 2026, 'quarterly'))).toBe('12.08.2026')  // Q2 → 12 Aug
    expect(formatDueDate(vatDueDate(8, 2026, 'quarterly'))).toBe('12.11.2026')  // Q3 → 12 Nov
  })

  it('rolls Q4 into February of the following year', () => {
    expect(formatDueDate(vatDueDate(11, 2026, 'quarterly'))).toBe('12.02.2027')
  })

  it('moves a weekend due date to the next Monday', () => {
    // 12.09.2026 is a Saturday → 14.09; 12.07.2026 is a Sunday → 13.07.
    expect(formatDueDate(vatDueDate(6, 2026, 'quarterly'))).toBe('14.09.2026')
    expect(formatDueDate(vatDueDate(4, 2026, 'quarterly'))).toBe('13.07.2026')
  })

  it('uses the last day of February for annual filers, leap years included', () => {
    expect(formatDueDate(vatDueDate(11, 2026, 'annual'))).toBe('01.03.2027')  // 28.02.2027 is a Sunday
    expect(formatDueDate(vatDueDate(11, 2027, 'annual'))).toBe('29.02.2028')  // leap year
  })
})

describe('vatPeriodsForYear', () => {
  it('produces period keys matching computePeriods() in vat-report', () => {
    expect(vatPeriodsForYear(2026, 'quarterly').map((p) => p.key)).toEqual(['q-0', 'q-1', 'q-2', 'q-3'])
    expect(vatPeriodsForYear(2026, 'semiannual').map((p) => p.key)).toEqual(['half-0', 'half-1'])
    expect(vatPeriodsForYear(2026, 'annual').map((p) => p.key)).toEqual(['annual-0'])
  })

  it('covers all twelve months without gaps', () => {
    for (const freq of ['quarterly', 'semiannual', 'annual'] as const) {
      const periods = vatPeriodsForYear(2026, freq)
      expect(periods[0].startMonth).toBe(0)
      expect(periods[periods.length - 1].endMonth).toBe(11)
      periods.slice(1).forEach((p, i) => expect(p.startMonth).toBe(periods[i].endMonth + 1))
    }
  })
})

describe('currentOpenPeriod', () => {
  it('returns the most recently ended period', () => {
    // 8 Sep 2026: Q3 is still running, so Q2 (ended 30 Jun) is the open obligation.
    expect(currentOpenPeriod(2026, 'quarterly', new Date(2026, 8, 8)).key).toBe('q-1')
  })

  it('keeps a period open through its final day, switching the day after', () => {
    // Q3 runs through 30 Sep inclusive, so it only becomes the open obligation on 1 Oct.
    expect(currentOpenPeriod(2026, 'quarterly', new Date(2026, 8, 30)).key).toBe('q-1')
    expect(currentOpenPeriod(2026, 'quarterly', new Date(2026, 9, 1)).key).toBe('q-2')
  })

  it('falls back to Q1 before any period has closed', () => {
    expect(currentOpenPeriod(2026, 'quarterly', new Date(2026, 1, 15)).key).toBe('q-0')
  })

  it('shows the final period when reviewing a past year', () => {
    expect(currentOpenPeriod(2025, 'quarterly', new Date(2026, 8, 8)).key).toBe('q-3')
  })
})

describe('daysUntil', () => {
  it('counts whole days and goes negative once overdue', () => {
    expect(daysUntil(new Date(2026, 8, 20), new Date(2026, 8, 8))).toBe(12)
    expect(daysUntil(new Date(2026, 8, 8), new Date(2026, 8, 8))).toBe(0)
    expect(daysUntil(new Date(2026, 8, 1), new Date(2026, 8, 8))).toBe(-7)
  })

  it('is unaffected by time of day', () => {
    expect(daysUntil(new Date(2026, 8, 9, 1, 0), new Date(2026, 8, 8, 23, 0))).toBe(1)
  })
})
