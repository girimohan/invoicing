'use server'

import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { round2, getQuarter } from '@/lib/calculations'

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
  // Bookkeeper invoices are bucketed into VAT periods by service period end,
  // not issueDate — matches how client invoices use periodEnd (see getGigVatSummary).
  const bkDateFilter = { periodEnd: { gte: yearStart, lt: yearEnd } }

  // Build OR conditions for seller-side and buyer-side invoice lookup
  const sellerCondition = bizId
    ? { OR: [{ clientId }, { sellerBusinessId: bizId }], ...dateFilter }
    : { clientId, ...dateFilter }

  const buyerCondition = bizId
    ? { OR: [{ buyerClientId: clientId }, { buyerBusinessId: bizId }], ...dateFilter }
    : { buyerClientId: clientId, ...dateFilter }

  const [incomes, expenses, linkedInvoices, sellerInvoices, bookkeeperInvoices, receivedBkInvoices] = await Promise.all([
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
    // Bookkeeper invoices ISSUED BY this client (only relevant when client IS the bookkeeper)
    bizId
      ? db.bookkeeperInvoice.findMany({
          where: { bkBusinessId: bizId, ...bkDateFilter },
          orderBy: { periodEnd: 'asc' },
        })
      : Promise.resolve([]),
    // Bookkeeper invoices RECEIVED BY this client (fees paid to bookkeeper = client's input VAT)
    db.bookkeeperInvoice.findMany({
      where: { clientId, ...bkDateFilter },
      orderBy: { periodEnd: 'asc' },
      select: { id: true, invoiceNumber: true, issueDate: true, periodStart: true, periodEnd: true, amountExVat: true, vatRate: true, vatAmount: true, totalIncVat: true },
    }),
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
    receivedBkInvoices,
  }
}

// ─── Gig-work VAT summary for Oma Vero (used by /my-vat page) ────────────────
// Returns per-quarter gig-work VAT breakdown WITHOUT BK invoice income
// (BK invoices are fetched separately by getBookkeeperVatSummary to avoid double-counting)

export interface GigVatQuarter {
  quarter: number
  gigIncomeExVat: number     // own delivery fees ex-VAT
  tipsExVat: number          // tips (VAT-exempt)
  gigOutputVat: number       // output VAT on own courier fees
  subsOutputVat: number      // output VAT on substitute-worker periods (full Wolt gross × rate)
  workerInputVat: number     // input VAT on substitute worker invoices (deductible)
  expenseInputVat: number    // input VAT on own business expenses (deductible)
}

export async function getGigVatSummary(clientId: number, year: number): Promise<{
  clientName: string
  quarters: GigVatQuarter[]
  annualGigOutputVat: number
  annualSubsOutputVat: number
  annualWorkerInputVat: number
  annualExpenseInputVat: number
}> {
  const yearStart = new Date(`${year}-01-01`)
  const yearEnd   = new Date(`${year + 1}-01-01`)

  const clientRecord = await db.client.findUnique({
    where: { id: clientId },
    select: { name: true, businessId: true },
  })
  const bizId = clientRecord?.businessId ?? null

  const dateFilter   = { invoiceDate: { gte: yearStart, lt: yearEnd } }
  const buyerCondition = bizId
    ? { OR: [{ buyerClientId: clientId }, { buyerBusinessId: bizId }], ...dateFilter }
    : { buyerClientId: clientId, ...dateFilter }

  const [incomes, expenses, linkedInvoices] = await Promise.all([
    db.ownerIncomePeriod.findMany({
      where: { clientId, periodStart: { gte: yearStart, lt: yearEnd } },
      select: { periodStart: true, totalExVat: true, tipsExVat: true, vatRate: true, vatAmount: true },
    }),
    db.ownerExpense.findMany({
      where: { clientId, date: { gte: yearStart, lt: yearEnd } },
      select: { date: true, vatAmount: true },
    }),
    db.invoice.findMany({
      where: buyerCondition,
      select: {
        id: true, invoiceDate: true, periodEnd: true, totalVat: true,
        lineItems: { select: { earnedAmount: true, vatRate: true } },
      },
    }),
  ])

  const dedupLinked = linkedInvoices.filter((item, i, a) => a.findIndex(x => x.id === item.id) === i)

  const quarters: GigVatQuarter[] = [1, 2, 3, 4].map((q) => {
    const qi   = incomes.filter(i => getQuarter(i.periodStart) === q)
    // Use periodEnd (service period) not invoiceDate for VAT quarter — Jun 15-30 job invoiced in Jul = Q2 VAT
    const ql   = dedupLinked.filter(i => getQuarter(i.periodEnd) === q)
    const qe   = expenses.filter(e => getQuarter(e.date) === q)
    const qlItems = ql.flatMap(i => i.lineItems)

    return {
      quarter: q,
      gigIncomeExVat: round2(qi.reduce((s, i) => s + i.totalExVat, 0)),
      tipsExVat:      round2(qi.reduce((s, i) => s + (i.tipsExVat ?? 0), 0)),
      gigOutputVat:   round2(qi.reduce((s, i) => s + i.vatAmount, 0)),
      subsOutputVat:  round2(qlItems.reduce((s, li) => s + li.earnedAmount * li.vatRate / 100, 0)),
      workerInputVat: round2(ql.reduce((s, i) => s + i.totalVat, 0)),
      expenseInputVat: round2(qe.reduce((s, e) => s + e.vatAmount, 0)),
    }
  })

  return {
    clientName: clientRecord?.name ?? '',
    quarters,
    annualGigOutputVat:   round2(quarters.reduce((s, q) => s + q.gigOutputVat, 0)),
    annualSubsOutputVat:  round2(quarters.reduce((s, q) => s + q.subsOutputVat, 0)),
    annualWorkerInputVat: round2(quarters.reduce((s, q) => s + q.workerInputVat, 0)),
    annualExpenseInputVat: round2(quarters.reduce((s, q) => s + q.expenseInputVat, 0)),
  }
}
