'use server'

import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import type { InvoiceInput } from '@/types/invoice'
import {
  buildBaseNumber,
  generateReference,
  validateBaseNumber,
} from '@/lib/viitenumero'

async function buildReferenceData(data: InvoiceInput) {
  if (!data.includeReference) return null

  const refSeq = data.refInvoiceSeq?.trim()
  if (!refSeq) throw new Error('Invoice sequence is required for reference number generation.')

  const base = buildBaseNumber({
    clientCode: data.refClientCode?.trim() || undefined,
    yearMonth: data.refYearMonth?.trim() || undefined,
    invoiceSeq: refSeq,
  })

  const validationError = validateBaseNumber(base)
  if (validationError) throw new Error(validationError)

  const refType = data.referenceType ?? 'domestic'
  const result = generateReference(refType, base)

  // Uniqueness check — reject if this formatted reference is already used
  const existing = await db.invoiceReference.findUnique({
    where: { formattedReference: result.formattedReference },
  })
  if (existing) {
    throw new Error(
      `Reference number "${result.formattedReference}" is already assigned to another invoice. ` +
        'Please increment the invoice sequence or change the input values.'
    )
  }

  return result
}

export async function saveInvoice(data: InvoiceInput): Promise<{ id: string }> {
  const refData = await buildReferenceData(data)

  const invoice = await db.invoice.create({
    data: {
      invoiceNumber: data.invoiceNumber,
      invoiceDate: new Date(data.invoiceDate),
      dueDate: new Date(data.dueDate),
      paymentTerms: data.paymentTerms,
      periodStart: new Date(data.periodStart),
      periodEnd: new Date(data.periodEnd),
      woltInvoiceNumber: data.woltInvoiceNumber || null,
      woltInvoiceDate: data.woltInvoiceDate ? new Date(data.woltInvoiceDate) : null,

      sellerName: data.sellerName,
      sellerAddress: data.sellerAddress,
      sellerPostalCode: data.sellerPostalCode,
      sellerCity: data.sellerCity,
      sellerBusinessId: data.sellerBusinessId,
      sellerVatId: data.sellerVatId,
      sellerIban: data.sellerIban,
      sellerBic: data.sellerBic,
      sellerEmail: data.sellerEmail || null,
      sellerPhone: data.sellerPhone || null,

      buyerName: data.buyerName,
      buyerAddress: data.buyerAddress,
      buyerPostalCode: data.buyerPostalCode,
      buyerCity: data.buyerCity,
      buyerBusinessId: data.buyerBusinessId,
      buyerVatId: data.buyerVatId,

      totalExVat: data.totalExVat,
      totalVat: data.totalVat,
      totalIncVat: data.totalIncVat,

      clientId: data.workerId ?? null,
      buyerClientId: data.buyerClientId ?? null,
      notes: data.notes || null,

      lineItems: {
        create: data.lineItems.map((item, idx) => ({
          description: item.description,
          earnedAmount: item.earnedAmount,
          sharePercent: Math.round(item.sharePercent),
          shareType: item.shareType ?? 'PERCENT',
          shareAmount: item.shareAmount ?? 0,
          vatRate: item.vatRate,
          amountExVat: item.amountExVat,
          vatAmount: item.vatAmount,
          totalAmount: item.totalAmount,
          sortOrder: idx,
        })),
      },

      ...(refData
        ? {
            reference: {
              create: {
                baseNumber: refData.baseNumber,
                checkDigit: refData.checkDigit,
                formattedReference: refData.formattedReference,
                referenceType: refData.referenceType,
              },
            },
          }
        : {}),
    },
  })

  revalidatePath('/invoices')
  return { id: invoice.id }
}

export async function getInvoices() {
  return db.invoice.findMany({
    orderBy: { invoiceDate: 'desc' },
    include: {
      lineItems: { orderBy: { sortOrder: 'asc' } },
      client: { select: { id: true, displayId: true, name: true } },
      buyerClient: { select: { id: true, displayId: true, name: true } },
      reference: true,
    },
  })
}

export async function getInvoice(id: string) {
  return db.invoice.findUnique({
    where: { id },
    include: {
      lineItems: { orderBy: { sortOrder: 'asc' } },
      reference: true,
    },
  })
}

