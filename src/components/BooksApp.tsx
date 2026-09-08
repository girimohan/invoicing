'use client'

import { useState, useEffect, useTransition, useCallback, useMemo, Fragment } from 'react'
import VehicleTab from '@/components/VehicleTab'
import {
  getOwnerBooks,
  createOwnerIncomePeriod,
  deleteOwnerIncomePeriod,
  createOwnerExpense,
  deleteOwnerExpense,
  getCapitalAssetHistory,
} from '@/actions/owner-books'
import { round2, formatCurrency as fmt } from '@/lib/calculations'
import {
  computeMonths, computePeriods, computeAnnualFigures, MONTH_NAMES,
  type IncomePeriod, type Expense, type LinkedInvoice, type BookkeeperInvoice,
  type ReceivedBkInvoice, type VatFilingFrequency, type MonthVat, type VatPeriod,
} from '@/lib/vat-report'
import {
  computeDepreciationSchedule, DEPRECIABLE_CATEGORIES, SMALL_ACQUISITION_THRESHOLD, DEPRECIATION_RATE,
} from '@/lib/depreciation'

// ─── Types ────────────────────────────────────────────────────────────────────

type Client = { id: number; displayId: string; name: string; role: string; invoiceCount?: number; buyerInvoiceCount?: number }

type Tab = 'income' | 'expenses' | 'vat' | 'tax' | 'vehicle'

const VAT_FREQ_STORAGE_KEY = 'books_vat_filing_freq'

// ─── Constants ────────────────────────────────────────────────────────────────

const EXPENSE_CATEGORIES: { value: string; label: string }[] = [
  { value: 'MATERIALS',      label: 'Aineet & tarvikkeet / Materials' },
  { value: 'TRAVEL',         label: 'Matkakulut / Travel' },
  { value: 'PHONE_INTERNET', label: 'Puhelin & internet / Phone & internet' },
  { value: 'EQUIPMENT',      label: 'Kalusto & laitteet / Equipment' },
  { value: 'VEHICLE',        label: 'Ajoneuvot / Vehicle' },
  { value: 'MARKETING',      label: 'Markkinointi / Marketing' },
  { value: 'OFFICE',         label: 'Toimistokulut / Office' },
  { value: 'BOOKKEEPING',    label: 'Kirjanpito / Bookkeeping services' },
  { value: 'SUBSTITUTE_PAYMENT', label: 'Korvaus sijaiselle / Substitute payment' },
  { value: 'TIPS',           label: 'Tippit maksettu / Tips paid out' },
  { value: 'OTHER',          label: 'Muut kulut / Other' },
]

const CAT_LABEL: Record<string, string> = Object.fromEntries(
  EXPENSE_CATEGORIES.map((c) => [c.value, c.label.split(' / ')[0]])
)

