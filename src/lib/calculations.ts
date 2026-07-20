import type { Calculated, LineItemRow, VatBreakdown } from '@/types/invoice'

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function calculateInvoice(lineItems: LineItemRow[]): Calculated {
  const computed = lineItems.map((item) => {
    const earned = parseFloat(item.earnedAmount) || 0
    const share = parseFloat(item.sharePercent) ?? 100
    const flatAmt = parseFloat(item.shareAmount) || 0
    const vatPct = parseFloat(item.vatRate) || 0

    // AMOUNT mode: worker receives a fixed euro amount (e.g. 250 €)
    // PERCENT mode: worker receives a % of the Wolt gross
    const amountExVat = item.shareType === 'AMOUNT'
      ? round2(flatAmt)
      : round2(earned * share / 100)
    const vatAmount = round2(amountExVat * (vatPct / 100))
    const totalAmount = round2(amountExVat + vatAmount)

    return { amountExVat, vatAmount, totalAmount, vatRate: vatPct }
  })

  const totalExVat = round2(computed.reduce((s, i) => s + i.amountExVat, 0))
  const totalVat = round2(computed.reduce((s, i) => s + i.vatAmount, 0))
  const totalIncVat = round2(computed.reduce((s, i) => s + i.totalAmount, 0))

  // Group by VAT rate for VAT filing breakdown
  const vatMap = new Map<number, { base: number; vat: number }>()
  computed.forEach((item) => {
    const entry = vatMap.get(item.vatRate) ?? { base: 0, vat: 0 }
    vatMap.set(item.vatRate, {
      base: round2(entry.base + item.amountExVat),
      vat: round2(entry.vat + item.vatAmount),
    })
  })

  const vatBreakdown: VatBreakdown[] = Array.from(vatMap.entries())
    .map(([rate, { base, vat }]) => ({ rate, base, vat }))
    .sort((a, b) => b.rate - a.rate)

  return {
    lineItems: computed.map(({ amountExVat, vatAmount, totalAmount }) => ({
      amountExVat,
      vatAmount,
      totalAmount,
    })),
    totalExVat,
    totalVat,
    totalIncVat,
    vatBreakdown,
  }
}

export function formatCurrency(n: number): string {
  return n.toFixed(2)
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${d}.${m}.${y}`
}

export function formatDateFromDate(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const y = date.getFullYear()
  return `${d}.${m}.${y}`
}

export function formatIban(iban: string): string {
  const clean = iban.replace(/\s/g, '')
  return clean.match(/.{1,4}/g)?.join(' ') ?? iban
}

// VAT quarter (1-4) for a given date — Finnish VAT filing is quarterly.
export function getQuarter(d: Date | string): number {
  return Math.floor(new Date(d).getMonth() / 3) + 1
}
