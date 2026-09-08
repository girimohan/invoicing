'use server'

import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { round2 } from '@/lib/calculations'

export type VatFilingInput = {
  clientId: number
  year: number
  periodKey: string
  frequency: string
  periodStart: string   // ISO date
  periodEnd: string
  dueDate: string
  filedOn: string
  outputVat: number
  deductibleVat: number
  netVat: number
  notes?: string
}

export type VatFilingRecord = {
  id: string
  clientId: number
  year: number
  periodKey: string
  frequency: string
  dueDate: string
  filedOn: string
  outputVat: number
  deductibleVat: number
  netVat: number
  notes: string | null
}

const serialise = (f: {
  id: string; clientId: number; year: number; periodKey: string; frequency: string
  dueDate: Date; filedOn: Date; outputVat: number; deductibleVat: number; netVat: number; notes: string | null
}): VatFilingRecord => ({
  id: f.id,
  clientId: f.clientId,
  year: f.year,
  periodKey: f.periodKey,
  frequency: f.frequency,
  dueDate: f.dueDate.toISOString(),
  filedOn: f.filedOn.toISOString(),
  outputVat: f.outputVat,
  deductibleVat: f.deductibleVat,
  netVat: f.netVat,
  notes: f.notes,
})

/**
 * Record that a period was filed. Re-filing the same period overwrites the
 * snapshot — that is what happens after a replacement return, and keeping two
 * rows for one period would make "what was filed" ambiguous.
 */
export async function recordVatFiling(data: VatFilingInput): Promise<VatFilingRecord> {
  const payload = {
    frequency: data.frequency,
    periodStart: new Date(data.periodStart),
    periodEnd: new Date(data.periodEnd),
    dueDate: new Date(data.dueDate),
    filedOn: new Date(data.filedOn),
    outputVat: round2(data.outputVat),
    deductibleVat: round2(data.deductibleVat),
    netVat: round2(data.netVat),
    notes: data.notes?.trim() || null,
  }

  const record = await db.vatFiling.upsert({
    where: {
      clientId_year_periodKey: {
        clientId: data.clientId, year: data.year, periodKey: data.periodKey,
      },
    },
    update: payload,
    create: { clientId: data.clientId, year: data.year, periodKey: data.periodKey, ...payload },
  })

  revalidatePath('/')
  revalidatePath('/filing')
  return serialise(record)
}

/** Undo a filing record — for when it was marked filed by mistake. */
export async function deleteVatFiling(clientId: number, year: number, periodKey: string) {
  await db.vatFiling.deleteMany({ where: { clientId, year, periodKey } })
  revalidatePath('/')
  revalidatePath('/filing')
}

export async function getVatFilings(clientId: number, year: number): Promise<VatFilingRecord[]> {
  const rows = await db.vatFiling.findMany({
    where: { clientId, year },
    orderBy: { periodKey: 'asc' },
  })
  return rows.map(serialise)
}
