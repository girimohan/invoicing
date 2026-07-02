'use server'

import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export type BookkeeperInvoiceInput = {
  invoiceNumber: string
  issueDate: string   // ISO date string YYYY-MM-DD
  dueDate: string
  paymentTerms: string

  bkName: string
  bkBusinessId: string
  bkVatId: string
  bkAddress: string
  bkPostalCode: string
  bkCity: string
  bkIban: string
  bkBic: string
  bkEmail?: string
  bkPhone?: string

  clientId?: number | null
  clientName: string
  clientBusinessId?: string
  clientVatId?: string
  clientAddress?: string
  clientPostalCode?: string
  clientCity?: string
  clientEmail?: string

  serviceDescription: string
  amountExVat: number
  vatRate: number
  vatAmount: number
  totalIncVat: number

  notes?: string
}

export async function createBookkeeperInvoice(data: BookkeeperInvoiceInput) {
  const invoice = await db.bookkeeperInvoice.create({
    data: {
      invoiceNumber: data.invoiceNumber,
      issueDate: new Date(data.issueDate),
      dueDate: new Date(data.dueDate),
      paymentTerms: data.paymentTerms,
      bkName: data.bkName,
      bkBusinessId: data.bkBusinessId,
      bkVatId: data.bkVatId,
      bkAddress: data.bkAddress,
      bkPostalCode: data.bkPostalCode,
      bkCity: data.bkCity,
      bkIban: data.bkIban,
      bkBic: data.bkBic,
      bkEmail: data.bkEmail || null,
      bkPhone: data.bkPhone || null,
      clientId: data.clientId ?? null,
      clientName: data.clientName,
      clientBusinessId: data.clientBusinessId || null,
      clientVatId: data.clientVatId || null,
      clientAddress: data.clientAddress || null,
      clientPostalCode: data.clientPostalCode || null,
      clientCity: data.clientCity || null,
      clientEmail: data.clientEmail || null,
      serviceDescription: data.serviceDescription,
      amountExVat: data.amountExVat,
      vatRate: data.vatRate,
      vatAmount: data.vatAmount,
      totalIncVat: data.totalIncVat,
      notes: data.notes || null,
    },
  })
  revalidatePath('/bookkeeper')
  return { id: invoice.id }
}

export async function getBookkeeperInvoices() {
  return db.bookkeeperInvoice.findMany({
    orderBy: { createdAt: 'desc' },
  })
}

export async function getBookkeeperInvoice(id: string) {
  return db.bookkeeperInvoice.findUnique({ where: { id } })
}

export async function updateBookkeeperInvoice(id: string, data: BookkeeperInvoiceInput) {
  await db.bookkeeperInvoice.update({
    where: { id },
    data: {
      invoiceNumber: data.invoiceNumber,
      issueDate: new Date(data.issueDate),
      dueDate: new Date(data.dueDate),
      paymentTerms: data.paymentTerms,
      bkName: data.bkName,
      bkBusinessId: data.bkBusinessId,
      bkVatId: data.bkVatId,
      bkAddress: data.bkAddress,
      bkPostalCode: data.bkPostalCode,
      bkCity: data.bkCity,
      bkIban: data.bkIban,
      bkBic: data.bkBic,
      bkEmail: data.bkEmail || null,
      bkPhone: data.bkPhone || null,
      clientId: data.clientId ?? null,
      clientName: data.clientName,
      clientBusinessId: data.clientBusinessId || null,
      clientVatId: data.clientVatId || null,
      clientAddress: data.clientAddress || null,
      clientPostalCode: data.clientPostalCode || null,
      clientCity: data.clientCity || null,
      clientEmail: data.clientEmail || null,
      serviceDescription: data.serviceDescription,
      amountExVat: data.amountExVat,
      vatRate: data.vatRate,
      vatAmount: data.vatAmount,
      totalIncVat: data.totalIncVat,
      notes: data.notes || null,
    },
  })
  revalidatePath('/bookkeeper')
  revalidatePath('/my-vat')
}

export async function deleteBookkeeperInvoice(id: string) {
  await db.bookkeeperInvoice.delete({ where: { id } })
  revalidatePath('/bookkeeper')
  revalidatePath('/my-vat')
}

export async function getNextBkInvoiceNumber(clientDisplayId?: string): Promise<string> {
  const yyyymm = new Date().toISOString().slice(0, 7).replace('-', '')
  const clientPart = clientDisplayId || 'MANUAL'
  const prefix = `BK-${yyyymm}-${clientPart}-`
  const last = await db.bookkeeperInvoice.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: 'desc' },
  })
  if (!last) return `${prefix}1`
  const seq = parseInt(last.invoiceNumber.replace(prefix, ''), 10)
  return `${prefix}${isNaN(seq) ? 1 : seq + 1}`
}

// ─── VAT summary for the bookkeeper's own Oma Vero filing ────────────────────

export interface BkVatQuarter {
  quarter: number          // 1–4
  invoices: {
    id: string
    invoiceNumber: string
    issueDate: Date
    clientName: string
    amountExVat: number
    vatRate: number
    vatAmount: number
    totalIncVat: number
  }[]
  totalExVat: number
  totalVat: number
  totalIncVat: number
}

export async function getBookkeeperVatSummary(year: number) {
  const yearStart = new Date(`${year}-01-01`)
  const yearEnd   = new Date(`${year + 1}-01-01`)

  const invoices = await db.bookkeeperInvoice.findMany({
    where: { issueDate: { gte: yearStart, lt: yearEnd } },
    orderBy: { issueDate: 'asc' },
    select: {
      id: true, invoiceNumber: true, issueDate: true,
      clientName: true, amountExVat: true, vatRate: true, vatAmount: true, totalIncVat: true,
    },
  })

  const r2 = (n: number) => Math.round(n * 100) / 100
  const quarters: BkVatQuarter[] = [1, 2, 3, 4].map((q) => {
    const qInvoices = invoices.filter((i) => {
      const m = new Date(i.issueDate).getMonth()
      return Math.floor(m / 3) + 1 === q
    })
    return {
      quarter: q,
      invoices: qInvoices,
      totalExVat: r2(qInvoices.reduce((s, i) => s + i.amountExVat, 0)),
      totalVat:   r2(qInvoices.reduce((s, i) => s + i.vatAmount, 0)),
      totalIncVat: r2(qInvoices.reduce((s, i) => s + i.totalIncVat, 0)),
    }
  })

  return {
    quarters,
    annualExVat:  r2(invoices.reduce((s, i) => s + i.amountExVat, 0)),
    annualVat:    r2(invoices.reduce((s, i) => s + i.vatAmount, 0)),
    annualIncVat: r2(invoices.reduce((s, i) => s + i.totalIncVat, 0)),
    invoiceCount: invoices.length,
  }
}
