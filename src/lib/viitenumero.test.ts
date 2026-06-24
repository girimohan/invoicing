/**
 * Unit tests for Finnish reference number (viitenumero) calculations.
 * Run with: npx jest src/lib/viitenumero.test.ts
 */

import {
  calcDomesticCheckDigit,
  calcDomesticCheckDigitSteps,
  formatDomesticRef,
  generateDomesticRef,
  generateRfRef,
  buildBaseNumber,
  validateBaseNumber,
} from './viitenumero'

// ── Domestic check digit ──────────────────────────────────────────────────────

describe('calcDomesticCheckDigit', () => {
  test('base "12345" → check digit "3"', () => {
    expect(calcDomesticCheckDigit('12345')).toBe('3')
  })

  test('base "1062026061" → check digit "8"', () => {
    expect(calcDomesticCheckDigit('1062026061')).toBe('8')
  })

  test('check digit is "0" when sum is already a multiple of 10', () => {
    // Pick a base where nextMultipleOf10 - sum = 10, so result should be 0
    // "13" → 3×7 + 1×3 = 21 + 3 = 24; next ×10 = 30; 30 - 24 = 6
    // We need sum % 10 === 0 edge: sum=10 → nextMultiple=20, raw=10, check=0
    // base "5" → 5×7=35; next=40; 40-35=5. Not helpful.
    // base "25" → 5×7 + 2×3 = 35+6=41; next=50; 50-41=9
    // Derived: we need a base where (nextMultiple - sum) == 10
    // i.e. sum mod 10 == 0. e.g. sum=30
    // "52": 2×7 + 5×3 = 14+15 = 29; next=30; 30-29=1
    // Let's try: "152": 2×7+5×3+1×1 = 14+15+1 = 30; next=40; 40-30=10 → should be 0
    expect(calcDomesticCheckDigit('152')).toBe('0')
  })
})

// ── Step-by-step details ─────────────────────────────────────────────────────

describe('calcDomesticCheckDigitSteps', () => {
  test('base "12345" produces correct steps', () => {
    const steps = calcDomesticCheckDigitSteps('12345')
    // Digits:   [1, 2, 3, 4, 5]
    // Weights from right: 5→7, 4→3, 3→1, 2→7, 1→3
    // Products:           35,  12,   3,  14,   3  → sum=67
    // next×10=70; check=3
    expect(steps.sum).toBe(67)
    expect(steps.nextMultipleOf10).toBe(70)
    expect(steps.checkDigit).toBe(3)
    expect(steps.digits).toEqual([1, 2, 3, 4, 5])
    expect(steps.weights).toEqual([3, 7, 1, 3, 7])
    expect(steps.products).toEqual([3, 14, 3, 12, 35])
  })
})

// ── Domestic formatting ───────────────────────────────────────────────────────

describe('formatDomesticRef', () => {
  test('"12345" + check "3" → "1 23453"', () => {
    const full = '12345' + calcDomesticCheckDigit('12345')  // "123453"
    expect(formatDomesticRef(full)).toBe('1 23453')
  })

  test('"1062026061" + check "8" → "1 06202 60618"', () => {
    // Full number: "10620260618" (11 digits)
    // Groups of 5 from right: ["60618", "06202", "1"] → reversed: "1 06202 60618"
    const full = '1062026061' + calcDomesticCheckDigit('1062026061')  // "10620260618"
    expect(formatDomesticRef(full)).toBe('1 06202 60618')
  })

  test('formats a 5-digit number correctly (no leading group)', () => {
    expect(formatDomesticRef('12345')).toBe('12345')
  })

  test('formats a 10-digit number into two groups', () => {
    expect(formatDomesticRef('1234567890')).toBe('12345 67890')
  })
})

// ── End-to-end domestic ───────────────────────────────────────────────────────

describe('generateDomesticRef', () => {
  test('generates correct reference for base "12345"', () => {
    const result = generateDomesticRef('12345')
    expect(result.baseNumber).toBe('12345')
    expect(result.checkDigit).toBe('3')
    expect(result.formattedReference).toBe('1 23453')
    expect(result.referenceType).toBe('domestic')
  })

  test('generates correct reference for base "1062026061"', () => {
    const result = generateDomesticRef('1062026061')
    expect(result.baseNumber).toBe('1062026061')
    expect(result.checkDigit).toBe('8')
    expect(result.formattedReference).toBe('1 06202 60618')
    expect(result.referenceType).toBe('domestic')
  })
})

// ── RF reference ──────────────────────────────────────────────────────────────

describe('generateRfRef', () => {
  test('result starts with "RF" followed by 2-digit check and base', () => {
    const result = generateRfRef('1062026061')
    expect(result.formattedReference).toMatch(/^RF\d{2}1062026061$/)
    expect(result.referenceType).toBe('rf')
    expect(result.baseNumber).toBe('1062026061')
  })

  test('check digits are 2 digits (padded if needed)', () => {
    // The check digits must always be 2 digits
    const result = generateRfRef('1')
    const checkPart = result.formattedReference.slice(2, 4)
    expect(checkPart).toMatch(/^\d{2}$/)
  })

  test('RF check digit validates correctly via modulo', () => {
    // Verify the RF reference is self-consistent:
    // Convert "RF" to "2715", append the ref without "RF" prefix,
    // then the whole thing mod 97 should be 1.
    const result = generateRfRef('1062026061')
    const rfNum = result.formattedReference
    // rfNum = "RF" + checkDigits + base
    // Rearrange: base + checkDigits + "2715"
    const withoutPrefix = rfNum.slice(2) // checkDigits + base
    const checkDigits = withoutPrefix.slice(0, 2)
    const base = withoutPrefix.slice(2)
    // ISO 11649 verification: move RF||checkDigits to end, replace R=27 F=15
    // Verify string = creditorReference + '2715' + checkDigits
    const verifyStr = base + '2715' + checkDigits
    expect(BigInt(verifyStr) % 97n).toBe(1n)
  })
})

// ── buildBaseNumber ───────────────────────────────────────────────────────────

describe('buildBaseNumber', () => {
  test('concatenates clientCode + yearMonth + invoiceSeq', () => {
    expect(buildBaseNumber({ clientCode: '106', yearMonth: '202606', invoiceSeq: '1' }))
      .toBe('1062026061')
  })

  test('works without clientCode', () => {
    expect(buildBaseNumber({ yearMonth: '202606', invoiceSeq: '1' })).toBe('2026061')
  })

  test('works without yearMonth', () => {
    expect(buildBaseNumber({ clientCode: '106', invoiceSeq: '5' })).toBe('1065')
  })

  test('works with invoiceSeq only', () => {
    expect(buildBaseNumber({ invoiceSeq: '42' })).toBe('42')
  })
})

// ── validateBaseNumber ────────────────────────────────────────────────────────

describe('validateBaseNumber', () => {
  test('returns null for valid digit string', () => {
    expect(validateBaseNumber('123456')).toBeNull()
  })

  test('returns error for empty string', () => {
    expect(validateBaseNumber('')).not.toBeNull()
  })

  test('returns error for non-digit characters', () => {
    expect(validateBaseNumber('123abc')).not.toBeNull()
    expect(validateBaseNumber('12.34')).not.toBeNull()
    expect(validateBaseNumber('12 34')).not.toBeNull()
  })
})
