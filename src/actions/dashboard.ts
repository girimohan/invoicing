'use server'

import { db } from '@/lib/db'
import { round2 } from '@/lib/calculations'
import { computeMonths, type MonthVat } from '@/lib/vat-report'
import { getOwnerBooks } from '@/actions/owner-books'

// The dashboard deliberately reuses getOwnerBooks() + computeMonths() rather
// than running its own aggregate SQL: the headline number a client sees here
// must be the same number the Client Books VAT tab shows when they drill in,
// and one shared code path is the only way to guarantee that. At a handful of
// clients on local SQLite the extra queries are not worth optimising away.

/** Per-month VAT totals without the bulky source records MonthVat carries. */
export type MonthTotals = {
  m: number
  outVat: number
  inVat: number
  net: number
  incomeExVat: number
  expenseExVat: number
}

export type ClientDashboardRow = {
  id: number
  displayId: string
  name: string
  role: string
  months: MonthTotals[]
  /** Most recent income period end or expense date in the year, ISO or null. */
  lastEntryAt: string | null
  entryCount: number
  /** Bookkeeping fees already invoiced to this client, by service period. */
  billedPeriods: { periodStart: string; periodEnd: string; totalIncVat: number }[]
}

export type DashboardSummary = {
  year: number
  clients: ClientDashboardRow[]
}

function toTotals(mo: MonthVat, incomeExVat: number, expenseExVat: number): MonthTotals {
  const inVat = round2(mo.inVatW + mo.inVatBkFee + mo.inVatE)
  return { m: mo.m, outVat: mo.outVat, inVat, net: mo.net, incomeExVat, expenseExVat }
}

export async function getDashboardSummary(year: number): Promise<DashboardSummary> {
  const clients = await db.client.findMany({
    orderBy: { displayId: 'asc' },
    select: { id: true, displayId: true, name: true, role: true },
  })

  const rows = await Promise.all(
    clients.map(async (c): Promise<ClientDashboardRow> => {
      const books = await getOwnerBooks(c.id, year)
      const isAccountHolder = c.role === 'ACCOUNT_HOLDER'
      const months = computeMonths(books, isAccountHolder)

      // Turnover/cost per month, mirroring how each side is counted for VAT:
      // an account holder's own income periods plus their cut of substitute
      // work, versus a worker's own outgoing invoices.
      const totals = months.map((mo) => {
        const incomeExVat = isAccountHolder
          ? round2(
              mo.qi.reduce((s, i) => s + i.totalExVat + (i.tipsExVat ?? 0), 0) +
              mo.ql.reduce((s, i) => s + i.lineItems.reduce((t, li) => t + li.earnedAmount - li.amountExVat, 0), 0),
            )
          : round2(mo.qs.reduce((s, i) => s + i.totalExVat, 0))
        const expenseExVat = round2(mo.qe.reduce((s, e) => s + e.amountExVat, 0))
        return toTotals(mo, incomeExVat, expenseExVat)
      })

      // "Last entry" must reflect every kind of record that feeds the VAT
      // figures — a client whose activity is entirely invoice-based still has
      // a most-recent entry, and showing "—" next to a populated row is wrong.
      const entryDates = [
        ...books.incomes.map((i) => new Date(i.periodEnd)),
        ...books.expenses.map((e) => new Date(e.date)),
        ...books.linkedInvoices.map((i) => new Date(i.periodEnd)),
        ...books.sellerInvoices.map((i) => new Date(i.periodEnd)),
      ]
      const lastEntry = entryDates.length > 0
        ? new Date(Math.max(...entryDates.map((d) => d.getTime())))
        : null

      return {
        id: c.id,
        displayId: c.displayId,
        name: c.name,
        role: c.role,
        months: totals,
        lastEntryAt: lastEntry ? lastEntry.toISOString() : null,
        entryCount:
          books.incomes.length + books.expenses.length +
          books.linkedInvoices.length + books.sellerInvoices.length,
        billedPeriods: books.receivedBkInvoices.map((b) => ({
          periodStart: new Date(b.periodStart).toISOString(),
          periodEnd: new Date(b.periodEnd).toISOString(),
          totalIncVat: b.totalIncVat,
        })),
      }
    }),
  )

  return { year, clients: rows }
}
