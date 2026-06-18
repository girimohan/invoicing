'use server'

import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export type ClientRole = 'SUBSTITUTE_WORKER' | 'ACCOUNT_HOLDER'

export type ClientInput = {
  displayId: string
  role: ClientRole
  name: string
  businessId?: string
  vatId?: string
  address?: string
  postalCode?: string
  city?: string
  email?: string
  phone?: string
  iban?: string
  bic?: string
  notes?: string
  shareType?: string          // 'PERCENT' | 'AMOUNT'
  defaultSharePercent?: number
  defaultShareAmount?: number
}

export async function getClients() {
  const clients = await db.client.findMany({
    orderBy: { displayId: 'asc' },
    include: { _count: { select: { invoices: true, buyerInvoices: true } } },
  })
  // Map to plain objects to ensure all fields (including role) are serialized in RSC payload
  return clients.map(c => ({
    id: c.id,
    displayId: c.displayId,
    role: c.role,
    name: c.name,
    businessId: c.businessId,
    vatId: c.vatId,
    address: c.address,
    postalCode: c.postalCode,
    city: c.city,
    email: c.email,
    phone: c.phone,
    iban: c.iban,
    bic: c.bic,
    notes: c.notes,
    shareType: c.shareType,
    defaultSharePercent: c.defaultSharePercent,
    defaultShareAmount: c.defaultShareAmount,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    invoiceCount: c._count.invoices,
    buyerInvoiceCount: c._count.buyerInvoices,
  }))
}

export async function getClientsByRole(role: ClientRole) {
  return db.client.findMany({ where: { role }, orderBy: { displayId: 'asc' } })
}

export async function getClient(id: number) {
  return db.client.findUnique({ where: { id } })
}

export async function getNextClientDisplayId(): Promise<string> {
  const last = await db.client.findFirst({ orderBy: { displayId: 'desc' } })
  if (!last) return '101'
  const num = parseInt(last.displayId, 10)
  return isNaN(num) ? '101' : String(num + 1)
}

export async function createClient(data: ClientInput) {
  const client = await db.client.create({
    data: {
      displayId: data.displayId,
      role: data.role,
      name: data.name,
      businessId: data.businessId || null,
      vatId: data.vatId || null,
      address: data.address || null,
      postalCode: data.postalCode || null,
      city: data.city || null,
      email: data.email || null,
      phone: data.phone || null,
      iban: data.iban || null,
      bic: data.bic || null,
      notes: data.notes || null,
      shareType: data.shareType || 'PERCENT',
      defaultSharePercent: data.defaultSharePercent ?? null,
      defaultShareAmount: data.defaultShareAmount ?? null,
    },
  })
  revalidatePath('/clients')
  return client
}

export async function updateClient(id: number, data: ClientInput) {
  const client = await db.client.update({
    where: { id },
    data: {
      displayId: data.displayId,
      role: data.role,
      name: data.name,
      businessId: data.businessId || null,
      vatId: data.vatId || null,
      address: data.address || null,
      postalCode: data.postalCode || null,
      city: data.city || null,
      email: data.email || null,
      phone: data.phone || null,
      iban: data.iban || null,
      bic: data.bic || null,
      notes: data.notes || null,
      shareType: data.shareType || 'PERCENT',
      defaultSharePercent: data.defaultSharePercent ?? null,
      defaultShareAmount: data.defaultShareAmount ?? null,
    },
  })
  revalidatePath('/clients')
  return client
}

export async function deleteClient(id: number) {
  await db.$transaction([
    // Unlink any invoices that reference this client
    db.invoice.updateMany({ where: { clientId: id }, data: { clientId: null } }),
    db.client.delete({ where: { id } }),
  ])
  revalidatePath('/clients')
}
