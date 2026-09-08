'use server'

import { round2 } from '@/lib/calculations'
import { computeMonths, computeAnnualFigures, type MonthVat } from '@/lib/vat-report'
import {
  computeDepreciationSchedule, DEPRECIABLE_CATEGORIES, SMALL_ACQUISITION_THRESHOLD,
} from '@/lib/depreciation'
import { getOwnerBooks, getCapitalAssetHistory } from '@/actions/owner-books'
import { db } from '@/lib/db'

export type FilingFigures = {
  clientId: number
  clientName: string
  role: string
  year: number
  /** Per-month VAT so the page can total any filing period client-side. */
  months: { m: number; outVat: number; inVat: number; net: number; tips: number }[]
  /** Distinct VAT rates actually used in the year's sales — drives the
   *  "enter it on the row for the right rate" guidance. */
  salesVatRates: number[]
  annual: {
    turnover: number
    expenses: number
    depreciation: number
    taxDeductibleExpenses: number
    taxableProfit: number
    tips: number
  }
}

export async function getFilingFigures(clientId: number, year: number): Promise<FilingFigures> {
  const [client, books, capitalAssets] = await Promise.all([
    db.client.findUnique({ where: { id: clientId }, select: { name: true, role: true } }),
    getOwnerBooks(clientId, year),
    getCapitalAssetHistory(clientId, year),
  ])

  const isAccountHolder = client?.role !== 'SUBSTITUTE_WORKER'
  const months: MonthVat[] = computeMonths(books, isAccountHolder)
  const figures = computeAnnualFigures(books, isAccountHolder)

  // Capital purchases are depreciated rather than expensed in full, so the
  // income-tax deduction swaps their cost for this year's allowed depreciation.
  const isCapitalAsset = (e: { category: string; amountExVat: number }) =>
    DEPRECIABLE_CATEGORIES.includes(e.category) && e.amountExVat > SMALL_ACQUISITION_THRESHOLD
  const capitalAdditionsThisYear = round2(
    books.expenses.filter(isCapitalAsset).reduce((s, e) => s + e.amountExVat, 0),
  )
  const schedule = computeDepreciationSchedule(capitalAssets, year)
  const taxDeductibleExpenses = round2(
    figures.otherExpExVat - capitalAdditionsThisYear + schedule.currentYear.depreciation,
  )

  const salesVatRates = Array.from(
    new Set([
      ...books.incomes.map((i) => i.vatRate),
      ...books.linkedInvoices.flatMap((i) => i.lineItems.map((li) => li.vatRate)),
      ...books.sellerInvoices.flatMap((i) => i.lineItems.map((li) => li.vatRate)),
    ].filter((r) => r > 0)),
  ).sort((a, b) => b - a)

  return {
    clientId,
    clientName: client?.name ?? '',
    role: client?.role ?? 'ACCOUNT_HOLDER',
    year,
    months: months.map((mo) => ({
      m: mo.m,
      outVat: mo.outVat,
      inVat: round2(mo.inVatW + mo.inVatBkFee + mo.inVatE),
      net: mo.net,
      tips: round2(mo.qi.reduce((s, i) => s + (i.tipsExVat ?? 0), 0)),
    })),
    salesVatRates,
    annual: {
      turnover: figures.incomeExVat,
      expenses: figures.otherExpExVat,
      depreciation: schedule.currentYear.depreciation,
      taxDeductibleExpenses,
      taxableProfit: round2(figures.incomeExVat - taxDeductibleExpenses),
      tips: figures.totalIncomeTips,
    },
  }
}