export async function updateInvoice(id: string, data: InvoiceInput): Promise<{ id: string }> {
  // Reference numbers are immutable once saved — never overwrite an existing one.
  // Only create a new reference if the invoice doesn't already have one.
  const existing = await db.invoice.findUnique({
    where: { id },
    select: { reference: { select: { id: true } } },
  })
  const hasExistingRef = !!existing?.reference

  let newRefData = null
  if (!hasExistingRef && data.includeReference) {
    newRefData = await buildReferenceData(data)
  }

  const invoice = await db.invoice.update({
    where: { id },
    data: {
      invoiceNumber: data.invoiceNumber,
      invoiceDate: new Date(data.invoiceDate),
      dueDate: new Date(data.dueDate),
      paymentTerms: data.paymentTerms,
      periodStart: new Date(data.periodStart),
      periodEnd: new Date(data.periodEnd),
      woltInvoiceNumber: data.woltInvoiceNumber || null,
      woltInvoiceDate: data.woltInvoiceDate ? new Date(data.woltInvoiceDate) : null,

      sellerName: data.sellerName,
      sellerAddress: data.sellerAddress,
      sellerPostalCode: data.sellerPostalCode,
      sellerCity: data.sellerCity,
      sellerBusinessId: data.sellerBusinessId,
      sellerVatId: data.sellerVatId,
      sellerIban: data.sellerIban,
      sellerBic: data.sellerBic,
      sellerEmail: data.sellerEmail || null,
      sellerPhone: data.sellerPhone || null,

      buyerName: data.buyerName,
      buyerAddress: data.buyerAddress,
      buyerPostalCode: data.buyerPostalCode,
      buyerCity: data.buyerCity,
      buyerBusinessId: data.buyerBusinessId,
      buyerVatId: data.buyerVatId,

      totalExVat: data.totalExVat,
      totalVat: data.totalVat,
      totalIncVat: data.totalIncVat,

      clientId: data.workerId ?? null,
      buyerClientId: data.buyerClientId ?? null,
      notes: data.notes || null,

      lineItems: {
        deleteMany: {},
        create: data.lineItems.map((item, idx) => ({
          description: item.description,
          earnedAmount: item.earnedAmount,
          sharePercent: Math.round(item.sharePercent),
          shareType: item.shareType ?? 'PERCENT',
          shareAmount: item.shareAmount ?? 0,
          vatRate: item.vatRate,
          amountExVat: item.amountExVat,
          vatAmount: item.vatAmount,
          totalAmount: item.totalAmount,
          sortOrder: idx,
        })),
      },

      ...(newRefData
        ? {
            reference: {
              create: {
                baseNumber: newRefData.baseNumber,
                checkDigit: newRefData.checkDigit,
                formattedReference: newRefData.formattedReference,
                referenceType: newRefData.referenceType,
              },
            },
          }
        : {}),
    },
  })

  revalidatePath('/invoices')
  revalidatePath('/')
  return { id: invoice.id }
}

export async function deleteInvoice(id: string) {
  await db.invoice.deleteMany({ where: { id } })
  revalidatePath('/invoices')
}

/**
 * Returns next sequential invoice number for the current calendar year.
 * Format: YYYY-NNN  (e.g. 2026-001)
 */
export async function getNextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const count = await db.invoice.count({
    where: {
      invoiceDate: {
        gte: new Date(`${year}-01-01`),
        lt: new Date(`${year + 1}-01-01`),
      },
    },
  })
  return `${year}-${String(count + 1).padStart(3, '0')}`
}

/**
 * Returns VAT filing summary for a given year.
 * Groups all invoices by VAT rate to produce turnover and VAT totals.
 */
export async function getVatFilingSummary(year: number) {
  const invoices = await db.invoice.findMany({
    where: {
      invoiceDate: {
        gte: new Date(`${year}-01-01`),
        lt: new Date(`${year + 1}-01-01`),
      },
    },
    include: { lineItems: true },
  })

  const vatMap = new Map<number, { base: number; vat: number }>()
  for (const inv of invoices) {
    for (const item of inv.lineItems) {
      const entry = vatMap.get(item.vatRate) ?? { base: 0, vat: 0 }
      vatMap.set(item.vatRate, {
        base: Math.round((entry.base + item.amountExVat) * 100) / 100,
        vat: Math.round((entry.vat + item.vatAmount) * 100) / 100,
      })
    }
  }

  return Array.from(vatMap.entries())
    .map(([rate, { base, vat }]) => ({ rate, base, vat }))
    .sort((a, b) => b.rate - a.rate)
}
