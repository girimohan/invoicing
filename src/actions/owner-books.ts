'use server'

import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'

// ─── Input types ──────────────────────────────────────────────────────────────

export interface OwnerIncomePeriodInput {
  clientId: number
  periodStart: string   // ISO date YYYY-MM-DD
  periodEnd: string
  description?: string
  woltInvoiceRef?: string
  totalExVat: number
  tipsExVat?: number    // Tips income at 0% VAT
  vatRate: number
  notes?: string
}

export interface OwnerExpenseInput {
  clientId: number
  date: string          // ISO date YYYY-MM-DD
  description: string
  supplier?: string
  category: string
  amountExVat: number
  vatRate: number
  receiptRef?: string
  notes?: string
}

// ─── Income period actions ────────────────────────────────────────────────────

export async function createOwnerIncomePeriod(data: OwnerIncomePeriodInput) {
  const tipsExVat = data.tipsExVat ?? 0
  const vatAmount = Math.round(data.totalExVat * (data.vatRate / 100) * 100) / 100
  // Tips are 0% VAT — they are added at face value to the total
  const totalIncVat = Math.round((data.totalExVat + vatAmount + tipsExVat) * 100) / 100
  const record = await db.ownerIncomePeriod.create({
    data: {
      clientId: data.clientId,
      periodStart: new Date(data.periodStart),
      periodEnd: new Date(data.periodEnd),
      description: data.description || null,
      woltInvoiceRef: data.woltInvoiceRef || null,
      totalExVat: data.totalExVat,
      tipsExVat,
      vatRate: data.vatRate,
      vatAmount,
      totalIncVat,
      notes: data.notes || null,
    },
  })
  revalidatePath('/books')
  return record
}

export async function deleteOwnerIncomePeriod(id: string) {
  await db.ownerIncomePeriod.deleteMany({ where: { id } })
  revalidatePath('/books')
}

// ─── Expense actions ──────────────────────────────────────────────────────────

export async function createOwnerExpense(data: OwnerExpenseInput) {
  const vatAmount = Math.round(data.amountExVat * (data.vatRate / 100) * 100) / 100
  const totalAmount = Math.round((data.amountExVat + vatAmount) * 100) / 100
  const record = await db.ownerExpense.create({
    data: {
      clientId: data.clientId,
      date: new Date(data.date),
      description: data.description,
      supplier: data.supplier || null,
      category: data.category,
      amountExVat: data.amountExVat,
      vatRate: data.vatRate,
      vatAmount,
      totalAmount,
      receiptRef: data.receiptRef || null,
      notes: data.notes || null,
    },
  })
  revalidatePath('/books')
  return record
}

export async function deleteOwnerExpense(id: string) {
  await db.ownerExpense.deleteMany({ where: { id } })
  revalidatePath('/books')
}

// ─── Fetch books for a client + year ─────────────────────────────────────────

export async function getOwnerBooks(clientId: number, year: number) {
  const yearStart = new Date(`${year}-01-01`)
  const yearEnd   = new Date(`${year + 1}-01-01`)

  // Fetch the client's business ID for fallback matching.
  // Invoices created before a client was linked have null clientId/buyerClientId
  // but still carry the matching sellerBusinessId / buyerBusinessId field.
  const clientRecord = await db.client.findUnique({
    where: { id: clientId },
    select: { businessId: true },
  })
  const bizId = clientRecord?.businessId ?? null

  const dateFilter = { invoiceDate: { gte: yearStart, lt: yearEnd } }
  const bkDateFilter = { issueDate: { gte: yearStart, lt: yearEnd } }

  // Build OR conditions for seller-side and buyer-side invoice lookup
  const sellerCondition = bizId
    ? { OR: [{ clientId }, { sellerBusinessId: bizId }], ...dateFilter }
    : { clientId, ...dateFilter }

  const buyerCondition = bizId
    ? { OR: [{ buyerClientId: clientId }, { buyerBusinessId: bizId }], ...dateFilter }
    : { buyerClientId: clientId, ...dateFilter }

  const [incomes, expenses, linkedInvoices, sellerInvoices, bookkeeperInvoices] = await Promise.all([
    db.ownerIncomePeriod.findMany({
      where: { clientId, periodStart: { gte: yearStart, lt: yearEnd } },
      orderBy: { periodStart: 'asc' },
    }),
    db.ownerExpense.findMany({
      where: { clientId, date: { gte: yearStart, lt: yearEnd } },
      orderBy: { date: 'asc' },
    }),
    // Invoices where this client is the ACCOUNT HOLDER (buyer/payer side)
    db.invoice.findMany({
      where: buyerCondition,
      include: { lineItems: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { invoiceDate: 'asc' },
    }),
    // Invoices where this client is the SUBSTITUTE WORKER (seller/recipient side)
    db.invoice.findMany({
      where: sellerCondition,
      include: { lineItems: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { invoiceDate: 'asc' },
    }),
    // Bookkeeper invoices ISSUED BY this client (Mohan as bookkeeper to his clients)
    bizId
      ? db.bookkeeperInvoice.findMany({
          where: { bkBusinessId: bizId, ...bkDateFilter },
          orderBy: { issueDate: 'asc' },
        })
      : Promise.resolve([]),
  ])

  // Deduplicate by id (OR conditions can theoretically match same invoice twice
  // if both clientId and businessId are set on the same invoice)
  const dedup = <T extends { id: string }>(arr: T[]) =>
    arr.filter((item, i, a) => a.findIndex(x => x.id === item.id) === i)

  return {
    incomes,
    expenses,
    linkedInvoices: dedup(linkedInvoices),
    sellerInvoices: dedup(sellerInvoices),
    bookkeeperInvoices,
  }
}
