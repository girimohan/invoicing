/**
 * Exercises the real createOwnerIncomePeriod server action — the dashboard's
 * income entry writes through this path, and the VAT amount it stores lands
 * directly in a client's VAT return.
 *
 * Runs against a disposable database built from prisma/seed.db (schema only,
 * no data), created before the Prisma client is imported. It must never touch
 * prisma/dev.db or the installed app's database.
 */
import fs from 'fs'
import os from 'os'
import path from 'path'

const tmpDb = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'barmo-test-')), 'test.db')
fs.copyFileSync(path.join(process.cwd(), 'prisma', 'seed.db'), tmpDb)
process.env.DATABASE_URL = `file:${tmpDb}`

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

// Imported after DATABASE_URL is set so the Prisma client binds to the temp DB.
const { createOwnerIncomePeriod, deleteOwnerIncomePeriod } = require('./owner-books')
const { db } = require('@/lib/db')

let CLIENT_ID: number
const created: string[] = []

beforeAll(async () => {
  const client = await db.client.create({
    data: { displayId: 'T01', role: 'ACCOUNT_HOLDER', name: 'Test Client' },
  })
  CLIENT_ID = client.id
})

afterAll(async () => {
  for (const id of created) await deleteOwnerIncomePeriod(id)
  await db.client.deleteMany({ where: { displayId: 'T01' } })
  await db.$disconnect()
  fs.rmSync(path.dirname(tmpDb), { recursive: true, force: true })
})

async function make(input: Record<string, unknown>) {
  const rec = await createOwnerIncomePeriod(input)
  created.push(rec.id)
  return rec
}

const base = () => ({
  clientId: CLIENT_ID,
  periodStart: '2026-03-01',
  periodEnd: '2026-03-31',
  vatRate: 25.5,
})

describe('createOwnerIncomePeriod', () => {
  it('derives VAT from the rate when none is supplied', async () => {
    const rec = await make({ ...base(), totalExVat: 1000 })
    expect(rec.vatAmount).toBe(255)
    expect(rec.totalIncVat).toBe(1255)
  })

  it('stores the platform-stated VAT amount verbatim when supplied', async () => {
    // Wolt rounds per line, so its stated VAT can differ a cent from rate x net.
    const rec = await make({ ...base(), totalExVat: 1000, vatAmount: 254.98 })
    expect(rec.vatAmount).toBe(254.98)
    expect(rec.totalIncVat).toBe(1254.98)
  })

  it('adds tips at face value without charging VAT on them', async () => {
    const rec = await make({ ...base(), totalExVat: 1000, tipsExVat: 40 })
    expect(rec.vatAmount).toBe(255)          // VAT on fees only
    expect(rec.tipsExVat).toBe(40)
    expect(rec.totalIncVat).toBe(1295)       // 1000 + 255 + 40
  })

  it('combines a stated VAT amount with tips correctly', async () => {
    const rec = await make({ ...base(), totalExVat: 880.5, vatAmount: 224.53, tipsExVat: 12.25 })
    expect(rec.vatAmount).toBe(224.53)
    expect(rec.totalIncVat).toBe(1117.28)    // 880.50 + 224.53 + 12.25
  })

  it('ignores a non-finite VAT override rather than storing NaN', async () => {
    const rec = await make({ ...base(), totalExVat: 200, vatAmount: NaN })
    expect(rec.vatAmount).toBe(51)
    expect(Number.isNaN(rec.totalIncVat)).toBe(false)
  })

  it('keeps the service period, which decides the VAT quarter', async () => {
    const rec = await make({ ...base(), periodStart: '2026-06-16', periodEnd: '2026-06-30', totalExVat: 100 })
    expect(new Date(rec.periodEnd).getMonth()).toBe(5) // June → Q2
  })
})
