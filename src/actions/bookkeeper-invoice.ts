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
