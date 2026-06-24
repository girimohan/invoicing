/**
 * Finnish Invoice Reference Number (Viitenumero) Generator
 *
 * Supports:
 *  - Kansallinen viitenumero (domestic, Modulo 10 / weights 7-3-1)
 *  - RF-viitenumero (SEPA ISO 11649 creditor reference)
 */

export type ReferenceType = 'domestic' | 'rf'

export interface ReferenceResult {
  baseNumber: string
  checkDigit: string
  formattedReference: string
  referenceType: ReferenceType
}

export interface CheckDigitSteps {
  digits: number[]
  weights: number[]
  products: number[]
  sum: number
  nextMultipleOf10: number
  checkDigit: number
}

// ── Domestic (Kansallinen viitenumero) ────────────────────────────────────────

/**
 * Calculate the domestic Finnish reference number check digit.
 * Algorithm: Modulo 10, weights 7-3-1 cycling from the rightmost digit leftward.
 *   - check digit = nextMultipleOf10 - sum (if result is 10, use 0)
 */
export function calcDomesticCheckDigit(base: string): string {
  const steps = calcDomesticCheckDigitSteps(base)
  return String(steps.checkDigit)
}

/**
 * Calculate check digit with step-by-step details for audit display.
 */
export function calcDomesticCheckDigitSteps(base: string): CheckDigitSteps {
  const digits = base.split('').map(Number)
  const weights: number[] = []
  const products: number[] = []
  const weightCycle = [7, 3, 1]

  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    // i=0 is rightmost digit → weight index 0 (=7)
    const w = weightCycle[i % 3]
    const d = digits[digits.length - 1 - i]
    weights.unshift(w)
    products.unshift(d * w)
    sum += d * w
  }

  const nextMultipleOf10 = Math.ceil((sum + 1) / 10) * 10
  const raw = nextMultipleOf10 - sum
  const checkDigit = raw === 10 ? 0 : raw

  return { digits, weights, products, sum, nextMultipleOf10, checkDigit }
}

/**
 * Format a domestic reference number with spaces every 5 digits from the right.
 * E.g. "10620260618" → "10 62026 0618"
 */
export function formatDomesticRef(fullNumber: string): string {
  const reversed = fullNumber.split('').reverse().join('')
  const groups: string[] = []
  for (let i = 0; i < reversed.length; i += 5) {
    groups.push(
      reversed
        .slice(i, i + 5)
        .split('')
        .reverse()
        .join('')
    )
  }
  return groups.reverse().join(' ')
}

/**
 * Generate a domestic Finnish reference number.
 */
export function generateDomesticRef(base: string): ReferenceResult {
  const checkDigit = calcDomesticCheckDigit(base)
  const fullNumber = base + checkDigit
  const formattedReference = formatDomesticRef(fullNumber)
  return { baseNumber: base, checkDigit, formattedReference, referenceType: 'domestic' }
}

// ── RF-viitenumero (ISO 11649 SEPA) ──────────────────────────────────────────

/**
 * Generate an RF creditor reference number (ISO 11649).
 *
 * Algorithm:
 *   1. Build temp = base + "271500"  (R=27, F=15 in letter-to-digit mapping, initial check "00")
 *   2. mod = BigInt(temp) % 97n
 *   3. checkDigits = String(98n - mod).padStart(2, '0')
 *   4. result = "RF" + checkDigits + base
 */
export function generateRfRef(base: string): ReferenceResult {
  const temp = base + '271500'
  const mod = BigInt(temp) % 97n
  const checkNum = 98n - mod
  const checkDigit = String(checkNum).padStart(2, '0')
  const formattedReference = `RF${checkDigit}${base}`
  return { baseNumber: base, checkDigit, formattedReference, referenceType: 'rf' }
}

// ── Shared helpers ────────────────────────────────────────────────────────────

/**
 * Build the base number from optional components.
 * Concatenates: clientCode + yearMonth + invoiceSeq
 * Example: clientCode="106", yearMonth="202606", seq="1" → "1062026061"
 */
export function buildBaseNumber(opts: {
  clientCode?: string
  yearMonth?: string
  invoiceSeq: string
}): string {
  return (opts.clientCode ?? '') + (opts.yearMonth ?? '') + opts.invoiceSeq
}

/**
 * Generate a reference number of the specified type from a base number.
 */
export function generateReference(type: ReferenceType, base: string): ReferenceResult {
  return type === 'rf' ? generateRfRef(base) : generateDomesticRef(base)
}

/**
 * Validate that a base number contains only digits and is non-empty.
 */
export function validateBaseNumber(base: string): string | null {
  if (!base) return 'Base number is required.'
  if (!/^\d+$/.test(base)) return 'Base number must contain digits only.'
  return null
}
