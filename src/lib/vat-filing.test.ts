import {
  assessCorrection, correctionAdvice, MINOR_ERROR_THRESHOLD,
  type FiledSnapshot,
} from './vat-filing'

// Q2 2026: due 12 Aug 2026, filed on time.
const filed = (netVat: number): FiledSnapshot => ({
  netVat,
  filedOn: new Date(2026, 7, 12),
  dueDate: new Date(2026, 7, 12),
  year: 2026,
})

describe('assessCorrection — routes', () => {
  it('reports no correction when the books still match', () => {
    expect(assessCorrection(filed(372.76), 372.76, new Date(2026, 8, 8)).route).toBe('none')
  })

  it('ignores sub-cent float dust', () => {
    expect(assessCorrection(filed(372.76), 372.7600001, new Date(2026, 8, 8)).route).toBe('none')
  })

  it('routes a small difference to the next return', () => {
    const a = assessCorrection(filed(372.76), 358.40, new Date(2026, 8, 8))
    expect(a.route).toBe('next-return')
    expect(a.difference).toBe(-14.36)
  })

  it('treats exactly the threshold as minor', () => {
    expect(assessCorrection(filed(1000), 1500, new Date(2026, 8, 8)).route).toBe('next-return')
    expect(assessCorrection(filed(1000), 1000 + MINOR_ERROR_THRESHOLD, new Date(2026, 8, 8)).route).toBe('next-return')
  })

  it('requires a replacement return just over the threshold', () => {
    const a = assessCorrection(filed(1000), 1500.01, new Date(2026, 8, 8))
    expect(a.route).toBe('replacement')
    expect(a.difference).toBe(500.01)
  })

  it('applies the threshold to the magnitude, in either direction', () => {
    expect(assessCorrection(filed(1000), 400, new Date(2026, 8, 8)).route).toBe('replacement')
    expect(assessCorrection(filed(1000), 1600, new Date(2026, 8, 8)).route).toBe('replacement')
  })
})

describe('assessCorrection — penalty window', () => {
  it('is penalty-free within 45 days of the due date', () => {
    // 12 Aug + 45 days = 26 Sep 2026.
    const a = assessCorrection(filed(1000), 2000, new Date(2026, 8, 20))
    expect(a.penaltyFreeUntil.getMonth()).toBe(8)
    expect(a.penaltyFreeUntil.getDate()).toBe(26)
    expect(a.penaltyRisk).toBe(false)
  })

  it('flags penalty risk once the window closes', () => {
    expect(assessCorrection(filed(1000), 2000, new Date(2026, 8, 27)).penaltyRisk).toBe(true)
  })

  it('does not flag penalty risk for a minor error needing no replacement', () => {
    expect(assessCorrection(filed(1000), 1100, new Date(2027, 0, 1)).penaltyRisk).toBe(false)
  })
})

describe('assessCorrection — three-year limit', () => {
  it('allows corrections to a 2026 period until the end of 2029', () => {
    expect(assessCorrection(filed(1000), 1100, new Date(2029, 11, 31)).expired).toBe(false)
  })

  it('marks the period expired from 2030', () => {
    expect(assessCorrection(filed(1000), 1100, new Date(2030, 0, 1)).expired).toBe(true)
  })
})

describe('correctionAdvice', () => {
  it('tells you not to file a replacement for a minor error', () => {
    const a = assessCorrection(filed(372.76), 358.40, new Date(2026, 8, 8))
    const text = correctionAdvice(a, 'Q2 2026')
    expect(text).toContain('14.36 €')
    expect(text).toContain('do not file a replacement')
  })

  it('tells you to file a replacement for a large error, with the penalty date', () => {
    const a = assessCorrection(filed(1000), 1800, new Date(2026, 8, 20))
    const text = correctionAdvice(a, 'Q2 2026')
    expect(text).toContain('replacement return')
    expect(text).toContain('replaces the original in full')
    expect(text).toContain('avoids a late-filing penalty')
  })

  it('says so when the correction window has closed', () => {
    const text = correctionAdvice(assessCorrection(filed(1000), 1100, new Date(2030, 5, 1)), 'Q2 2026')
    expect(text).toContain('three-year')
  })
})
