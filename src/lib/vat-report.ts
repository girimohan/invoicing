// Pure VAT period/month computation shared between the Client Books VAT tab
// (src/components/BooksApp.tsx) and the VAT filing PDF report route
// (src/app/api/vat-report/pdf/route.ts) — kept framework-free so both a
// client component and a server route can call it and never drift apart.

import { round2 } from './calculations'

// ─── Source record types (subset of fields these computations need) ───────────

export type IncomePeriod = {
  id: string
  periodStart: Date
  periodEnd: Date
  description: string | null
  woltInvoiceRef: string | null
  totalExVat: number
  tipsExVat: number
  vatRate: number
  vatAmount: number
  totalIncVat: number
  notes: string | null
}

export type Expense = {
  id: string
  date: Date
  description: string
  supplier: string | null
  category: string
  amountExVat: number
  vatRate: number
  vatAmount: number
  totalAmount: number
  receiptRef: string | null
}

export type LineItem = {
  earnedAmount: number
  sharePercent: number
  vatRate: number
  amountExVat: number
  vatAmount: number
}

export type LinkedInvoice = {
  id: string
  invoiceNumber: string
  invoiceDate: Date
  periodEnd: Date       // service period end — used for VAT quarter assignment
  sellerName: string
  buyerName: string
  totalExVat: number
  totalVat: number
  totalIncVat: number
  lineItems: LineItem[]
}

export type BookkeeperInvoice = {
  id: string
  invoiceNumber: string
  issueDate: Date
  periodEnd: Date
  clientName: string
  amountExVat: number
  vatRate: number
  vatAmount: number
  totalIncVat: number
}

export type ReceivedBkInvoice = {
  id: string
  invoiceNumber: string
  issueDate: Date
  periodEnd: Date
  amountExVat: number
  vatRate: number
  vatAmount: number
  totalIncVat: number
}

export type VatFilingFrequency = 'quarterly' | 'semiannual' | 'annual'

export type MonthVat = {
  m: number // 0-11
  outVatOwn: number; outVatSubs: number; outVatBk: number; outVat: number
  inVatW: number; inVatBkFee: number; inVatE: number; net: number
  qi: IncomePeriod[]; ql: LinkedInvoice[]; qs: LinkedInvoice[]
  qe: Expense[]; qbk: BookkeeperInvoice[]; qRecBk: ReceivedBkInvoice[]
}

export type VatPeriod = {
  key: string
  label: string
  months: MonthVat[]
  outVatOwn: number; outVatSubs: number; outVatBk: number; outVat: number
  inVatW: number; inVatBkFee: number; inVatE: number; net: number
}

export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function sumMonths(months: MonthVat[]) {
  const sum = (f: (m: MonthVat) => number) => round2(months.reduce((s, m) => s + f(m), 0))
  return {
    outVatOwn: sum(m => m.outVatOwn), outVatSubs: sum(m => m.outVatSubs), outVatBk: sum(m => m.outVatBk),
    outVat: sum(m => m.outVat), inVatW: sum(m => m.inVatW), inVatBkFee: sum(m => m.inVatBkFee),
    inVatE: sum(m => m.inVatE), net: sum(m => m.net),
  }
}

export type VatReportSourceData = {
  incomes: IncomePeriod[]
  linkedInvoices: LinkedInvoice[]
  sellerInvoices: LinkedInvoice[]
  expenses: Expense[]
  bookkeeperInvoices: BookkeeperInvoice[]
  receivedBkInvoices: ReceivedBkInvoice[]
}

// ── Monthly VAT breakdown, source-attributed and kept alongside the raw
// contributing records so period/month rows can be expanded for a full trace. ──
export function computeMonths(data: VatReportSourceData, isAccountHolder: boolean): MonthVat[] {
  const { incomes, linkedInvoices, sellerInvoices, expenses, bookkeeperInvoices, receivedBkInvoices } = data
  return Array.from({ length: 12 }, (_, m) => {
    const qi = incomes.filter(i => new Date(i.periodStart).getMonth() === m)
    // Use periodEnd (service period) not invoiceDate — a June 15-30 job invoiced in July is Q2 VAT
    const ql = linkedInvoices.filter(i => new Date(i.periodEnd).getMonth() === m)
    const qs = sellerInvoices.filter(i => new Date(i.periodEnd).getMonth() === m)
    const qe = expenses.filter(e => new Date(e.date).getMonth() === m)
    // Use periodEnd (service period) for BK invoices too, consistent with client invoices
    const qbk = bookkeeperInvoices.filter(i => new Date(i.periodEnd).getMonth() === m)
    const qRecBk = receivedBkInvoices.filter(i => new Date(i.periodEnd).getMonth() === m)
    const qlItems = ql.flatMap(i => i.lineItems)
    if (isAccountHolder) {
      const outVatOwn  = round2(qi.reduce((s, i) => s + i.vatAmount, 0))
      const outVatSubs = round2(qlItems.reduce((s, li) => s + li.earnedAmount * li.vatRate / 100, 0))
      const outVatBk   = round2(qbk.reduce((s, i) => s + i.vatAmount, 0))
      const outVat     = round2(outVatOwn + outVatSubs + outVatBk)
      const inVatW     = round2(ql.reduce((s, i) => s + i.totalVat, 0))
      const inVatBkFee = round2(qRecBk.reduce((s, i) => s + i.vatAmount, 0))
      const inVatE     = round2(qe.reduce((s, e) => s + e.vatAmount, 0))
      return { m, outVat, outVatOwn, outVatSubs, outVatBk, inVatW, inVatBkFee, inVatE, net: round2(outVat - inVatW - inVatBkFee - inVatE), qi, ql, qs, qe, qbk, qRecBk }
    } else {
      const outVat    = round2(qs.reduce((s, i) => s + i.totalVat, 0))
      const inVatBkFee = round2(qRecBk.reduce((s, i) => s + i.vatAmount, 0))
      const inVatE    = round2(qe.reduce((s, e) => s + e.vatAmount, 0))
      return { m, outVat, outVatOwn: 0, outVatSubs: 0, outVatBk: 0, inVatW: 0, inVatBkFee, inVatE, net: round2(outVat - inVatBkFee - inVatE), qi, ql, qs, qe, qbk, qRecBk }
    }
  })
}

// ── Group months into filing periods (quarterly/semiannual/annual) ──────────
export function computePeriods(months: MonthVat[], filingFrequency: VatFilingFrequency, year: number): VatPeriod[] {
  const bucket = (key: string, label: string, ms: MonthVat[]): VatPeriod => ({ key, label, months: ms, ...sumMonths(ms) })
  if (filingFrequency === 'annual') {
    return [bucket('annual-0', `FY ${year}`, months)]
  }
  if (filingFrequency === 'semiannual') {
    return [
      bucket('half-0', `H1 (${MONTH_NAMES[0]}–${MONTH_NAMES[5]})`, months.slice(0, 6)),
      bucket('half-1', `H2 (${MONTH_NAMES[6]}–${MONTH_NAMES[11]})`, months.slice(6, 12)),
    ]
  }
  return [0, 1, 2, 3].map((q) =>
    bucket(`q-${q}`, `Q${q + 1} (${MONTH_NAMES[q * 3]}–${MONTH_NAMES[q * 3 + 2]})`, months.slice(q * 3, q * 3 + 3))
  )
}