function todayIso() { return new Date().toISOString().split('T')[0] }

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString('fi-FI', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ─── VAT period/month row cells — shared by period rows and nested month rows ──

function VatRowCells({ d, isAccountHolder, showSubs, showBk, showRecBk, muted }: {
  d: { outVatOwn: number; outVatSubs: number; outVatBk: number; outVat: number; inVatW: number; inVatBkFee: number; inVatE: number; net: number }
  isAccountHolder: boolean
  showSubs: boolean
  showBk: boolean
  showRecBk: boolean
  muted?: boolean
}) {
  const cls = (c: string) => `px-3 py-3 text-right font-mono ${muted ? 'text-slate-300' : c}`
  const netCls = `px-3 py-3 text-right font-mono font-bold ${muted ? 'text-slate-300' : d.net >= 0 ? 'text-indigo-700' : 'text-green-600'}`
  if (isAccountHolder) {
    return (
      <>
        <td className={cls('text-green-700')}>{fmt(d.outVatOwn)}</td>
        {showSubs && <td className={cls('text-indigo-600')}>{fmt(d.outVatSubs)}</td>}
        {showBk && <td className={cls('text-teal-700')}>{fmt(d.outVatBk)}</td>}
        <td className={cls('font-bold text-green-800')}>{fmt(d.outVat)}</td>
        {showSubs && <td className={cls('text-orange-600')}>{fmt(d.inVatW)}</td>}
        {showRecBk && <td className={cls('text-purple-600')}>{fmt(d.inVatBkFee)}</td>}
        <td className={cls('text-red-600')}>{fmt(d.inVatE)}</td>
        <td className={netCls}>{fmt(d.net)}</td>
      </>
    )
  }
  return (
    <>
      <td className={cls('text-purple-700')}>{fmt(d.outVat)}</td>
      {showRecBk && <td className={cls('text-purple-600')}>{fmt(d.inVatBkFee)}</td>}
      <td className={cls('text-red-600')}>{fmt(d.inVatE)}</td>
      <td className={netCls}>{fmt(d.net)}</td>
    </>
  )
}

// ─── Itemized source records behind a month's VAT numbers ──────────────────────

function ItemSection({ title, colorClass, children }: { title: string; colorClass: string; children: React.ReactNode }) {
  return (
    <div>
      <div className={`text-[10px] font-bold uppercase tracking-wide mb-1 ${colorClass}`}>{title}</div>
      <table className="w-full text-[11px] bg-white border border-slate-100 rounded overflow-hidden">
        {children}
      </table>
    </div>
  )
}

function MonthItemization({ mo, isAccountHolder }: { mo: MonthVat; isAccountHolder: boolean }) {
  const hasAny = mo.qi.length > 0 || mo.ql.length > 0 || mo.qs.length > 0 || mo.qbk.length > 0 || mo.qRecBk.length > 0 || mo.qe.length > 0
  if (!hasAny) {
    return <div className="text-[11px] text-slate-400 italic">No records for {MONTH_NAMES[mo.m]}.</div>
  }
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {isAccountHolder && mo.qi.length > 0 && (
        <ItemSection title="Own Wolt income — output VAT" colorClass="text-green-700">
          <thead className="bg-green-50"><tr>
            <th className="text-left px-2 py-1 font-medium text-slate-500">Period</th>
            <th className="text-left px-2 py-1 font-medium text-slate-500">Description</th>
            <th className="text-right px-2 py-1 font-medium text-slate-500">Ex-VAT</th>
            <th className="text-right px-2 py-1 font-medium text-green-700">VAT</th>
          </tr></thead>
          <tbody>
            {mo.qi.map(i => (
              <tr key={i.id} className="border-t border-slate-100">
                <td className="px-2 py-1 text-slate-600">{fmtDate(i.periodStart)}–{fmtDate(i.periodEnd)}</td>
                <td className="px-2 py-1 text-slate-600">{i.description || '—'}</td>
                <td className="px-2 py-1 text-right font-mono">{fmt(i.totalExVat)}</td>
                <td className="px-2 py-1 text-right font-mono font-semibold text-green-700">{fmt(i.vatAmount)}</td>
              </tr>
            ))}
          </tbody>
        </ItemSection>
      )}
      {isAccountHolder && mo.ql.length > 0 && (
        <ItemSection title="Substitute worker invoices — output pass-through & input VAT paid" colorClass="text-indigo-700">
          <thead className="bg-indigo-50"><tr>
            <th className="text-left px-2 py-1 font-medium text-slate-500">Invoice</th>
            <th className="text-left px-2 py-1 font-medium text-slate-500">Worker</th>
            <th className="text-right px-2 py-1 font-medium text-indigo-600">Output VAT</th>
            <th className="text-right px-2 py-1 font-medium text-orange-600">Input VAT</th>
          </tr></thead>
          <tbody>
            {mo.ql.map(i => {
              const outputVat = round2(i.lineItems.reduce((s, li) => s + li.earnedAmount * li.vatRate / 100, 0))
              return (
                <tr key={i.id} className="border-t border-slate-100">
                  <td className="px-2 py-1 font-mono text-slate-600">{i.invoiceNumber}</td>
                  <td className="px-2 py-1 text-slate-600">{i.sellerName}</td>
                  <td className="px-2 py-1 text-right font-mono text-indigo-600">{fmt(outputVat)}</td>
                  <td className="px-2 py-1 text-right font-mono text-orange-600">{fmt(i.totalVat)}</td>
                </tr>
              )
            })}
          </tbody>
        </ItemSection>
      )}
      {isAccountHolder && mo.qbk.length > 0 && (
        <ItemSection title="Bookkeeping service invoices issued — output VAT" colorClass="text-teal-700">
          <thead className="bg-teal-50"><tr>
            <th className="text-left px-2 py-1 font-medium text-slate-500">Invoice</th>
            <th className="text-left px-2 py-1 font-medium text-slate-500">Client</th>
            <th className="text-right px-2 py-1 font-medium text-slate-500">Ex-VAT</th>
            <th className="text-right px-2 py-1 font-medium text-teal-700">VAT</th>
          </tr></thead>
          <tbody>
            {mo.qbk.map(i => (
              <tr key={i.id} className="border-t border-slate-100">
                <td className="px-2 py-1 font-mono text-slate-600">{i.invoiceNumber}</td>
                <td className="px-2 py-1 text-slate-600">{i.clientName}</td>
                <td className="px-2 py-1 text-right font-mono">{fmt(i.amountExVat)}</td>
                <td className="px-2 py-1 text-right font-mono font-semibold text-teal-700">{fmt(i.vatAmount)}</td>
              </tr>
            ))}
          </tbody>
        </ItemSection>
      )}
      {!isAccountHolder && mo.qs.length > 0 && (
        <ItemSection title="Your invoices — output VAT" colorClass="text-purple-700">
          <thead className="bg-purple-50"><tr>
            <th className="text-left px-2 py-1 font-medium text-slate-500">Invoice</th>
            <th className="text-left px-2 py-1 font-medium text-slate-500">Buyer</th>
            <th className="text-right px-2 py-1 font-medium text-slate-500">Ex-VAT</th>
            <th className="text-right px-2 py-1 font-medium text-purple-700">VAT</th>
          </tr></thead>
          <tbody>
            {mo.qs.map(i => (
              <tr key={i.id} className="border-t border-slate-100">
                <td className="px-2 py-1 font-mono text-slate-600">{i.invoiceNumber}</td>
                <td className="px-2 py-1 text-slate-600">{i.buyerName}</td>
                <td className="px-2 py-1 text-right font-mono">{fmt(i.totalExVat)}</td>
                <td className="px-2 py-1 text-right font-mono font-semibold text-purple-700">{fmt(i.totalVat)}</td>
              </tr>
            ))}
          </tbody>
        </ItemSection>
      )}
      {mo.qRecBk.length > 0 && (
        <ItemSection title="Bookkeeper fee paid — input VAT (deductible)" colorClass="text-purple-700">
          <thead className="bg-purple-50"><tr>
            <th className="text-left px-2 py-1 font-medium text-slate-500">Invoice</th>
            <th className="text-left px-2 py-1 font-medium text-slate-500">Date</th>
            <th className="text-right px-2 py-1 font-medium text-slate-500">Ex-VAT</th>
            <th className="text-right px-2 py-1 font-medium text-purple-700">VAT</th>
          </tr></thead>
          <tbody>
            {mo.qRecBk.map(i => (
              <tr key={i.id} className="border-t border-slate-100">
                <td className="px-2 py-1 font-mono text-slate-600">{i.invoiceNumber}</td>
                <td className="px-2 py-1 text-slate-600">{fmtDate(i.issueDate)}</td>
                <td className="px-2 py-1 text-right font-mono">{fmt(i.amountExVat)}</td>
                <td className="px-2 py-1 text-right font-mono font-semibold text-purple-700">{fmt(i.vatAmount)}</td>
              </tr>
            ))}
          </tbody>
        </ItemSection>
      )}
      {mo.qe.length > 0 && (
        <ItemSection title="Other expenses — input VAT (deductible)" colorClass="text-red-700">
          <thead className="bg-red-50"><tr>
            <th className="text-left px-2 py-1 font-medium text-slate-500">Description</th>
            <th className="text-left px-2 py-1 font-medium text-slate-500">Category</th>
            <th className="text-right px-2 py-1 font-medium text-slate-500">Ex-VAT</th>
            <th className="text-right px-2 py-1 font-medium text-red-700">VAT</th>
          </tr></thead>
          <tbody>
            {mo.qe.map(e => (
              <tr key={e.id} className="border-t border-slate-100">
                <td className="px-2 py-1 text-slate-600">{e.description}</td>
                <td className="px-2 py-1 text-slate-500">{CAT_LABEL[e.category] ?? e.category}</td>
                <td className="px-2 py-1 text-right font-mono">{fmt(e.amountExVat)}</td>
                <td className="px-2 py-1 text-right font-mono font-semibold text-red-700">{fmt(e.vatAmount)}</td>
              </tr>
            ))}
          </tbody>
        </ItemSection>
      )}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BooksApp({ initialClients, initialClientId = null, initialYear }: {
  initialClients: Client[]
  initialClientId?: number | null
  initialYear?: number
}) {
  const [selectedClientId, setSelectedClientId] = useState<number | null>(initialClientId)
  const [selectedYear, setSelectedYear] = useState(initialYear ?? new Date().getFullYear())
  const [activeTab, setActiveTab] = useState<Tab>('income')
  const [loading, setLoading] = useState(false)
  const [incomes, setIncomes] = useState<IncomePeriod[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [linkedInvoices, setLinkedInvoices] = useState<LinkedInvoice[]>([])
  const [sellerInvoices, setSellerInvoices] = useState<LinkedInvoice[]>([])
  const [bookkeeperInvoices, setBookkeeperInvoices] = useState<BookkeeperInvoice[]>([])
  const [receivedBkInvoices, setReceivedBkInvoices] = useState<ReceivedBkInvoice[]>([])
  const [capitalAssets, setCapitalAssets] = useState<{ id: string; date: Date; description: string; category: string; amountExVat: number }[]>([])
  const [showAddIncome, setShowAddIncome] = useState(false)
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [expandWorkerInvoices, setExpandWorkerInvoices] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [filingFrequency, setFilingFrequency] = useState<VatFilingFrequency>('quarterly')
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null)
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null)

  // Load/persist VAT filing frequency preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VAT_FREQ_STORAGE_KEY)
      if (saved === 'quarterly' || saved === 'semiannual' || saved === 'annual') setFilingFrequency(saved)
    } catch { /* ignore */ }
  }, [])

  function changeFilingFrequency(freq: VatFilingFrequency) {
    setFilingFrequency(freq)
    setExpandedPeriod(null)
    setExpandedMonth(null)
    try { localStorage.setItem(VAT_FREQ_STORAGE_KEY, freq) } catch { /* ignore */ }
  }

  const [incomeForm, setIncomeForm] = useState({
    periodStart: '', periodEnd: '', woltInvoiceRef: '', description: '',
    totalExVat: '', tipsExVat: '', vatRate: '25.5', notes: '',
  })

  const [expenseForm, setExpenseForm] = useState({
    date: todayIso(), description: '', supplier: '', category: 'OTHER',
    amountExVat: '', vatRate: '25.5', receiptRef: '', notes: '',
  })

  // Capital-asset history needs all years up to selectedYear (the depreciation
  // pool carries a balance forward), so it's refetched independently of the
  // year-scoped getOwnerBooks load below, and re-run after expense add/delete.
  const refreshCapitalAssets = useCallback((clientId: number, year: number) => {
    getCapitalAssetHistory(clientId, year).then(setCapitalAssets).catch(() => {})
  }, [])

  useEffect(() => {
    if (selectedClientId === null) return
    setLoading(true)
    setIncomes([]); setExpenses([]); setLinkedInvoices([]); setSellerInvoices([]); setBookkeeperInvoices([]); setReceivedBkInvoices([]); setCapitalAssets([])
    getOwnerBooks(selectedClientId, selectedYear)
      .then(({ incomes, expenses, linkedInvoices, sellerInvoices, bookkeeperInvoices, receivedBkInvoices }) => {
        setIncomes(incomes as IncomePeriod[])
        setExpenses(expenses as Expense[])
        setLinkedInvoices(linkedInvoices as unknown as LinkedInvoice[])
        setSellerInvoices(sellerInvoices as unknown as LinkedInvoice[])
        setBookkeeperInvoices((bookkeeperInvoices ?? []) as unknown as BookkeeperInvoice[])
        setReceivedBkInvoices((receivedBkInvoices ?? []) as unknown as typeof receivedBkInvoices)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
    refreshCapitalAssets(selectedClientId, selectedYear)
  }, [selectedClientId, selectedYear, refreshCapitalAssets])

  const selectedClient = initialClients.find((c) => c.id === selectedClientId)
  const isAccountHolder = selectedClient?.role !== 'SUBSTITUTE_WORKER'

  // ── Income tax reference figures ──────────────────────────────────────────
  // Computed by the shared helper in lib/vat-report so the Filing Guide quotes
  // exactly the same numbers as this screen.
  const {
    woltGrossFromSubstitutes, ownerCutExVat, ownerCutVat, woltOutputVatFromSubs,
    workerCostExVat, workerCostVat, bkIncomeExVat, bkIncomeVat,
    totalIncomeExVat, totalIncomeTips, totalIncomeVat, totalIncomeGross,
    sellerIncomeExVat, sellerIncomeVat, otherExpExVat, otherExpVat,
    clientBkFeeInputVat, incomeExVat, netProfit,
  } = useMemo(
    () => computeAnnualFigures(
      { incomes, linkedInvoices, sellerInvoices, expenses, bookkeeperInvoices, receivedBkInvoices },
      isAccountHolder,
    ),
    [incomes, linkedInvoices, sellerInvoices, expenses, bookkeeperInvoices, receivedBkInvoices, isAccountHolder],
  )

  // VAT filing:
  // Account holder output = VAT on own Wolt income + VAT on FULL Wolt gross for sub periods + bookkeeping VAT (if this client IS the bookkeeper)
  //           input  = worker invoice VAT + bookkeeper fee paid VAT (deductible) + other expense VAT
  const filingOutputVat = isAccountHolder
    ? round2(totalIncomeVat + woltOutputVatFromSubs + bkIncomeVat)
    : sellerIncomeVat
  const filingInputVat = isAccountHolder
    ? round2(workerCostVat + clientBkFeeInputVat + otherExpVat)
    : round2(clientBkFeeInputVat + otherExpVat)
  const netVatPayable = round2(filingOutputVat - filingInputVat)

  // ── Monthly VAT breakdown, source-attributed and kept alongside the raw
  // contributing records so period/month rows can be expanded for a full trace. ──
  const months = useMemo<MonthVat[]>(
    () => computeMonths({ incomes, linkedInvoices, sellerInvoices, expenses, bookkeeperInvoices, receivedBkInvoices }, isAccountHolder),
    [incomes, linkedInvoices, sellerInvoices, expenses, bookkeeperInvoices, receivedBkInvoices, isAccountHolder]
  )

  // ── Group months into filing periods (quarterly/semiannual/annual) ──────────
  const periods = useMemo<VatPeriod[]>(
    () => computePeriods(months, filingFrequency, selectedYear),
    [months, filingFrequency, selectedYear]
  )

  // Capital purchases (EQUIPMENT/VEHICLE over the small-acquisition threshold)
  // aren't expensed in full — they're depreciated, so the Tax Return tab's
  // category breakdown excludes them and shows the depreciation amount instead.
  const isCapitalAsset = (e: Expense) =>
    DEPRECIABLE_CATEGORIES.includes(e.category) && e.amountExVat > SMALL_ACQUISITION_THRESHOLD

  const expByCategory = useMemo(() => EXPENSE_CATEGORIES.map((cat) => {
    const rows = expenses.filter((e) => e.category === cat.value && !isCapitalAsset(e))
    return { ...cat, rows, total: round2(rows.reduce((s, e) => s + e.amountExVat, 0)) }
  }).filter((c) => c.rows.length > 0), [expenses])

  const capitalAssetAdditionsThisYear = round2(expenses.filter(isCapitalAsset).reduce((s, e) => s + e.amountExVat, 0))

  const depreciationSchedule = useMemo(
    () => computeDepreciationSchedule(capitalAssets, selectedYear),
    [capitalAssets, selectedYear]
  )

  // Tax Return tab only — replaces the raw cost of capital purchases with this
  // year's allowed depreciation. otherExpExVat/netProfit (dashboard cards,
  // Expenses tab) stay cash-basis and are untouched.
  const taxDeductibleExpenses = round2(otherExpExVat - capitalAssetAdditionsThisYear + depreciationSchedule.currentYear.depreciation)
  const taxableProfit = round2(incomeExVat - taxDeductibleExpenses)

  const handleSaveIncome = useCallback(() => {
    if (!selectedClientId || !incomeForm.periodStart || !incomeForm.periodEnd || !incomeForm.totalExVat) return
    startTransition(async () => {
      const rec = await createOwnerIncomePeriod({
        clientId: selectedClientId,
        periodStart: incomeForm.periodStart,
        periodEnd: incomeForm.periodEnd,
        woltInvoiceRef: incomeForm.woltInvoiceRef,
        description: incomeForm.description,
        totalExVat: parseFloat(incomeForm.totalExVat),
        tipsExVat: incomeForm.tipsExVat ? parseFloat(incomeForm.tipsExVat) : 0,
        vatRate: parseFloat(incomeForm.vatRate),
        notes: incomeForm.notes,
      })
      setIncomes((prev) => [...prev, rec as IncomePeriod].sort(
        (a, b) => new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime()
      ))
      setIncomeForm({ periodStart: '', periodEnd: '', woltInvoiceRef: '', description: '', totalExVat: '', tipsExVat: '', vatRate: '25.5', notes: '' })
      setShowAddIncome(false)
    })
  }, [selectedClientId, incomeForm])

  const handleDeleteIncome = useCallback((id: string) => {
    if (!confirm('Delete this income period?')) return
    setError(null)
    startTransition(async () => {
      try {
        await deleteOwnerIncomePeriod(id)
        setIncomes((prev) => prev.filter((i) => i.id !== id))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete income period.')
      }
    })
  }, [])

  const handleSaveExpense = useCallback(() => {
    if (!selectedClientId || !expenseForm.description || !expenseForm.amountExVat) return
    startTransition(async () => {
      const rec = await createOwnerExpense({
        clientId: selectedClientId,
        date: expenseForm.date,
        description: expenseForm.description,
        supplier: expenseForm.supplier,
        category: expenseForm.category,
        amountExVat: parseFloat(expenseForm.amountExVat),
        vatRate: parseFloat(expenseForm.vatRate),
        receiptRef: expenseForm.receiptRef,
        notes: expenseForm.notes,
      })
      setExpenses((prev) => [...prev, rec as Expense].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      ))
      setExpenseForm({ date: todayIso(), description: '', supplier: '', category: 'OTHER', amountExVat: '', vatRate: '25.5', receiptRef: '', notes: '' })
      setShowAddExpense(false)
      refreshCapitalAssets(selectedClientId, selectedYear)
    })
  }, [selectedClientId, selectedYear, expenseForm, refreshCapitalAssets])

  const handleDeleteExpense = useCallback((id: string) => {
    if (!confirm('Delete this expense?')) return
    setError(null)
    startTransition(async () => {
      try {
        await deleteOwnerExpense(id)
        setExpenses((prev) => prev.filter((e) => e.id !== id))
        if (selectedClientId) refreshCapitalAssets(selectedClientId, selectedYear)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete expense.')
      }
    })
  }, [selectedClientId, selectedYear, refreshCapitalAssets])

  const years = Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - i)

  return (
    <div className="min-h-screen bg-canvas">

      {/* ── Top bar ── */}
      <div className="bg-white/95 backdrop-blur border-b border-slate-200 px-8 py-3.5 flex items-center gap-4 sticky top-0 z-20">
        <div>
          <h1 className="page-title">Books</h1>
          <p className="page-subtitle">VAT filing · income tax reference · expense tracking</p>
        </div>
        {selectedClientId !== null && (
          <a href="/" className="btn-ghost btn-sm ml-2">← All clients</a>
        )}
        <div className="segmented ml-auto">
          {years.map((yr) => (
            <button key={yr} onClick={() => setSelectedYear(yr)}
              className={`segmented-item ${yr === selectedYear ? 'segmented-item-active' : ''}`}>{yr}</button>
          ))}
        </div>
      </div>

      {error && (
        <div className="max-w-5xl mx-auto mt-4 px-6">
          <div className="notice-error">{error}</div>
        </div>
      )}

      {/* With no client chosen there is nothing to show — the client list
          lives on the home page, so send the user back rather than keeping a
          second copy of it here. */}
      {selectedClientId === null && (
        <div className="page">
          <div className="card empty-state">
            <div className="empty-state-title">No client selected</div>
            <div className="text-[12px]">
              <a href="/" className="text-indigo-600 font-medium hover:underline">Choose a client →</a>
            </div>
          </div>
        </div>
      )}

      {/* ── Client selected ── */}
      {selectedClientId !== null && (
        <div className="max-w-5xl mx-auto px-6 py-5">

          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <button onClick={() => setSelectedClientId(null)}
              className="text-xs text-slate-400 hover:text-indigo-600 font-medium transition-colors">
              ← All clients
            </button>
            <span className="text-slate-200">/</span>
            <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-0.5 rounded">{selectedClient?.displayId}</span>
            <h2 className="text-base font-bold text-slate-800">{selectedClient?.name}</h2>
            {isAccountHolder
              ? <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-indigo-100 text-indigo-700">Account Holder</span>
              : <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-purple-100 text-purple-700">Substitute Worker</span>}
          </div>

          {/* ── Summary cards ── */}
          {isAccountHolder ? (
            <div className="grid grid-cols-4 gap-3 mb-5">
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="text-[10px] text-slate-400 mb-1 font-medium uppercase tracking-wide">
                  {linkedInvoices.length > 0 ? 'Net Revenue (ex-VAT)' : 'Wolt Income (ex-VAT)'}
                </div>
                <div className="text-xl font-bold text-green-700 font-mono">{fmt(incomeExVat)} €</div>
                {(linkedInvoices.length > 0 || bookkeeperInvoices.length > 0 || totalIncomeTips > 0) && (
                  <div className="text-[10px] text-slate-400 mt-1">
                    Fees {fmt(totalIncomeExVat)}
                    {totalIncomeTips > 0 && <> + Tips {fmt(totalIncomeTips)}</>}
                    {ownerCutExVat > 0 && <> + Sub cut {fmt(ownerCutExVat)}</>}
                    {bkIncomeExVat > 0 && <> + BK {fmt(bkIncomeExVat)}</>}
                  </div>
                )}
              </div>
              {linkedInvoices.length > 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="text-[10px] text-slate-400 mb-1 font-medium uppercase tracking-wide">Worker Payments (ex-VAT)</div>
                  <div className="text-xl font-bold text-orange-600 font-mono">{fmt(workerCostExVat)} €</div>
                  <div className="text-[10px] text-slate-400 mt-1">{linkedInvoices.length} invoice{linkedInvoices.length !== 1 ? 's' : ''} · netted from revenue</div>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl p-4 opacity-30 pointer-events-none">
                  <div className="text-[10px] text-slate-400 mb-1 font-medium uppercase tracking-wide">Worker Payments</div>
                  <div className="text-xl font-bold text-slate-300 font-mono">—</div>
                  <div className="text-[10px] text-slate-300 mt-1">No substitutes this year</div>
                </div>
              )}
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="text-[10px] text-slate-400 mb-1 font-medium uppercase tracking-wide">Other Expenses (ex-VAT)</div>
                <div className="text-xl font-bold text-red-600 font-mono">{fmt(otherExpExVat)} €</div>
                {expenses.length > 0 && <div className="text-[10px] text-slate-400 mt-1">{expenses.length} entries</div>}
              </div>
              <div className={`rounded-xl p-4 border ${netProfit >= 0 ? 'bg-indigo-50 border-indigo-200' : 'bg-red-50 border-red-200'}`}>
                <div className="text-[10px] text-slate-400 mb-1 font-medium uppercase tracking-wide">Net Profit (before tax)</div>
                <div className={`text-xl font-bold font-mono ${netProfit >= 0 ? 'text-indigo-700' : 'text-red-600'}`}>{fmt(netProfit)} €</div>
                <div className="text-[10px] text-slate-400 mt-1">Revenue − expenses</div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="text-[10px] text-slate-400 mb-1 font-medium uppercase tracking-wide">Invoice Income (ex-VAT)</div>
                <div className="text-xl font-bold text-purple-700 font-mono">{fmt(sellerIncomeExVat)} €</div>
                {sellerInvoices.length > 0 && <div className="text-[10px] text-slate-400 mt-1">{sellerInvoices.length} invoice{sellerInvoices.length !== 1 ? 's' : ''}</div>}
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="text-[10px] text-slate-400 mb-1 font-medium uppercase tracking-wide">Other Expenses (ex-VAT)</div>
                <div className="text-xl font-bold text-red-600 font-mono">{fmt(otherExpExVat)} €</div>
              </div>
              <div className={`rounded-xl p-4 border ${netProfit >= 0 ? 'bg-indigo-50 border-indigo-200' : 'bg-red-50 border-red-200'}`}>
                <div className="text-[10px] text-slate-400 mb-1 font-medium uppercase tracking-wide">Net Profit (before tax)</div>
                <div className={`text-xl font-bold font-mono ${netProfit >= 0 ? 'text-indigo-700' : 'text-red-600'}`}>{fmt(netProfit)} €</div>
              </div>
            </div>
          )}

          {/* ── Tab bar ── */}
          <div className="flex gap-1 mb-5 border-b border-slate-200">
            {([
              { key: 'income',   label: isAccountHolder ? 'Income' : 'Invoices Sent' },
              { key: 'expenses', label: 'Expenses' },
              { key: 'vat',      label: 'VAT Summary' },
              { key: 'tax',      label: 'Tax Return' },
              { key: 'vehicle',  label: 'Vehicle & Mileage' },
            ] as { key: Tab; label: string }[]).map((t) => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={`px-4 py-2.5 text-[12.5px] font-semibold border-b-2 transition-colors duration-150 -mb-px ${
                  activeTab === t.key ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}>{t.label}</button>
            ))}
          </div>

          {loading && <div className="text-[12px] text-slate-400 py-10 text-center">Loading…</div>}

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* INCOME TAB — ACCOUNT HOLDER                                    */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {!loading && activeTab === 'income' && isAccountHolder && (
            <div className="space-y-6">

              {/* Substitute delivery periods (auto) */}
              {linkedInvoices.length > 0 && (
                <div className="border border-indigo-200 rounded-xl overflow-hidden">
                  <div className="bg-indigo-50 px-5 py-3 flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-indigo-800">Substitute Delivery Periods</h3>
                        <span className="text-[10px] bg-indigo-100 text-indigo-600 font-semibold px-1.5 py-0.5 rounded border border-indigo-200">auto-linked</span>
                      </div>
                      <p className="text-[10px] text-indigo-600 mt-0.5">
                        Wolt pays you the full gross. Your cut = Wolt Gross minus Worker&apos;s Share.
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-indigo-500">Your total cut</div>
                      <div className="text-lg font-bold text-indigo-700 font-mono">{fmt(ownerCutExVat)} €</div>
                    </div>
                  </div>
                  <table className="w-full text-xs">
                    <thead className="bg-white border-b border-indigo-100">
                      <tr>
                        <th className="text-left px-4 py-2.5 font-semibold text-slate-500">Invoice #</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-slate-500">Worker</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-slate-500">Date</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-slate-600">Wolt Gross</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-slate-500">Share %</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-orange-600">Worker Paid</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-indigo-700">Your Cut</th>
                        <th className="w-10 px-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {linkedInvoices.map((inv, idx) => {
                        const gross   = round2(inv.lineItems.reduce((s, li) => s + li.earnedAmount, 0))
                        const paid    = inv.totalExVat
                        const cut     = round2(gross - paid)
                        const shItems = inv.lineItems.filter(li => li.sharePercent < 100)
                        const shGross = round2(shItems.reduce((s, li) => s + li.earnedAmount, 0))
                        const avgSh   = shGross > 0
                          ? Math.round(shItems.reduce((s, li) => s + li.sharePercent * li.earnedAmount, 0) / shGross)
                          : Math.round(inv.lineItems[0]?.sharePercent ?? 0)
                        return (
                          <tr key={inv.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className="px-4 py-2.5 font-mono text-slate-500 text-[11px]">{inv.invoiceNumber}</td>
                            <td className="px-4 py-2.5 font-medium text-slate-800">{inv.sellerName}</td>
                            <td className="px-4 py-2.5 text-slate-400">{fmtDate(inv.invoiceDate)}</td>
                            <td className="px-4 py-2.5 text-right font-mono text-slate-700">{fmt(gross)}</td>
                            <td className="px-4 py-2.5 text-right">
                              <span className="bg-orange-100 text-orange-700 font-semibold px-1.5 py-0.5 rounded text-[10px]">{avgSh}%</span>
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono text-orange-600">−{fmt(paid)}</td>
                            <td className="px-4 py-2.5 text-right font-mono font-bold text-indigo-700">{fmt(cut)}</td>
                            <td className="px-2 py-2.5 text-center">
                              <a href={`/api/invoice/${inv.id}/pdf`} target="_blank" className="text-indigo-500 hover:text-indigo-700 text-[10px]">PDF</a>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot className="bg-indigo-50 border-t-2 border-indigo-200">
                      <tr>
                        <td colSpan={3} className="px-4 py-2.5 text-xs font-bold text-indigo-700">
                          Total · {linkedInvoices.length} invoice{linkedInvoices.length !== 1 ? 's' : ''}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold font-mono text-slate-700">{fmt(woltGrossFromSubstitutes)}</td>
                        <td></td>
                        <td className="px-4 py-2.5 text-right font-bold font-mono text-orange-600">−{fmt(workerCostExVat)}</td>
                        <td className="px-4 py-2.5 text-right font-bold font-mono text-indigo-700">{fmt(ownerCutExVat)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* Own delivery income (manual) */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-700">
                      {linkedInvoices.length > 0 ? 'Own Delivery Income' : 'Wolt Income Periods'}
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      {linkedInvoices.length > 0
                        ? 'Periods where you personally made deliveries (no substitute). Add one per Wolt self-billing statement.'
                        : 'Record each Wolt self-billing statement. VAT = output VAT to remit.'}
                    </p>
                  </div>
                  <button onClick={() => setShowAddIncome((v) => !v)}
                    className="bg-green-700 text-white text-xs px-3 py-1.5 rounded font-semibold hover:bg-green-800">
                    {showAddIncome ? 'Cancel' : '+ Add Period'}
                  </button>
                </div>

                {showAddIncome && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-1">Period Start *</label>
                        <input type="date" value={incomeForm.periodStart}
                          onChange={(e) => setIncomeForm((p) => ({ ...p, periodStart: e.target.value }))}
                          className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-1">Period End *</label>
                        <input type="date" value={incomeForm.periodEnd}
                          onChange={(e) => setIncomeForm((p) => ({ ...p, periodEnd: e.target.value }))}
                          className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-1">Wolt Invoice Reference</label>
                        <input type="text" placeholder="FIN/26/XXXXXXX/1/1" value={incomeForm.woltInvoiceRef}
                          onChange={(e) => setIncomeForm((p) => ({ ...p, woltInvoiceRef: e.target.value }))}
                          className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-1">Total ex-VAT (€) *</label>
                        <input type="number" step="0.01" min="0" placeholder="0.00" value={incomeForm.totalExVat}
                          onChange={(e) => setIncomeForm((p) => ({ ...p, totalExVat: e.target.value }))}
                          className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs" />
                        <span className="text-[9px] text-slate-400">Courier fees — taxable at {incomeForm.vatRate}%</span>
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-1">Tips (€) <span className="text-slate-400 font-normal">0% VAT</span></label>
                        <input type="number" step="0.01" min="0" placeholder="0.00" value={incomeForm.tipsExVat}
                          onChange={(e) => setIncomeForm((p) => ({ ...p, tipsExVat: e.target.value }))}
                          className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs" />
                        <span className="text-[9px] text-slate-400">Tips are VAT-exempt — no VAT charged</span>
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-1">VAT Rate % <span className="text-slate-400 font-normal">(courier fees)</span></label>
                        <select value={incomeForm.vatRate}
                          onChange={(e) => setIncomeForm((p) => ({ ...p, vatRate: e.target.value }))}
                          className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs bg-white">
                          <option value="25.5">25.5%</option>
                          <option value="14">14%</option>
                          <option value="10">10%</option>
                          <option value="0">0%</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div className="col-span-3">
                        <label className="block text-[10px] font-semibold text-slate-600 mb-1">Description</label>
                        <input type="text" placeholder="e.g. April 1–15 courier fees" value={incomeForm.description}
                          onChange={(e) => setIncomeForm((p) => ({ ...p, description: e.target.value }))}
                          className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs" />
                      </div>
                    </div>
                    {(incomeForm.totalExVat || incomeForm.tipsExVat) && (() => {
                      const fees = parseFloat(incomeForm.totalExVat) || 0
                      const tips = parseFloat(incomeForm.tipsExVat) || 0
                      const vat = parseFloat(incomeForm.vatRate) || 0
                      const vatAmt = Math.round(fees * vat / 100 * 100) / 100
                      const total = fees + vatAmt + tips
                      return (
                        <div className="text-xs text-green-700 bg-green-100 rounded px-3 py-1.5 mb-3 font-mono flex gap-4 flex-wrap">
                          <span>Fees: {fmt(fees)} + VAT {fmt(vatAmt)} = {fmt(fees + vatAmt)} €</span>
                          {tips > 0 && <span>+ Tips (0% VAT): {fmt(tips)} €</span>}
                          <span className="font-bold">Total payout: {fmt(total)} €</span>
                        </div>
                      )
                    })()}
                    <div className="flex justify-end">
                      <button onClick={handleSaveIncome} disabled={isPending}
                        className="bg-green-700 text-white text-xs px-4 py-1.5 rounded font-semibold hover:bg-green-800 disabled:opacity-50">
                        {isPending ? 'Saving…' : 'Save Period'}
                      </button>
                    </div>
                  </div>
                )}

                {incomes.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-sm bg-white border border-slate-200 rounded-lg">
                    {linkedInvoices.length > 0
                      ? <>No own delivery periods recorded for {selectedYear}.</>
                      : <>No income periods recorded for {selectedYear} yet.</>}
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Period</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Wolt Reference</th>
                          <th className="text-right px-4 py-2.5 font-semibold text-slate-600">Fees ex-VAT €</th>
                          <th className="text-right px-4 py-2.5 font-semibold text-slate-600">Tips (0%) €</th>
                          <th className="text-right px-4 py-2.5 font-semibold text-slate-600">VAT %</th>
                          <th className="text-right px-4 py-2.5 font-semibold text-slate-600">VAT €</th>
                          <th className="text-right px-4 py-2.5 font-semibold text-slate-600">Total €</th>
                          <th className="w-8 px-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {incomes.map((inc, idx) => (
                          <tr key={inc.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className="px-4 py-2.5 text-slate-800">
                              {fmtDate(inc.periodStart)} – {fmtDate(inc.periodEnd)}
                              {inc.description && <div className="text-[10px] text-slate-400">{inc.description}</div>}
                            </td>
                            <td className="px-4 py-2.5 text-slate-500 font-mono text-[11px]">{inc.woltInvoiceRef || '—'}</td>
                            <td className="px-4 py-2.5 text-right font-mono">{fmt(inc.totalExVat)}</td>
                            <td className="px-4 py-2.5 text-right font-mono text-teal-600">
                              {(inc.tipsExVat ?? 0) > 0 ? fmt(inc.tipsExVat) : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-4 py-2.5 text-right text-slate-500">{inc.vatRate}%</td>
                            <td className="px-4 py-2.5 text-right font-mono text-orange-600">{fmt(inc.vatAmount)}</td>
                            <td className="px-4 py-2.5 text-right font-mono font-semibold">{fmt(inc.totalIncVat)}</td>
                            <td className="px-2 py-2.5 text-center">
                              <button onClick={() => handleDeleteIncome(inc.id)} disabled={isPending}
                                className="text-red-400 hover:text-red-600 font-bold text-base leading-none">×</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-green-50 border-t-2 border-green-200">
                        <tr>
                          <td colSpan={2} className="px-4 py-2.5 text-xs font-bold text-green-700">Total</td>
                          <td className="px-4 py-2.5 text-right font-bold font-mono text-green-700">{fmt(totalIncomeExVat)}</td>
                          <td className="px-4 py-2.5 text-right font-bold font-mono text-teal-600">{totalIncomeTips > 0 ? fmt(totalIncomeTips) : '—'}</td>
                          <td></td>
                          <td className="px-4 py-2.5 text-right font-bold font-mono text-orange-600">{fmt(totalIncomeVat)}</td>
                          <td className="px-4 py-2.5 text-right font-bold font-mono text-green-700">{fmt(totalIncomeGross)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {/* Combined income bar when both sources exist */}
              {linkedInvoices.length > 0 && incomes.length > 0 && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-5 py-3 text-xs flex flex-wrap items-center gap-3">
                  <span className="font-semibold text-indigo-800">Combined revenue:</span>
                  <span>Own <strong className="font-mono text-green-700">{fmt(totalIncomeExVat)} €</strong></span>
                  <span className="text-slate-400">+</span>
                  <span>Cut from substitutes <strong className="font-mono text-indigo-700">{fmt(ownerCutExVat)} €</strong></span>
                  <span className="text-slate-400">=</span>
                  <strong className="font-mono text-indigo-800 text-sm">{fmt(incomeExVat)} €</strong>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* INCOME TAB — SUBSTITUTE WORKER                                  */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {!loading && activeTab === 'income' && !isAccountHolder && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-bold text-slate-700">Invoices Sent</h3>
                <span className="text-[10px] bg-purple-100 text-purple-700 font-semibold px-2 py-0.5 rounded border border-purple-200">auto-linked</span>
                {sellerInvoices.length > 0 && (
                  <span className="text-[10px] text-slate-400">
                    {sellerInvoices.length} invoice{sellerInvoices.length !== 1 ? 's' : ''} · ex-VAT: {fmt(sellerIncomeExVat)} € · VAT: {fmt(sellerIncomeVat)} €
                  </span>
                )}
              </div>

              {sellerInvoices.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm bg-white border border-slate-200 rounded-lg">
                  <div className="font-medium mb-1">No invoices for {selectedYear}</div>
                  <div className="text-xs">Create an invoice from the <a href="/tools/invoice-generator" className="text-indigo-600 hover:underline">invoice generator</a> page and select this worker as seller.</div>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Invoice #</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Account Holder</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Date</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-slate-500">Wolt Gross</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-slate-600">Your Share</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-purple-700">Your Income (ex-VAT)</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-orange-600">VAT €</th>
                        <th className="w-10 px-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sellerInvoices.map((inv, idx) => {
                        const gross  = round2(inv.lineItems.reduce((s, li) => s + li.earnedAmount, 0))
                        const shItems = inv.lineItems.filter(li => li.sharePercent < 100)
                        const shGross = round2(shItems.reduce((s, li) => s + li.earnedAmount, 0))
                        const avgSh  = shGross > 0
                          ? Math.round(shItems.reduce((s, li) => s + li.sharePercent * li.earnedAmount, 0) / shGross)
                          : Math.round(inv.lineItems[0]?.sharePercent ?? 0)
                        return (
                          <tr key={inv.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className="px-4 py-2.5 font-mono text-slate-500 text-[11px]">{inv.invoiceNumber}</td>
                            <td className="px-4 py-2.5 font-medium text-slate-800">{inv.buyerName}</td>
                            <td className="px-4 py-2.5 text-slate-400">{fmtDate(inv.invoiceDate)}</td>
                            <td className="px-4 py-2.5 text-right font-mono text-slate-400">{fmt(gross)}</td>
                            <td className="px-4 py-2.5 text-right">
                              <span className="bg-purple-100 text-purple-700 font-semibold px-1.5 py-0.5 rounded text-[10px]">{avgSh}%</span>
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono font-bold text-purple-700">{fmt(inv.totalExVat)}</td>
                            <td className="px-4 py-2.5 text-right font-mono text-orange-600">{fmt(inv.totalVat)}</td>
                            <td className="px-2 py-2.5 text-center">
                              <a href={`/api/invoice/${inv.id}/pdf`} target="_blank" className="text-indigo-500 hover:text-indigo-700 text-[10px]">PDF</a>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot className="bg-purple-50 border-t-2 border-purple-200">
                      <tr>
                        <td colSpan={5} className="px-4 py-2.5 text-xs font-bold text-purple-700">Total earned</td>
                        <td className="px-4 py-2.5 text-right font-bold font-mono text-purple-700">{fmt(sellerIncomeExVat)}</td>
                        <td className="px-4 py-2.5 text-right font-bold font-mono text-orange-600">{fmt(sellerIncomeVat)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* EXPENSES TAB                                                     */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {!loading && activeTab === 'expenses' && (
            <div className="space-y-5">

              {/* Worker payments section — account holders only */}
              {isAccountHolder && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <button onClick={() => setExpandWorkerInvoices((v) => !v)}
                    className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors">
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <div className="text-xs font-bold text-slate-700">Worker Payments</div>
                        <span className="text-[10px] bg-orange-100 text-orange-600 font-semibold px-1.5 py-0.5 rounded">auto-linked</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {linkedInvoices.length > 0
                          ? `${linkedInvoices.length} invoice${linkedInvoices.length !== 1 ? 's' : ''} · Ex-VAT: ${fmt(workerCostExVat)} € · Input VAT: ${fmt(workerCostVat)} €`
                          : `No substitute worker invoices for ${selectedYear}`}
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 ml-4">{expandWorkerInvoices ? '▲' : '▼'}</span>
                  </button>

                  {expandWorkerInvoices && linkedInvoices.length > 0 && (
                    <div className="border-t border-slate-100">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="text-left px-4 py-2 font-semibold text-slate-600">Invoice #</th>
                            <th className="text-left px-4 py-2 font-semibold text-slate-600">Worker</th>
                            <th className="text-left px-4 py-2 font-semibold text-slate-600">Date</th>
                            <th className="text-right px-4 py-2 font-semibold text-slate-600">Wolt Gross</th>
                            <th className="text-right px-4 py-2 font-semibold text-slate-600">Share %</th>
                            <th className="text-right px-4 py-2 font-semibold text-orange-600">Ex-VAT €</th>
                            <th className="text-right px-4 py-2 font-semibold text-orange-600">VAT €</th>
                            <th className="text-right px-4 py-2 font-semibold text-orange-600">Total €</th>
                          </tr>
                        </thead>
                        <tbody>
                          {linkedInvoices.map((inv, idx) => {
                            const gross = round2(inv.lineItems.reduce((s, li) => s + li.earnedAmount, 0))
                            const shItems = inv.lineItems.filter(li => li.sharePercent < 100)
                            const shGross = round2(shItems.reduce((s, li) => s + li.earnedAmount, 0))
                            const avgSh = shGross > 0
                              ? Math.round(shItems.reduce((s, li) => s + li.sharePercent * li.earnedAmount, 0) / shGross)
                              : Math.round(inv.lineItems[0]?.sharePercent ?? 0)
                            return (
                              <tr key={inv.id} className={`border-t border-slate-100 ${idx % 2 !== 0 ? 'bg-slate-50' : ''}`}>
                                <td className="px-4 py-2 font-mono text-[11px] text-slate-500">
                                  <a href={`/api/invoice/${inv.id}/pdf`} target="_blank" className="text-indigo-600 hover:underline">{inv.invoiceNumber}</a>
                                </td>
                                <td className="px-4 py-2 font-medium text-slate-800">{inv.sellerName}</td>
                                <td className="px-4 py-2 text-slate-400">{fmtDate(inv.invoiceDate)}</td>
                                <td className="px-4 py-2 text-right font-mono text-slate-500">{fmt(gross)}</td>
                                <td className="px-4 py-2 text-right text-[10px]">
                                  <span className="bg-orange-100 text-orange-700 font-semibold px-1.5 py-0.5 rounded">{avgSh}%</span>
                                </td>
                                <td className="px-4 py-2 text-right font-mono">{fmt(inv.totalExVat)}</td>
                                <td className="px-4 py-2 text-right font-mono text-orange-600">{fmt(inv.totalVat)}</td>
                                <td className="px-4 py-2 text-right font-mono font-semibold">{fmt(inv.totalIncVat)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot className="bg-orange-50 border-t-2 border-orange-200">
                          <tr>
                            <td colSpan={5} className="px-4 py-2 text-xs font-bold text-orange-700">Total paid to workers</td>
                            <td className="px-4 py-2 text-right font-bold font-mono text-orange-700">{fmt(workerCostExVat)}</td>
                            <td className="px-4 py-2 text-right font-bold font-mono text-orange-600">{fmt(workerCostVat)}</td>
                            <td className="px-4 py-2 text-right font-bold font-mono text-orange-700">{fmt(round2(workerCostExVat + workerCostVat))}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                  {expandWorkerInvoices && linkedInvoices.length === 0 && (
                    <div className="px-5 py-4 text-xs text-slate-400 border-t border-slate-100">
                      No substitute worker invoices for {selectedYear}.
                    </div>
                  )}
                </div>
              )}

              {/* Other expenses */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-700">Other Business Expenses</h3>
                    <p className="text-[10px] text-slate-400">Phone, travel, equipment, and other deductible costs.</p>
                  </div>
                  <button onClick={() => setShowAddExpense((v) => !v)}
                    className="bg-red-700 text-white text-xs px-3 py-1.5 rounded font-semibold hover:bg-red-800">
                    {showAddExpense ? 'Cancel' : '+ Add Expense'}
                  </button>
                </div>

                {showAddExpense && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <div className="grid grid-cols-4 gap-3 mb-3">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-1">Date *</label>
                        <input type="date" value={expenseForm.date}
                          onChange={(e) => setExpenseForm((p) => ({ ...p, date: e.target.value }))}
                          className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-1">Description *</label>
                        <input type="text" placeholder="e.g. DNA mobile plan" value={expenseForm.description}
                          onChange={(e) => setExpenseForm((p) => ({ ...p, description: e.target.value }))}
                          className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-1">Supplier</label>
                        <input type="text" placeholder="e.g. DNA Oyj" value={expenseForm.supplier}
                          onChange={(e) => setExpenseForm((p) => ({ ...p, supplier: e.target.value }))}
                          className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-1">Category *</label>
                        <select value={expenseForm.category}
                          onChange={(e) => setExpenseForm((p) => ({ ...p, category: e.target.value }))}
                          className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs bg-white">
                          {EXPENSE_CATEGORIES.map((c) => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-3 mb-3">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-1">Amount ex-VAT (€) *</label>
                        <input type="number" step="0.01" min="0" placeholder="0.00" value={expenseForm.amountExVat}
                          onChange={(e) => setExpenseForm((p) => ({ ...p, amountExVat: e.target.value }))}
                          className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-1">VAT Rate %</label>
                        <select value={expenseForm.vatRate}
                          onChange={(e) => setExpenseForm((p) => ({ ...p, vatRate: e.target.value }))}
                          className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs bg-white">
                          <option value="25.5">25.5%</option>
                          <option value="14">14%</option>
                          <option value="10">10%</option>
                          <option value="0">0%</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-1">Receipt / Invoice Ref</label>
                        <input type="text" placeholder="Receipt #" value={expenseForm.receiptRef}
                          onChange={(e) => setExpenseForm((p) => ({ ...p, receiptRef: e.target.value }))}
                          className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-1">Notes</label>
                        <input type="text" placeholder="Optional notes" value={expenseForm.notes}
                          onChange={(e) => setExpenseForm((p) => ({ ...p, notes: e.target.value }))}
                          className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs" />
                      </div>
                    </div>
                    {expenseForm.amountExVat && (
                      <div className="text-xs text-red-700 bg-red-100 rounded px-3 py-1.5 mb-3 font-mono">
                        {fmt(parseFloat(expenseForm.amountExVat)||0)} € +
                        {fmt((parseFloat(expenseForm.amountExVat)||0)*parseFloat(expenseForm.vatRate)/100)} € VAT =
                        {fmt((parseFloat(expenseForm.amountExVat)||0)*(1+parseFloat(expenseForm.vatRate)/100))} € total
                      </div>
                    )}
                    <div className="flex justify-end">
                      <button onClick={handleSaveExpense} disabled={isPending}
                        className="bg-red-700 text-white text-xs px-4 py-1.5 rounded font-semibold hover:bg-red-800 disabled:opacity-50">
                        {isPending ? 'Saving…' : 'Save Expense'}
                      </button>
                    </div>
                  </div>
                )}

                {expenses.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-sm bg-white border border-slate-200 rounded-lg">
                    No expenses recorded for {selectedYear} yet.
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Date</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Description</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Supplier</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Category</th>
                          <th className="text-right px-4 py-2.5 font-semibold text-slate-600">Ex-VAT €</th>
                          <th className="text-right px-4 py-2.5 font-semibold text-slate-600">VAT %</th>
                          <th className="text-right px-4 py-2.5 font-semibold text-slate-600">VAT €</th>
                          <th className="text-right px-4 py-2.5 font-semibold text-slate-600">Total €</th>
                          <th className="w-8 px-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {expenses.map((exp, idx) => (
                          <tr key={exp.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className="px-4 py-2.5 text-slate-500">{fmtDate(exp.date)}</td>
                            <td className="px-4 py-2.5 text-slate-800">
                              {exp.description}
                              {exp.receiptRef && <div className="text-[10px] text-slate-400">Ref: {exp.receiptRef}</div>}
                            </td>
                            <td className="px-4 py-2.5 text-slate-500">{exp.supplier || '—'}</td>
                            <td className="px-4 py-2.5">
                              <span className="bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.5 rounded">
                                {CAT_LABEL[exp.category] ?? exp.category}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono">{fmt(exp.amountExVat)}</td>
                            <td className="px-4 py-2.5 text-right text-slate-500">{exp.vatRate}%</td>
                            <td className="px-4 py-2.5 text-right font-mono text-orange-600">{fmt(exp.vatAmount)}</td>
                            <td className="px-4 py-2.5 text-right font-mono font-semibold">{fmt(exp.totalAmount)}</td>
                            <td className="px-2 py-2.5 text-center">
                              <button onClick={() => handleDeleteExpense(exp.id)} disabled={isPending}
                                className="text-red-400 hover:text-red-600 font-bold text-base leading-none">×</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-red-50 border-t-2 border-red-200">
                        <tr>
                          <td colSpan={4} className="px-4 py-2.5 text-xs font-bold text-red-700">Total other expenses</td>
                          <td className="px-4 py-2.5 text-right font-bold font-mono text-red-700">{fmt(otherExpExVat)}</td>
                          <td></td>
                          <td className="px-4 py-2.5 text-right font-bold font-mono text-orange-600">{fmt(otherExpVat)}</td>
                          <td colSpan={2}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* VAT SUMMARY TAB                                                  */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {!loading && activeTab === 'vat' && (
            <div>
              <div className="mb-4 flex items-end justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="text-sm font-bold text-slate-700 mb-1">VAT Summary — {selectedYear}</h3>
                  <p className="text-[10px] text-slate-400">
                    {filingFrequency === 'quarterly' && 'File quarterly via OmaVero. Q1 Jan–Mar · Q2 Apr–Jun · Q3 Jul–Sep · Q4 Oct–Dec.'}
                    {filingFrequency === 'semiannual' && 'File twice a year via OmaVero. H1 Jan–Jun · H2 Jul–Dec.'}
                    {filingFrequency === 'annual' && 'File once a year via OmaVero, for the whole calendar year.'}
                    {' '}Click a row to see the month-by-month breakdown; click a month to see the exact records behind the numbers.
                  </p>
                </div>
                <div className="flex gap-1 bg-slate-100 rounded p-0.5">
                  {([
                    ['quarterly', 'Quarterly'],
                    ['semiannual', 'Twice a year'],
                    ['annual', 'Once a year'],
                  ] as [VatFilingFrequency, string][]).map(([freq, label]) => (
                    <button
                      key={freq}
                      type="button"
                      onClick={() => changeFilingFrequency(freq)}
                      className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                        filingFrequency === freq ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-5">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">Period</th>
                      {isAccountHolder ? (
                        <>
                          <th className="text-right px-3 py-3 font-semibold text-green-700">
                            Myyntivero<br/><span className="text-[10px] font-normal text-slate-400">Wolt own income</span>
                          </th>
                          {linkedInvoices.length > 0 && (
                            <th className="text-right px-3 py-3 font-semibold text-indigo-600">
                              Myyntivero<br/><span className="text-[10px] font-normal text-slate-400">via substitutes</span>
                            </th>
                          )}
                          {bookkeeperInvoices.length > 0 && (
                            <th className="text-right px-3 py-3 font-semibold text-teal-700">
                              Myyntivero<br/><span className="text-[10px] font-normal text-slate-400">BK services (if you)</span>
                            </th>
                          )}
                          <th className="text-right px-3 py-3 font-semibold text-green-800">
                            Total Output<br/><span className="text-[10px] font-normal text-slate-400">→ Vero owes</span>
                          </th>
                          {linkedInvoices.length > 0 && (
                            <th className="text-right px-3 py-3 font-semibold text-orange-600">
                              Ostovero<br/><span className="text-[10px] font-normal text-slate-400">worker invoices</span>
                            </th>
                          )}
                          {receivedBkInvoices.length > 0 && (
                            <th className="text-right px-3 py-3 font-semibold text-purple-600">
                              Ostovero<br/><span className="text-[10px] font-normal text-slate-400">BK fee paid ✓ deduct</span>
                            </th>
                          )}
                          <th className="text-right px-3 py-3 font-semibold text-red-600">
                            Ostovero<br/><span className="text-[10px] font-normal text-slate-400">other expenses</span>
                          </th>
                          <th className="text-right px-3 py-3 font-semibold text-indigo-700">
                            Net payable<br/><span className="text-[10px] font-normal text-slate-400">to Vero</span>
                          </th>
                        </>
                      ) : (
                        <>
                          <th className="text-right px-3 py-3 font-semibold text-purple-700">
                            Output VAT<br/><span className="text-[10px] font-normal text-slate-400">Your invoices</span>
                          </th>
                          {receivedBkInvoices.length > 0 && (
                            <th className="text-right px-3 py-3 font-semibold text-purple-600">
                              Ostovero<br/><span className="text-[10px] font-normal text-slate-400">BK fee paid ✓ deduct</span>
                            </th>
                          )}
                          <th className="text-right px-3 py-3 font-semibold text-red-600">
                            Input VAT<br/><span className="text-[10px] font-normal text-slate-400">Expenses</span>
                          </th>
                          <th className="text-right px-3 py-3 font-semibold text-indigo-700">
                            Net<br/><span className="text-[10px] font-normal text-slate-400">payable</span>
                          </th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {periods.map((p) => {
                      const active = isAccountHolder
                        ? (p.outVat !== 0 || p.inVatW !== 0 || p.inVatE !== 0)
                        : (p.outVat !== 0 || p.inVatE !== 0)
                      const isOpen = expandedPeriod === p.key
                      return (
                        <Fragment key={p.key}>
                          <tr
                            onClick={() => { setExpandedPeriod(isOpen ? null : p.key); setExpandedMonth(null) }}
                            className={`border-t border-slate-100 cursor-pointer hover:bg-slate-50 ${!active ? 'opacity-40' : ''}`}
                          >
                            <td className="px-4 py-3 font-semibold">
                              <span className="text-slate-400 mr-1">{isOpen ? '▾' : '▸'}</span>{p.label}
                              <a
                                href={`/api/vat-report/pdf?clientId=${selectedClientId}&year=${selectedYear}&freq=${filingFrequency}&key=${p.key}`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="ml-2 font-normal text-[10px] text-indigo-600 hover:underline"
                              >
                                PDF
                              </a>
                            </td>
                            <VatRowCells d={p} isAccountHolder={isAccountHolder} showSubs={linkedInvoices.length > 0} showBk={bookkeeperInvoices.length > 0} showRecBk={receivedBkInvoices.length > 0} />
                          </tr>
                          {isOpen && (
                            <tr key={`${p.key}-detail`}>
                              <td colSpan={99} className="p-0 bg-slate-50/60">
                                <div className="px-4 py-3">
                                  <table className="w-full text-[11px] bg-white border border-slate-200 rounded-lg overflow-hidden">
                                    <thead className="bg-slate-100">
                                      <tr>
                                        <th className="text-left px-3 py-2 font-semibold text-slate-500">Month</th>
                                        {isAccountHolder ? (
                                          <>
                                            <th className="text-right px-3 py-2 font-semibold text-green-700">Own income</th>
                                            {linkedInvoices.length > 0 && <th className="text-right px-3 py-2 font-semibold text-indigo-600">Via substitutes</th>}
                                            {bookkeeperInvoices.length > 0 && <th className="text-right px-3 py-2 font-semibold text-teal-700">BK services</th>}
                                            <th className="text-right px-3 py-2 font-semibold text-green-800">Total Output</th>
                                            {linkedInvoices.length > 0 && <th className="text-right px-3 py-2 font-semibold text-orange-600">Worker inv.</th>}
                                            {receivedBkInvoices.length > 0 && <th className="text-right px-3 py-2 font-semibold text-purple-600">BK fee paid</th>}
                                            <th className="text-right px-3 py-2 font-semibold text-red-600">Expenses</th>
                                            <th className="text-right px-3 py-2 font-semibold text-indigo-700">Net</th>
                                          </>
                                        ) : (
                                          <>
                                            <th className="text-right px-3 py-2 font-semibold text-purple-700">Output VAT</th>
                                            {receivedBkInvoices.length > 0 && <th className="text-right px-3 py-2 font-semibold text-purple-600">BK fee paid</th>}
                                            <th className="text-right px-3 py-2 font-semibold text-red-600">Expenses</th>
                                            <th className="text-right px-3 py-2 font-semibold text-indigo-700">Net</th>
                                          </>
                                        )}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {p.months.map((mo) => {
                                        const moActive = isAccountHolder
                                          ? (mo.outVat !== 0 || mo.inVatW !== 0 || mo.inVatE !== 0 || mo.inVatBkFee !== 0)
                                          : (mo.outVat !== 0 || mo.inVatE !== 0 || mo.inVatBkFee !== 0)
                                        const monthOpen = expandedMonth === mo.m
                                        return (
                                          <Fragment key={mo.m}>
                                            <tr
                                              onClick={() => setExpandedMonth(monthOpen ? null : mo.m)}
                                              className={`border-t border-slate-100 cursor-pointer hover:bg-indigo-50 ${!moActive ? 'text-slate-300' : ''}`}
                                            >
                                              <td className="px-3 py-2 font-medium">
                                                <span className="text-slate-400 mr-1">{monthOpen ? '▾' : '▸'}</span>{MONTH_NAMES[mo.m]}
                                              </td>
                                              <VatRowCells d={mo} isAccountHolder={isAccountHolder} showSubs={linkedInvoices.length > 0} showBk={bookkeeperInvoices.length > 0} showRecBk={receivedBkInvoices.length > 0} muted={!moActive} />
                                            </tr>
                                            {monthOpen && (
                                              <tr key={`${mo.m}-detail`}>
                                                <td colSpan={99} className="p-0">
                                                  <div className="px-4 py-3 bg-indigo-50/40 border-t border-indigo-100">
                                                    <MonthItemization mo={mo} isAccountHolder={isAccountHolder} />
                                                  </div>
                                                </td>
                                              </tr>
                                            )}
                                          </Fragment>
                                        )
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-300 bg-slate-50">
                    <tr>
                      <td className="px-4 py-3 font-bold text-slate-700">Annual Total</td>
                      {isAccountHolder ? (
                        <>
                          <td className="px-3 py-3 text-right font-bold font-mono text-green-700">{fmt(totalIncomeVat)}</td>
                          {linkedInvoices.length > 0 && <td className="px-3 py-3 text-right font-bold font-mono text-indigo-600">{fmt(woltOutputVatFromSubs)}</td>}
                          {bookkeeperInvoices.length > 0 && <td className="px-3 py-3 text-right font-bold font-mono text-teal-700">{fmt(bkIncomeVat)}</td>}
                          <td className="px-3 py-3 text-right font-bold font-mono text-green-800">{fmt(filingOutputVat)}</td>
                          {linkedInvoices.length > 0 && <td className="px-3 py-3 text-right font-bold font-mono text-orange-600">{fmt(workerCostVat)}</td>}
                          {receivedBkInvoices.length > 0 && <td className="px-3 py-3 text-right font-bold font-mono text-purple-600">{fmt(clientBkFeeInputVat)}</td>}
                          <td className="px-3 py-3 text-right font-bold font-mono text-red-600">{fmt(otherExpVat)}</td>
                          <td className={`px-3 py-3 text-right font-bold font-mono text-lg ${netVatPayable >= 0 ? 'text-indigo-700' : 'text-green-600'}`}>{fmt(netVatPayable)}</td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-3 text-right font-bold font-mono text-purple-700">{fmt(sellerIncomeVat)}</td>
                          {receivedBkInvoices.length > 0 && <td className="px-3 py-3 text-right font-bold font-mono text-purple-600">{fmt(clientBkFeeInputVat)}</td>}
                          <td className="px-3 py-3 text-right font-bold font-mono text-red-600">{fmt(otherExpVat)}</td>
                          <td className={`px-3 py-3 text-right font-bold font-mono text-lg ${netVatPayable >= 0 ? 'text-indigo-700' : 'text-green-600'}`}>{fmt(netVatPayable)}</td>
                        </>
                      )}
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* ── VAT logic explainer (account holders) ── */}
              {isAccountHolder && (
                <div className="grid grid-cols-3 gap-3 mb-4 text-xs">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="font-bold text-green-800 mb-1">📥 Myyntivero (output VAT)</div>
                    <div className="text-green-700">Wolt pays your courier fees <strong>including VAT</strong>. You collected this VAT — it must be returned to Vero.</div>
                    <div className="mt-1 font-mono font-bold text-green-800">{fmt(filingOutputVat)} €</div>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <div className="font-bold text-purple-800 mb-1">📤 Ostovero (input VAT, deductible)</div>
                    <div className="text-purple-700">VAT you paid on your business purchases — <strong>worker fees, bookkeeper fee, expenses</strong>. Deduct this from your Vero payment.</div>
                    <div className="mt-1 font-mono font-bold text-purple-800">{fmt(filingInputVat)} €</div>
                  </div>
                  <div className={`rounded-lg p-3 border ${netVatPayable >= 0 ? 'bg-indigo-50 border-indigo-200' : 'bg-emerald-50 border-emerald-200'}`}>
                    <div className={`font-bold mb-1 ${netVatPayable >= 0 ? 'text-indigo-800' : 'text-emerald-800'}`}>
                      {netVatPayable >= 0 ? '→ You pay Vero' : '→ Vero refunds you'}
                    </div>
                    <div className={`text-xs ${netVatPayable >= 0 ? 'text-indigo-700' : 'text-emerald-700'}`}>
                      Myyntivero {fmt(filingOutputVat)} − Ostovero {fmt(filingInputVat)}
                    </div>
                    <div className={`mt-1 font-mono font-bold text-lg ${netVatPayable >= 0 ? 'text-indigo-800' : 'text-emerald-800'}`}>{fmt(Math.abs(netVatPayable))} €</div>
                  </div>
                </div>
              )}

              {/* ── Received bookkeeper invoices (client's deductible input VAT) ── */}
              {receivedBkInvoices.length > 0 && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl overflow-hidden mb-4">
                  <div className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-purple-800">Bookkeeper service invoices received — your deductible VAT</div>
                      <div className="text-[10px] text-purple-600 mt-0.5">
                        These are invoices your bookkeeper issued to you. The VAT column is your <strong>ostovero</strong> — deduct it from your Vero payment.
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <div className="text-[10px] text-purple-500">Deductible VAT</div>
                      <div className="text-base font-bold text-purple-700 font-mono">{fmt(clientBkFeeInputVat)} €</div>
                    </div>
                  </div>
                  <table className="w-full text-xs border-t border-purple-200">
                    <thead className="bg-white">
                      <tr>
                        <th className="text-left px-4 py-2 font-semibold text-slate-500">Invoice #</th>
                        <th className="text-left px-3 py-2 font-semibold text-slate-500">Date</th>
                        <th className="text-right px-3 py-2 font-semibold text-slate-600">Service ex-VAT</th>
                        <th className="text-right px-3 py-2 font-semibold text-purple-700">VAT (deductible)</th>
                        <th className="text-right px-4 py-2 font-semibold text-slate-600">Total paid</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receivedBkInvoices.map((inv, idx) => (
                        <tr key={inv.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-purple-50/40'}>
                          <td className="px-4 py-2 font-mono text-[11px] text-slate-500">{inv.invoiceNumber}</td>
                          <td className="px-3 py-2 text-slate-600">{fmtDate(inv.issueDate)}</td>
                          <td className="px-3 py-2 text-right font-mono text-slate-700">{fmt(inv.amountExVat)}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-purple-700">{fmt(inv.vatAmount)} €</td>
                          <td className="px-4 py-2 text-right font-mono font-semibold text-slate-800">{fmt(inv.totalIncVat)} €</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t border-purple-200 bg-purple-100">
                      <tr>
                        <td colSpan={3} className="px-4 py-2 text-xs font-bold text-purple-800">Total deductible</td>
                        <td className="px-3 py-2 text-right font-bold font-mono text-purple-700">{fmt(clientBkFeeInputVat)} €</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* ── How to file ── */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 text-xs text-indigo-700">
                <strong>How to file in OmaVero:</strong> Arvonlisävero → Ilmoita ALV.
                {isAccountHolder
                  ? <>
                      {' '}Enter <em>Vero kotimaan myynneistä</em> = <strong>{fmt(filingOutputVat)} €</strong> (output VAT from Wolt income).
                      {' '}Enter <em>Vähennettävä vero</em> = <strong>{fmt(filingInputVat)} €</strong> (all purchase VAT you paid
                      {clientBkFeeInputVat > 0 && <>, incl. <strong>{fmt(clientBkFeeInputVat)} €</strong> bookkeeper fee</>}
                      ).
                    </>
                  : <>
                      {' '}Enter <em>Vero kotimaan myynneistä</em> = <strong>{fmt(sellerIncomeVat)} €</strong>.
                      {filingInputVat > 0 && <> Enter <em>Vähennettävä vero</em> = <strong>{fmt(filingInputVat)} €</strong>.</>}
                    </>}
                {' '}Net {netVatPayable >= 0 ? 'payable' : 'refund'}: <strong>{fmt(Math.abs(netVatPayable))} €</strong>.
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* TAX RETURN TAB                                                   */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {!loading && activeTab === 'tax' && (
            <div>
              <div className="mb-4">
                <h3 className="text-sm font-bold text-slate-700 mb-1">Annual Income Tax Reference — {selectedYear}</h3>
                <p className="text-[10px] text-slate-400">Elinkeinotoiminnan veroilmoitus (Form 5/6) · sole trader reference figures for OmaVero.</p>
              </div>

              {(depreciationSchedule.currentYear.openingBalance > 0 || depreciationSchedule.currentYear.additions > 0) && (
                <div className="bg-white border border-amber-200 rounded-xl overflow-hidden mb-4">
                  <div className="px-5 py-3 bg-amber-50 border-b border-amber-200">
                    <div className="text-xs font-bold text-amber-800">Capital Assets & Depreciation (Poistot)</div>
                    <div className="text-[10px] text-amber-700 mt-0.5">
                      Equipment/vehicle purchases over {fmt(SMALL_ACQUISITION_THRESHOLD)} € can&apos;t be deducted in full —
                      Finnish tax law (EVL 30§) requires depreciating them at max {DEPRECIATION_RATE * 100}%/year on the
                      declining balance, until the remaining balance drops to {fmt(SMALL_ACQUISITION_THRESHOLD)} € or below,
                      at which point it&apos;s written off in full. Calculated automatically below.
                    </div>
                  </div>
                  <table className="w-full text-xs">
                    <tbody>
                      <tr className="border-b border-slate-100">
                        <td className="px-5 py-2 text-slate-500">Opening balance (menojäännös 1.1.{selectedYear})</td>
                        <td className="px-5 py-2 text-right font-mono">{fmt(depreciationSchedule.currentYear.openingBalance)} €</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="px-5 py-2 text-slate-500">+ New acquisitions this year</td>
                        <td className="px-5 py-2 text-right font-mono">{fmt(depreciationSchedule.currentYear.additions)} €</td>
                      </tr>
                      <tr className="border-b border-slate-100 bg-amber-50/40">
                        <td className="px-5 py-2 font-semibold text-amber-800">− Depreciation this year (poisto)</td>
                        <td className="px-5 py-2 text-right font-mono font-semibold text-amber-800">{fmt(depreciationSchedule.currentYear.depreciation)} €</td>
                      </tr>
                      <tr>
                        <td className="px-5 py-2 font-bold text-slate-700">= Closing balance (menojäännös 31.12.{selectedYear}, carried forward)</td>
                        <td className="px-5 py-2 text-right font-mono font-bold">{fmt(depreciationSchedule.currentYear.closingBalance)} €</td>
                      </tr>
                    </tbody>
                  </table>
                  {expenses.filter(isCapitalAsset).length > 0 && (
                    <div className="border-t border-slate-100 px-5 py-3">
                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">
                        Qualifying purchases acquired in {selectedYear}
                      </div>
                      <table className="w-full text-[11px]">
                        <tbody>
                          {expenses.filter(isCapitalAsset).map((e) => (
                            <tr key={e.id} className="border-t border-slate-50">
                              <td className="py-1 text-slate-500">{fmtDate(e.date)}</td>
                              <td className="py-1 text-slate-600">{e.description}</td>
                              <td className="py-1 text-right font-mono">{fmt(e.amountExVat)} €</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">

                {isAccountHolder ? (
                  <>
                    {linkedInvoices.length > 0 && (
                      <div className="px-5 py-4 bg-indigo-50">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-xs font-bold text-indigo-800">Liikevaihto — Substitute Delivery Periods</div>
                            <div className="text-[10px] text-indigo-600 mt-0.5">
                              {linkedInvoices.length} invoice{linkedInvoices.length !== 1 ? 's' : ''} · Wolt gross {fmt(woltGrossFromSubstitutes)} € − worker paid {fmt(workerCostExVat)} €
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-sm font-bold text-indigo-700 font-mono">{fmt(ownerCutExVat)} €</div>
                            <div className="text-[10px] text-indigo-500">your cut</div>
                          </div>
                        </div>
                      </div>
                    )}
                    {incomes.length > 0 ? (
                      <div className="px-5 py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-xs font-bold text-slate-700">
                              Liikevaihto — {linkedInvoices.length > 0 ? 'Own Delivery Periods' : 'Wolt Income Periods'}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{incomes.length} period{incomes.length !== 1 ? 's' : ''}</div>
                          </div>
                          <div className="text-sm font-bold text-green-700 font-mono shrink-0">{fmt(totalIncomeExVat)} €</div>
                        </div>
                      </div>
                    ) : linkedInvoices.length === 0 && (
                      <div className="px-5 py-4 text-xs text-slate-400 italic">No income recorded for {selectedYear}.</div>
                    )}
                  </>
                ) : (
                  <div className="px-5 py-4 bg-purple-50">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-xs font-bold text-purple-800">Liikevaihto — Invoices Sent</div>
                        <div className="text-[10px] text-purple-600 mt-0.5">{sellerInvoices.length} invoice{sellerInvoices.length !== 1 ? 's' : ''}</div>
                      </div>
                      <div className="text-sm font-bold text-purple-700 font-mono shrink-0">{fmt(sellerIncomeExVat)} €</div>
                    </div>
                  </div>
                )}

                {expByCategory.map((cat) => (
                  <div key={cat.value} className="px-5 py-3 bg-red-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold text-slate-700">− {cat.label}</div>
                        <div className="text-[10px] text-slate-400">{cat.rows.length} entr{cat.rows.length !== 1 ? 'ies' : 'y'}</div>
                      </div>
                      <div className="text-sm font-semibold text-red-700 font-mono">− {fmt(cat.total)} €</div>
                    </div>
                  </div>
                ))}

                {depreciationSchedule.currentYear.depreciation > 0 && (
                  <div className="px-5 py-3 bg-amber-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold text-amber-800">− Poistot / Depreciation</div>
                        <div className="text-[10px] text-amber-600">capital assets — see panel above</div>
                      </div>
                      <div className="text-sm font-semibold text-amber-800 font-mono">− {fmt(depreciationSchedule.currentYear.depreciation)} €</div>
                    </div>
                  </div>
                )}

                {taxDeductibleExpenses === 0 && (
                  <div className="px-5 py-3 text-[10px] text-slate-400 italic">
                    No other expenses — add them in the Expenses tab.
                  </div>
                )}

                <div className="px-5 py-4 bg-slate-50">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-bold text-slate-700">= Verotettava tulos / Taxable profit</div>
                    <div className={`text-xl font-bold font-mono ${taxableProfit >= 0 ? 'text-indigo-700' : 'text-red-600'}`}>{fmt(taxableProfit)} €</div>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 font-mono">
                    {fmt(incomeExVat)} − {fmt(taxDeductibleExpenses)} = {fmt(taxableProfit)} €
                  </div>
                </div>
              </div>

              <div className="mt-4 bg-indigo-50 border border-indigo-200 rounded-lg p-4 text-xs text-indigo-700">
                <strong>How to file:</strong> OmaVero → Veroilmoitus → Elinkeinotoiminnan veroilmoitus.
                Revenue (<strong>{fmt(incomeExVat)} €</strong>) → <em>Liikevaihto</em>.
                {taxDeductibleExpenses > 0 && <> Expenses (<strong>{fmt(taxDeductibleExpenses)} €</strong>) → respective categories.</>}
                {depreciationSchedule.currentYear.depreciation > 0 && (
                  <> Includes <strong>{fmt(depreciationSchedule.currentYear.depreciation)} €</strong> of depreciation on capital assets — see Capital Assets panel above.</>
                )}
                {' '}Taxable profit = <strong>{fmt(taxableProfit)} €</strong>.
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* VEHICLE & MILEAGE TAB                                          */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {!loading && activeTab === 'vehicle' && (
            <VehicleTab clientId={selectedClientId!} year={selectedYear} />
          )}

        </div>
      )}
    </div>
  )
}
