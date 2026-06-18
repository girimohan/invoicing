'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import VehicleTab from '@/components/VehicleTab'
import {
  getOwnerBooks,
  createOwnerIncomePeriod,
  deleteOwnerIncomePeriod,
  createOwnerExpense,
  deleteOwnerExpense,
} from '@/actions/owner-books'

// ─── Types ────────────────────────────────────────────────────────────────────

type Client = { id: number; displayId: string; name: string; role: string; invoiceCount?: number; buyerInvoiceCount?: number }

type IncomePeriod = {
  id: string
  periodStart: Date
  periodEnd: Date
  description: string | null
  woltInvoiceRef: string | null
  totalExVat: number
  tipsExVat: number
  vatRate: number
  vatAmount: number
  totalIncVat: number
  notes: string | null
}

type Expense = {
  id: string
  date: Date
  description: string
  supplier: string | null
  category: string
  amountExVat: number
  vatRate: number
  vatAmount: number
  totalAmount: number
  receiptRef: string | null
}

type LineItem = {
  earnedAmount: number
  sharePercent: number
  vatRate: number
  amountExVat: number
  vatAmount: number
}

type LinkedInvoice = {
  id: string
  invoiceNumber: string
  invoiceDate: Date
  sellerName: string
  buyerName: string
  totalExVat: number
  totalVat: number
  totalIncVat: number
  lineItems: LineItem[]
}

type BookkeeperInvoice = {
  id: string
  invoiceNumber: string
  issueDate: Date
  clientName: string
  amountExVat: number
  vatRate: number
  vatAmount: number
  totalIncVat: number
}

type Tab = 'income' | 'expenses' | 'vat' | 'tax' | 'vehicle'

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
function fmt(n: number) { return n.toFixed(2) }
function r2(n: number) { return Math.round(n * 100) / 100 }

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString('fi-FI', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function getQuarter(d: Date) { return Math.floor(new Date(d).getMonth() / 3) + 1 }

// ─── Component ────────────────────────────────────────────────────────────────

export default function BooksApp({ initialClients }: { initialClients: Client[] }) {
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [activeTab, setActiveTab] = useState<Tab>('income')
  const [loading, setLoading] = useState(false)
  const [incomes, setIncomes] = useState<IncomePeriod[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [linkedInvoices, setLinkedInvoices] = useState<LinkedInvoice[]>([])
  const [sellerInvoices, setSellerInvoices] = useState<LinkedInvoice[]>([])
  const [bookkeeperInvoices, setBookkeeperInvoices] = useState<BookkeeperInvoice[]>([])
  const [showAddIncome, setShowAddIncome] = useState(false)
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [expandWorkerInvoices, setExpandWorkerInvoices] = useState(false)
  const [isPending, startTransition] = useTransition()

  const [incomeForm, setIncomeForm] = useState({
    periodStart: '', periodEnd: '', woltInvoiceRef: '', description: '',
    totalExVat: '', tipsExVat: '', vatRate: '25.5', notes: '',
  })

  const [expenseForm, setExpenseForm] = useState({
    date: todayIso(), description: '', supplier: '', category: 'OTHER',
    amountExVat: '', vatRate: '25.5', receiptRef: '', notes: '',
  })

  useEffect(() => {
    if (selectedClientId === null) return
    setLoading(true)
    setIncomes([]); setExpenses([]); setLinkedInvoices([]); setSellerInvoices([]); setBookkeeperInvoices([])
    getOwnerBooks(selectedClientId, selectedYear)
      .then(({ incomes, expenses, linkedInvoices, sellerInvoices, bookkeeperInvoices }) => {
        setIncomes(incomes as IncomePeriod[])
        setExpenses(expenses as Expense[])
        setLinkedInvoices(linkedInvoices as unknown as LinkedInvoice[])
        setSellerInvoices(sellerInvoices as unknown as LinkedInvoice[])
        setBookkeeperInvoices((bookkeeperInvoices ?? []) as unknown as BookkeeperInvoice[])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [selectedClientId, selectedYear])

  const selectedClient = initialClients.find((c) => c.id === selectedClientId)
  const isAccountHolder = selectedClient?.role !== 'SUBSTITUTE_WORKER'

  // ── Substitute-period income calculations (account holder only) ───────────
  // earnedAmount = full Wolt gross; amountExVat = worker's share; owner cut = gross - worker
  const allLinkedItems = linkedInvoices.flatMap(i => i.lineItems)
  const woltGrossFromSubstitutes = r2(allLinkedItems.reduce((s, li) => s + li.earnedAmount, 0))
  const ownerCutExVat            = r2(allLinkedItems.reduce((s, li) => s + (li.earnedAmount - li.amountExVat), 0))
  const ownerCutVat              = r2(allLinkedItems.reduce((s, li) => s + (li.earnedAmount - li.amountExVat) * li.vatRate / 100, 0))
  const woltOutputVatFromSubs    = r2(allLinkedItems.reduce((s, li) => s + li.earnedAmount * li.vatRate / 100, 0))
  const workerCostExVat          = r2(linkedInvoices.reduce((s, i) => s + i.totalExVat, 0))
  const workerCostVat            = r2(linkedInvoices.reduce((s, i) => s + i.totalVat, 0))

  // ── Bookkeeper invoice income (Mohan's bookkeeping fees to clients) ───────────────────
  const bkIncomeExVat = r2(bookkeeperInvoices.reduce((s, i) => s + i.amountExVat, 0))
  const bkIncomeVat   = r2(bookkeeperInvoices.reduce((s, i) => s + i.vatAmount, 0))

  // ── Manual own-work income (account holders, periods they personally delivered) ──
  const totalIncomeExVat  = r2(incomes.reduce((s, i) => s + i.totalExVat, 0))
  const totalIncomeTips   = r2(incomes.reduce((s, i) => s + (i.tipsExVat ?? 0), 0))
  const totalIncomeVat    = r2(incomes.reduce((s, i) => s + i.vatAmount, 0))
  // totalIncVat already includes tips (stored correctly in DB)
  const totalIncomeGross  = r2(incomes.reduce((s, i) => s + i.totalIncVat, 0))

  // ── Substitute worker invoice income ──────────────────────────────────────
  const sellerIncomeExVat = r2(sellerInvoices.reduce((s, i) => s + i.totalExVat, 0))
  const sellerIncomeVat   = r2(sellerInvoices.reduce((s, i) => s + i.totalVat, 0))

  const otherExpExVat = r2(expenses.reduce((s, e) => s + e.amountExVat, 0))
  const otherExpVat   = r2(expenses.reduce((s, e) => s + e.vatAmount, 0))

  // incomeExVat: account holder = own Wolt fees + tips + net owner cut + bookkeeping fees
  //              substitute     = invoice income
  // ownerCutExVat already NETS out the worker payment, so NO double subtraction
  const incomeExVat = isAccountHolder
    ? r2(totalIncomeExVat + totalIncomeTips + ownerCutExVat + bkIncomeExVat)
    : sellerIncomeExVat

  const netProfit = r2(incomeExVat - otherExpExVat)

  // VAT filing:
  // Account holder output = VAT on own Wolt income + VAT on FULL Wolt gross for sub periods + bookkeeping VAT
  //           input  = worker invoice VAT (deductible) + other expense VAT
  const filingOutputVat = isAccountHolder
    ? r2(totalIncomeVat + woltOutputVatFromSubs + bkIncomeVat)
    : sellerIncomeVat
  const filingInputVat = isAccountHolder
    ? r2(workerCostVat + otherExpVat)
    : otherExpVat
  const netVatPayable = r2(filingOutputVat - filingInputVat)

  function quarterData(q: number) {
    const qi = incomes.filter(i => getQuarter(i.periodStart) === q)
    const ql = linkedInvoices.filter(i => getQuarter(i.invoiceDate) === q)
    const qs = sellerInvoices.filter(i => getQuarter(i.invoiceDate) === q)
    const qe = expenses.filter(e => getQuarter(e.date) === q)
    const qbk = bookkeeperInvoices.filter(i => getQuarter(i.issueDate) === q)
    const qlItems = ql.flatMap(i => i.lineItems)
    if (isAccountHolder) {
      const outVatOwn  = r2(qi.reduce((s, i) => s + i.vatAmount, 0))
      const outVatSubs = r2(qlItems.reduce((s, li) => s + li.earnedAmount * li.vatRate / 100, 0))
      const outVatBk   = r2(qbk.reduce((s, i) => s + i.vatAmount, 0))
      const outVat     = r2(outVatOwn + outVatSubs + outVatBk)
      const inVatW     = r2(ql.reduce((s, i) => s + i.totalVat, 0))
      const inVatE     = r2(qe.reduce((s, e) => s + e.vatAmount, 0))
      return { outVat, outVatOwn, outVatSubs, outVatBk, inVatW, inVatE, net: r2(outVat - inVatW - inVatE) }
    } else {
      const outVat = r2(qs.reduce((s, i) => s + i.totalVat, 0))
      const inVatE = r2(qe.reduce((s, e) => s + e.vatAmount, 0))
      return { outVat, outVatOwn: 0, outVatSubs: 0, outVatBk: 0, inVatW: 0, inVatE, net: r2(outVat - inVatE) }
    }
  }

  const expByCategory = EXPENSE_CATEGORIES.map((cat) => {
    const rows = expenses.filter((e) => e.category === cat.value)
    return { ...cat, rows, total: r2(rows.reduce((s, e) => s + e.amountExVat, 0)) }
  }).filter((c) => c.rows.length > 0)

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
    startTransition(async () => {
      await deleteOwnerIncomePeriod(id)
      setIncomes((prev) => prev.filter((i) => i.id !== id))
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
    })
  }, [selectedClientId, expenseForm])

  const handleDeleteExpense = useCallback((id: string) => {
    if (!confirm('Delete this expense?')) return
    startTransition(async () => {
      await deleteOwnerExpense(id)
      setExpenses((prev) => prev.filter((e) => e.id !== id))
    })
  }, [])

  const years = Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - i)

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Top bar ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 sticky top-0 z-20">
        <div>
          <h1 className="font-bold text-base text-gray-800">Client Books</h1>
          <p className="text-[10px] text-gray-400">VAT filing · income tax reference · expense tracking</p>
        </div>
        {selectedClientId !== null && (
          <button
            onClick={() => { setSelectedClientId(null); setActiveTab('income') }}
            className="ml-2 flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
          >
            ← All Clients
          </button>
        )}
        <div className="flex items-center gap-1 ml-auto">
          {years.map((yr) => (
            <button key={yr} onClick={() => setSelectedYear(yr)}
              className={`px-3 py-1 rounded text-xs font-semibold border transition-colors ${
                yr === selectedYear ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-500 border-gray-200 hover:border-blue-400'
              }`}>{yr}</button>
          ))}
        </div>
      </div>

      {/* ── No client selected: overview grid ── */}
      {selectedClientId === null && (
        <div className="max-w-5xl mx-auto mt-6 px-6">
          <h2 className="text-sm font-bold text-gray-700 mb-4">All Clients — {selectedYear}</h2>
          {initialClients.length === 0 && (
            <div className="text-center py-16 text-gray-400 text-sm">
              No clients yet. <a href="/clients" className="text-blue-600 hover:underline">Add a client →</a>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {initialClients.map((c) => (
              <button key={c.id} onClick={() => { setSelectedClientId(c.id); setActiveTab('income') }}
                className="bg-white border border-gray-200 rounded-xl px-5 py-4 text-left hover:border-indigo-400 hover:shadow-md transition-all group">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-1.5 py-0.5 rounded">{c.displayId}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                    c.role === 'SUBSTITUTE_WORKER' ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'
                  }`}>{c.role === 'SUBSTITUTE_WORKER' ? 'Substitute Worker' : 'Account Holder'}</span>
                </div>
                <div className="text-base font-bold text-gray-800 mb-2">{c.name}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-gray-400">
                    {c.role === 'SUBSTITUTE_WORKER'
                      ? <>{(c.invoiceCount ?? 0)} invoice{(c.invoiceCount ?? 0) !== 1 ? 's' : ''} sent</>
                      : <>{(c.buyerInvoiceCount ?? 0)} invoice{(c.buyerInvoiceCount ?? 0) !== 1 ? 's' : ''} received</>
                    }
                  </span>
                  <span className="text-[10px] text-indigo-500 font-semibold group-hover:text-indigo-700">View books →</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Client selected ── */}
      {selectedClientId !== null && (
        <div className="max-w-5xl mx-auto px-6 py-5">

          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <button onClick={() => setSelectedClientId(null)}
              className="text-xs text-gray-400 hover:text-indigo-600 font-medium transition-colors">
              ← All Clients
            </button>
            <span className="text-gray-200">/</span>
            <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-0.5 rounded">{selectedClient?.displayId}</span>
            <h2 className="text-base font-bold text-gray-800">{selectedClient?.name}</h2>
            {isAccountHolder
              ? <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-indigo-100 text-indigo-700">Account Holder</span>
              : <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-purple-100 text-purple-700">Substitute Worker</span>}
          </div>

          {/* ── Summary cards ── */}
          {isAccountHolder ? (
            <div className="grid grid-cols-4 gap-3 mb-5">
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-[10px] text-gray-400 mb-1 font-medium uppercase tracking-wide">
                  {linkedInvoices.length > 0 ? 'Net Revenue (ex-VAT)' : 'Wolt Income (ex-VAT)'}
                </div>
                <div className="text-xl font-bold text-green-700 font-mono">{fmt(incomeExVat)} €</div>
                {(linkedInvoices.length > 0 || bookkeeperInvoices.length > 0 || totalIncomeTips > 0) && (
                  <div className="text-[10px] text-gray-400 mt-1">
                    Fees {fmt(totalIncomeExVat)}
                    {totalIncomeTips > 0 && <> + Tips {fmt(totalIncomeTips)}</>}
                    {ownerCutExVat > 0 && <> + Sub cut {fmt(ownerCutExVat)}</>}
                    {bkIncomeExVat > 0 && <> + BK {fmt(bkIncomeExVat)}</>}
                  </div>
                )}
              </div>
              {linkedInvoices.length > 0 ? (
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="text-[10px] text-gray-400 mb-1 font-medium uppercase tracking-wide">Worker Payments (ex-VAT)</div>
                  <div className="text-xl font-bold text-orange-600 font-mono">{fmt(workerCostExVat)} €</div>
                  <div className="text-[10px] text-gray-400 mt-1">{linkedInvoices.length} invoice{linkedInvoices.length !== 1 ? 's' : ''} · netted from revenue</div>
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-xl p-4 opacity-30 pointer-events-none">
                  <div className="text-[10px] text-gray-400 mb-1 font-medium uppercase tracking-wide">Worker Payments</div>
                  <div className="text-xl font-bold text-gray-300 font-mono">—</div>
                  <div className="text-[10px] text-gray-300 mt-1">No substitutes this year</div>
                </div>
              )}
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-[10px] text-gray-400 mb-1 font-medium uppercase tracking-wide">Other Expenses (ex-VAT)</div>
                <div className="text-xl font-bold text-red-600 font-mono">{fmt(otherExpExVat)} €</div>
                {expenses.length > 0 && <div className="text-[10px] text-gray-400 mt-1">{expenses.length} entries</div>}
              </div>
              <div className={`rounded-xl p-4 border ${netProfit >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
                <div className="text-[10px] text-gray-400 mb-1 font-medium uppercase tracking-wide">Net Profit (before tax)</div>
                <div className={`text-xl font-bold font-mono ${netProfit >= 0 ? 'text-blue-700' : 'text-red-600'}`}>{fmt(netProfit)} €</div>
                <div className="text-[10px] text-gray-400 mt-1">Revenue − expenses</div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-[10px] text-gray-400 mb-1 font-medium uppercase tracking-wide">Invoice Income (ex-VAT)</div>
                <div className="text-xl font-bold text-purple-700 font-mono">{fmt(sellerIncomeExVat)} €</div>
                {sellerInvoices.length > 0 && <div className="text-[10px] text-gray-400 mt-1">{sellerInvoices.length} invoice{sellerInvoices.length !== 1 ? 's' : ''}</div>}
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-[10px] text-gray-400 mb-1 font-medium uppercase tracking-wide">Other Expenses (ex-VAT)</div>
                <div className="text-xl font-bold text-red-600 font-mono">{fmt(otherExpExVat)} €</div>
              </div>
              <div className={`rounded-xl p-4 border ${netProfit >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
                <div className="text-[10px] text-gray-400 mb-1 font-medium uppercase tracking-wide">Net Profit (before tax)</div>
                <div className={`text-xl font-bold font-mono ${netProfit >= 0 ? 'text-blue-700' : 'text-red-600'}`}>{fmt(netProfit)} €</div>
              </div>
            </div>
          )}

          {/* ── Tab bar ── */}
          <div className="flex gap-1 mb-4 border-b border-gray-200">
            {([
              { key: 'income',   label: isAccountHolder ? 'Income' : 'Invoices Sent' },
              { key: 'expenses', label: 'Expenses' },
              { key: 'vat',      label: 'VAT Summary' },
              { key: 'tax',      label: 'Tax Return' },
              { key: 'vehicle',  label: 'Vehicle & Mileage' },
            ] as { key: Tab; label: string }[]).map((t) => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors -mb-px ${
                  activeTab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>{t.label}</button>
            ))}
          </div>

          {loading && <div className="text-xs text-gray-400 py-8 text-center">Loading…</div>}

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
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Invoice #</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Worker</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Date</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-gray-600">Wolt Gross</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-gray-500">Share %</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-orange-600">Worker Paid</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-indigo-700">Your Cut</th>
                        <th className="w-10 px-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {linkedInvoices.map((inv, idx) => {
                        const gross   = r2(inv.lineItems.reduce((s, li) => s + li.earnedAmount, 0))
                        const paid    = inv.totalExVat
                        const cut     = r2(gross - paid)
                        const shItems = inv.lineItems.filter(li => li.sharePercent < 100)
                        const shGross = r2(shItems.reduce((s, li) => s + li.earnedAmount, 0))
                        const avgSh   = shGross > 0
                          ? Math.round(shItems.reduce((s, li) => s + li.sharePercent * li.earnedAmount, 0) / shGross)
                          : Math.round(inv.lineItems[0]?.sharePercent ?? 0)
                        return (
                          <tr key={inv.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-4 py-2.5 font-mono text-gray-500 text-[11px]">{inv.invoiceNumber}</td>
                            <td className="px-4 py-2.5 font-medium text-gray-800">{inv.sellerName}</td>
                            <td className="px-4 py-2.5 text-gray-400">{fmtDate(inv.invoiceDate)}</td>
                            <td className="px-4 py-2.5 text-right font-mono text-gray-700">{fmt(gross)}</td>
                            <td className="px-4 py-2.5 text-right">
                              <span className="bg-orange-100 text-orange-700 font-semibold px-1.5 py-0.5 rounded text-[10px]">{avgSh}%</span>
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono text-orange-600">−{fmt(paid)}</td>
                            <td className="px-4 py-2.5 text-right font-mono font-bold text-indigo-700">{fmt(cut)}</td>
                            <td className="px-2 py-2.5 text-center">
                              <a href={`/api/invoice/${inv.id}/pdf`} target="_blank" className="text-blue-500 hover:text-blue-700 text-[10px]">PDF</a>
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
                        <td className="px-4 py-2.5 text-right font-bold font-mono text-gray-700">{fmt(woltGrossFromSubstitutes)}</td>
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
                    <h3 className="text-sm font-bold text-gray-700">
                      {linkedInvoices.length > 0 ? 'Own Delivery Income' : 'Wolt Income Periods'}
                    </h3>
                    <p className="text-[10px] text-gray-400">
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
                        <label className="block text-[10px] font-semibold text-gray-600 mb-1">Period Start *</label>
                        <input type="date" value={incomeForm.periodStart}
                          onChange={(e) => setIncomeForm((p) => ({ ...p, periodStart: e.target.value }))}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-600 mb-1">Period End *</label>
                        <input type="date" value={incomeForm.periodEnd}
                          onChange={(e) => setIncomeForm((p) => ({ ...p, periodEnd: e.target.value }))}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-600 mb-1">Wolt Invoice Reference</label>
                        <input type="text" placeholder="FIN/26/XXXXXXX/1/1" value={incomeForm.woltInvoiceRef}
                          onChange={(e) => setIncomeForm((p) => ({ ...p, woltInvoiceRef: e.target.value }))}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-600 mb-1">Total ex-VAT (€) *</label>
                        <input type="number" step="0.01" min="0" placeholder="0.00" value={incomeForm.totalExVat}
                          onChange={(e) => setIncomeForm((p) => ({ ...p, totalExVat: e.target.value }))}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs" />
                        <span className="text-[9px] text-gray-400">Courier fees — taxable at {incomeForm.vatRate}%</span>
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-600 mb-1">Tips (€) <span className="text-gray-400 font-normal">0% VAT</span></label>
                        <input type="number" step="0.01" min="0" placeholder="0.00" value={incomeForm.tipsExVat}
                          onChange={(e) => setIncomeForm((p) => ({ ...p, tipsExVat: e.target.value }))}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs" />
                        <span className="text-[9px] text-gray-400">Tips are VAT-exempt — no VAT charged</span>
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-600 mb-1">VAT Rate % <span className="text-gray-400 font-normal">(courier fees)</span></label>
                        <select value={incomeForm.vatRate}
                          onChange={(e) => setIncomeForm((p) => ({ ...p, vatRate: e.target.value }))}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs bg-white">
                          <option value="25.5">25.5%</option>
                          <option value="14">14%</option>
                          <option value="10">10%</option>
                          <option value="0">0%</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div className="col-span-3">
                        <label className="block text-[10px] font-semibold text-gray-600 mb-1">Description</label>
                        <input type="text" placeholder="e.g. April 1–15 courier fees" value={incomeForm.description}
                          onChange={(e) => setIncomeForm((p) => ({ ...p, description: e.target.value }))}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs" />
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
                  <div className="text-center py-10 text-gray-400 text-sm bg-white border border-gray-200 rounded-lg">
                    {linkedInvoices.length > 0
                      ? <>No own delivery periods recorded for {selectedYear}.</>
                      : <>No income periods recorded for {selectedYear} yet.</>}
                  </div>
                ) : (
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Period</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Wolt Reference</th>
                          <th className="text-right px-4 py-2.5 font-semibold text-gray-600">Fees ex-VAT €</th>
                          <th className="text-right px-4 py-2.5 font-semibold text-gray-600">Tips (0%) €</th>
                          <th className="text-right px-4 py-2.5 font-semibold text-gray-600">VAT %</th>
                          <th className="text-right px-4 py-2.5 font-semibold text-gray-600">VAT €</th>
                          <th className="text-right px-4 py-2.5 font-semibold text-gray-600">Total €</th>
                          <th className="w-8 px-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {incomes.map((inc, idx) => (
                          <tr key={inc.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-4 py-2.5 text-gray-800">
                              {fmtDate(inc.periodStart)} – {fmtDate(inc.periodEnd)}
                              {inc.description && <div className="text-[10px] text-gray-400">{inc.description}</div>}
                            </td>
                            <td className="px-4 py-2.5 text-gray-500 font-mono text-[11px]">{inc.woltInvoiceRef || '—'}</td>
                            <td className="px-4 py-2.5 text-right font-mono">{fmt(inc.totalExVat)}</td>
                            <td className="px-4 py-2.5 text-right font-mono text-teal-600">
                              {(inc.tipsExVat ?? 0) > 0 ? fmt(inc.tipsExVat) : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-2.5 text-right text-gray-500">{inc.vatRate}%</td>
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
                  <span className="text-gray-400">+</span>
                  <span>Cut from substitutes <strong className="font-mono text-indigo-700">{fmt(ownerCutExVat)} €</strong></span>
                  <span className="text-gray-400">=</span>
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
                <h3 className="text-sm font-bold text-gray-700">Invoices Sent</h3>
                <span className="text-[10px] bg-purple-100 text-purple-700 font-semibold px-2 py-0.5 rounded border border-purple-200">auto-linked</span>
                {sellerInvoices.length > 0 && (
                  <span className="text-[10px] text-gray-400">
                    {sellerInvoices.length} invoice{sellerInvoices.length !== 1 ? 's' : ''} · ex-VAT: {fmt(sellerIncomeExVat)} € · VAT: {fmt(sellerIncomeVat)} €
                  </span>
                )}
              </div>

              {sellerInvoices.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm bg-white border border-gray-200 rounded-lg">
                  <div className="font-medium mb-1">No invoices for {selectedYear}</div>
                  <div className="text-xs">Create an invoice from the <a href="/" className="text-blue-600 hover:underline">New Invoice</a> page and select this worker as seller.</div>
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Invoice #</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Account Holder</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Date</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-gray-500">Wolt Gross</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-gray-600">Your Share</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-purple-700">Your Income (ex-VAT)</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-orange-600">VAT €</th>
                        <th className="w-10 px-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sellerInvoices.map((inv, idx) => {
                        const gross  = r2(inv.lineItems.reduce((s, li) => s + li.earnedAmount, 0))
                        const shItems = inv.lineItems.filter(li => li.sharePercent < 100)
                        const shGross = r2(shItems.reduce((s, li) => s + li.earnedAmount, 0))
                        const avgSh  = shGross > 0
                          ? Math.round(shItems.reduce((s, li) => s + li.sharePercent * li.earnedAmount, 0) / shGross)
                          : Math.round(inv.lineItems[0]?.sharePercent ?? 0)
                        return (
                          <tr key={inv.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-4 py-2.5 font-mono text-gray-500 text-[11px]">{inv.invoiceNumber}</td>
                            <td className="px-4 py-2.5 font-medium text-gray-800">{inv.buyerName}</td>
                            <td className="px-4 py-2.5 text-gray-400">{fmtDate(inv.invoiceDate)}</td>
                            <td className="px-4 py-2.5 text-right font-mono text-gray-400">{fmt(gross)}</td>
                            <td className="px-4 py-2.5 text-right">
                              <span className="bg-purple-100 text-purple-700 font-semibold px-1.5 py-0.5 rounded text-[10px]">{avgSh}%</span>
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono font-bold text-purple-700">{fmt(inv.totalExVat)}</td>
                            <td className="px-4 py-2.5 text-right font-mono text-orange-600">{fmt(inv.totalVat)}</td>
                            <td className="px-2 py-2.5 text-center">
                              <a href={`/api/invoice/${inv.id}/pdf`} target="_blank" className="text-blue-500 hover:text-blue-700 text-[10px]">PDF</a>
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
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <button onClick={() => setExpandWorkerInvoices((v) => !v)}
                    className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <div className="text-xs font-bold text-gray-700">Worker Payments</div>
                        <span className="text-[10px] bg-orange-100 text-orange-600 font-semibold px-1.5 py-0.5 rounded">auto-linked</span>
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        {linkedInvoices.length > 0
                          ? `${linkedInvoices.length} invoice${linkedInvoices.length !== 1 ? 's' : ''} · Ex-VAT: ${fmt(workerCostExVat)} € · Input VAT: ${fmt(workerCostVat)} €`
                          : `No substitute worker invoices for ${selectedYear}`}
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 ml-4">{expandWorkerInvoices ? '▲' : '▼'}</span>
                  </button>

                  {expandWorkerInvoices && linkedInvoices.length > 0 && (
                    <div className="border-t border-gray-100">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left px-4 py-2 font-semibold text-gray-600">Invoice #</th>
                            <th className="text-left px-4 py-2 font-semibold text-gray-600">Worker</th>
                            <th className="text-left px-4 py-2 font-semibold text-gray-600">Date</th>
                            <th className="text-right px-4 py-2 font-semibold text-gray-600">Wolt Gross</th>
                            <th className="text-right px-4 py-2 font-semibold text-gray-600">Share %</th>
                            <th className="text-right px-4 py-2 font-semibold text-orange-600">Ex-VAT €</th>
                            <th className="text-right px-4 py-2 font-semibold text-orange-600">VAT €</th>
                            <th className="text-right px-4 py-2 font-semibold text-orange-600">Total €</th>
                          </tr>
                        </thead>
                        <tbody>
                          {linkedInvoices.map((inv, idx) => {
                            const gross = r2(inv.lineItems.reduce((s, li) => s + li.earnedAmount, 0))
                            const shItems = inv.lineItems.filter(li => li.sharePercent < 100)
                            const shGross = r2(shItems.reduce((s, li) => s + li.earnedAmount, 0))
                            const avgSh = shGross > 0
                              ? Math.round(shItems.reduce((s, li) => s + li.sharePercent * li.earnedAmount, 0) / shGross)
                              : Math.round(inv.lineItems[0]?.sharePercent ?? 0)
                            return (
                              <tr key={inv.id} className={`border-t border-gray-100 ${idx % 2 !== 0 ? 'bg-gray-50' : ''}`}>
                                <td className="px-4 py-2 font-mono text-[11px] text-gray-500">
                                  <a href={`/api/invoice/${inv.id}/pdf`} target="_blank" className="text-blue-600 hover:underline">{inv.invoiceNumber}</a>
                                </td>
                                <td className="px-4 py-2 font-medium text-gray-800">{inv.sellerName}</td>
                                <td className="px-4 py-2 text-gray-400">{fmtDate(inv.invoiceDate)}</td>
                                <td className="px-4 py-2 text-right font-mono text-gray-500">{fmt(gross)}</td>
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
                            <td className="px-4 py-2 text-right font-bold font-mono text-orange-700">{fmt(r2(workerCostExVat + workerCostVat))}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                  {expandWorkerInvoices && linkedInvoices.length === 0 && (
                    <div className="px-5 py-4 text-xs text-gray-400 border-t border-gray-100">
                      No substitute worker invoices for {selectedYear}.
                    </div>
                  )}
                </div>
              )}

              {/* Other expenses */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-gray-700">Other Business Expenses</h3>
                    <p className="text-[10px] text-gray-400">Phone, travel, equipment, and other deductible costs.</p>
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
                        <label className="block text-[10px] font-semibold text-gray-600 mb-1">Date *</label>
                        <input type="date" value={expenseForm.date}
                          onChange={(e) => setExpenseForm((p) => ({ ...p, date: e.target.value }))}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-600 mb-1">Description *</label>
                        <input type="text" placeholder="e.g. DNA mobile plan" value={expenseForm.description}
                          onChange={(e) => setExpenseForm((p) => ({ ...p, description: e.target.value }))}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-600 mb-1">Supplier</label>
                        <input type="text" placeholder="e.g. DNA Oyj" value={expenseForm.supplier}
                          onChange={(e) => setExpenseForm((p) => ({ ...p, supplier: e.target.value }))}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-600 mb-1">Category *</label>
                        <select value={expenseForm.category}
                          onChange={(e) => setExpenseForm((p) => ({ ...p, category: e.target.value }))}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs bg-white">
                          {EXPENSE_CATEGORIES.map((c) => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-3 mb-3">
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-600 mb-1">Amount ex-VAT (€) *</label>
                        <input type="number" step="0.01" min="0" placeholder="0.00" value={expenseForm.amountExVat}
                          onChange={(e) => setExpenseForm((p) => ({ ...p, amountExVat: e.target.value }))}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-600 mb-1">VAT Rate %</label>
                        <select value={expenseForm.vatRate}
                          onChange={(e) => setExpenseForm((p) => ({ ...p, vatRate: e.target.value }))}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs bg-white">
                          <option value="25.5">25.5%</option>
                          <option value="14">14%</option>
                          <option value="10">10%</option>
                          <option value="0">0%</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-600 mb-1">Receipt / Invoice Ref</label>
                        <input type="text" placeholder="Receipt #" value={expenseForm.receiptRef}
                          onChange={(e) => setExpenseForm((p) => ({ ...p, receiptRef: e.target.value }))}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-600 mb-1">Notes</label>
                        <input type="text" placeholder="Optional notes" value={expenseForm.notes}
                          onChange={(e) => setExpenseForm((p) => ({ ...p, notes: e.target.value }))}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs" />
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
                  <div className="text-center py-10 text-gray-400 text-sm bg-white border border-gray-200 rounded-lg">
                    No expenses recorded for {selectedYear} yet.
                  </div>
                ) : (
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Date</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Description</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Supplier</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Category</th>
                          <th className="text-right px-4 py-2.5 font-semibold text-gray-600">Ex-VAT €</th>
                          <th className="text-right px-4 py-2.5 font-semibold text-gray-600">VAT %</th>
                          <th className="text-right px-4 py-2.5 font-semibold text-gray-600">VAT €</th>
                          <th className="text-right px-4 py-2.5 font-semibold text-gray-600">Total €</th>
                          <th className="w-8 px-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {expenses.map((exp, idx) => (
                          <tr key={exp.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-4 py-2.5 text-gray-500">{fmtDate(exp.date)}</td>
                            <td className="px-4 py-2.5 text-gray-800">
                              {exp.description}
                              {exp.receiptRef && <div className="text-[10px] text-gray-400">Ref: {exp.receiptRef}</div>}
                            </td>
                            <td className="px-4 py-2.5 text-gray-500">{exp.supplier || '—'}</td>
                            <td className="px-4 py-2.5">
                              <span className="bg-gray-100 text-gray-600 text-[10px] px-1.5 py-0.5 rounded">
                                {CAT_LABEL[exp.category] ?? exp.category}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono">{fmt(exp.amountExVat)}</td>
                            <td className="px-4 py-2.5 text-right text-gray-500">{exp.vatRate}%</td>
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
              <div className="mb-4">
                <h3 className="text-sm font-bold text-gray-700 mb-1">Quarterly VAT Summary — {selectedYear}</h3>
                <p className="text-[10px] text-gray-400">File quarterly via OmaVero. Q1 Jan–Mar · Q2 Apr–Jun · Q3 Jul–Sep · Q4 Oct–Dec</p>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-5">
                {isAccountHolder ? (
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Quarter</th>
                        <th className="text-right px-3 py-3 font-semibold text-green-700">
                          Output VAT<br/><span className="text-[10px] font-normal text-gray-400">Own income</span>
                        </th>
                        {linkedInvoices.length > 0 && (
                          <th className="text-right px-3 py-3 font-semibold text-indigo-600">
                            Output VAT<br/><span className="text-[10px] font-normal text-gray-400">Sub periods</span>
                          </th>
                        )}
                        {bookkeeperInvoices.length > 0 && (
                          <th className="text-right px-3 py-3 font-semibold text-teal-700">
                            Output VAT<br/><span className="text-[10px] font-normal text-gray-400">BK services</span>
                          </th>
                        )}
                        <th className="text-right px-3 py-3 font-semibold text-green-800">
                          Total Output<br/><span className="text-[10px] font-normal text-gray-400">to remit</span>
                        </th>
                        {linkedInvoices.length > 0 && (
                          <th className="text-right px-3 py-3 font-semibold text-orange-600">
                            Input VAT<br/><span className="text-[10px] font-normal text-gray-400">Worker inv.</span>
                          </th>
                        )}
                        <th className="text-right px-3 py-3 font-semibold text-red-600">
                          Input VAT<br/><span className="text-[10px] font-normal text-gray-400">Expenses</span>
                        </th>
                        <th className="text-right px-3 py-3 font-semibold text-blue-700">
                          Net<br/><span className="text-[10px] font-normal text-gray-400">payable</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[1, 2, 3, 4].map((q) => {
                        const d = quarterData(q)
                        const labels = ['Jan–Mar', 'Apr–Jun', 'Jul–Sep', 'Oct–Dec']
                        const active = d.outVat !== 0 || d.inVatW !== 0 || d.inVatE !== 0
                        return (
                          <tr key={q} className={`border-t border-gray-100 ${!active ? 'opacity-40' : ''}`}>
                            <td className="px-4 py-3 font-semibold">Q{q} <span className="font-normal text-gray-500">{labels[q-1]}</span></td>
                            <td className="px-3 py-3 text-right font-mono text-green-700">{fmt(d.outVatOwn)}</td>
                            {linkedInvoices.length > 0 && <td className="px-3 py-3 text-right font-mono text-indigo-600">{fmt(d.outVatSubs)}</td>}
                            {bookkeeperInvoices.length > 0 && <td className="px-3 py-3 text-right font-mono text-teal-700">{fmt(d.outVatBk)}</td>}
                            <td className="px-3 py-3 text-right font-mono font-bold text-green-800">{fmt(d.outVat)}</td>
                            {linkedInvoices.length > 0 && <td className="px-3 py-3 text-right font-mono text-orange-600">{fmt(d.inVatW)}</td>}
                            <td className="px-3 py-3 text-right font-mono text-red-600">{fmt(d.inVatE)}</td>
                            <td className={`px-3 py-3 text-right font-mono font-bold ${d.net >= 0 ? 'text-blue-700' : 'text-green-600'}`}>{fmt(d.net)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot className="border-t-2 border-gray-300 bg-gray-50">
                      <tr>
                        <td className="px-4 py-3 font-bold text-gray-700">Annual Total</td>
                        <td className="px-3 py-3 text-right font-bold font-mono text-green-700">{fmt(totalIncomeVat)}</td>
                        {linkedInvoices.length > 0 && <td className="px-3 py-3 text-right font-bold font-mono text-indigo-600">{fmt(woltOutputVatFromSubs)}</td>}
                        {bookkeeperInvoices.length > 0 && <td className="px-3 py-3 text-right font-bold font-mono text-teal-700">{fmt(bkIncomeVat)}</td>}
                        <td className="px-3 py-3 text-right font-bold font-mono text-green-800">{fmt(filingOutputVat)}</td>
                        {linkedInvoices.length > 0 && <td className="px-3 py-3 text-right font-bold font-mono text-orange-600">{fmt(workerCostVat)}</td>}
                        <td className="px-3 py-3 text-right font-bold font-mono text-red-600">{fmt(otherExpVat)}</td>
                        <td className={`px-3 py-3 text-right font-bold font-mono text-lg ${netVatPayable >= 0 ? 'text-blue-700' : 'text-green-600'}`}>{fmt(netVatPayable)}</td>
                      </tr>
                    </tfoot>
                  </table>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Quarter</th>
                        <th className="text-right px-3 py-3 font-semibold text-purple-700">Output VAT<br/><span className="text-[10px] font-normal text-gray-400">Your invoices</span></th>
                        <th className="text-right px-3 py-3 font-semibold text-red-600">Input VAT<br/><span className="text-[10px] font-normal text-gray-400">Expenses</span></th>
                        <th className="text-right px-3 py-3 font-semibold text-blue-700">Net<br/><span className="text-[10px] font-normal text-gray-400">payable</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {[1, 2, 3, 4].map((q) => {
                        const d = quarterData(q)
                        const labels = ['Jan–Mar', 'Apr–Jun', 'Jul–Sep', 'Oct–Dec']
                        const active = d.outVat !== 0 || d.inVatE !== 0
                        return (
                          <tr key={q} className={`border-t border-gray-100 ${!active ? 'opacity-40' : ''}`}>
                            <td className="px-4 py-3 font-semibold">Q{q} <span className="font-normal text-gray-500">{labels[q-1]}</span></td>
                            <td className="px-3 py-3 text-right font-mono text-purple-700">{fmt(d.outVat)}</td>
                            <td className="px-3 py-3 text-right font-mono text-red-600">{fmt(d.inVatE)}</td>
                            <td className={`px-3 py-3 text-right font-mono font-bold ${d.net >= 0 ? 'text-blue-700' : 'text-green-600'}`}>{fmt(d.net)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot className="border-t-2 border-gray-300 bg-gray-50">
                      <tr>
                        <td className="px-4 py-3 font-bold text-gray-700">Annual Total</td>
                        <td className="px-3 py-3 text-right font-bold font-mono text-purple-700">{fmt(sellerIncomeVat)}</td>
                        <td className="px-3 py-3 text-right font-bold font-mono text-red-600">{fmt(otherExpVat)}</td>
                        <td className={`px-3 py-3 text-right font-bold font-mono text-lg ${netVatPayable >= 0 ? 'text-blue-700' : 'text-green-600'}`}>{fmt(netVatPayable)}</td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-xs text-blue-700">
                <strong>How to file:</strong> OmaVero → Arvonlisävero → Ilmoita ALV.
                {isAccountHolder
                  ? <> Output VAT <strong>{fmt(filingOutputVat)} €</strong> → <em>Vero kotimaan myynneistä</em>. Input VAT <strong>{fmt(filingInputVat)} €</strong> → <em>Vähennettävä vero</em>.</>
                  : <> Output VAT <strong>{fmt(sellerIncomeVat)} €</strong> → <em>Vero kotimaan myynneistä</em>{otherExpVat > 0 ? <>, input VAT <strong>{fmt(otherExpVat)} €</strong> → <em>Vähennettävä vero</em></> : ''}</>}
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
                <h3 className="text-sm font-bold text-gray-700 mb-1">Annual Income Tax Reference — {selectedYear}</h3>
                <p className="text-[10px] text-gray-400">Elinkeinotoiminnan veroilmoitus (Form 5/6) · sole trader reference figures for OmaVero.</p>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100 overflow-hidden">

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
                            <div className="text-xs font-bold text-gray-700">
                              Liikevaihto — {linkedInvoices.length > 0 ? 'Own Delivery Periods' : 'Wolt Income Periods'}
                            </div>
                            <div className="text-[10px] text-gray-400 mt-0.5">{incomes.length} period{incomes.length !== 1 ? 's' : ''}</div>
                          </div>
                          <div className="text-sm font-bold text-green-700 font-mono shrink-0">{fmt(totalIncomeExVat)} €</div>
                        </div>
                      </div>
                    ) : linkedInvoices.length === 0 && (
                      <div className="px-5 py-4 text-xs text-gray-400 italic">No income recorded for {selectedYear}.</div>
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
                        <div className="text-xs font-semibold text-gray-700">− {cat.label}</div>
                        <div className="text-[10px] text-gray-400">{cat.rows.length} entr{cat.rows.length !== 1 ? 'ies' : 'y'}</div>
                      </div>
                      <div className="text-sm font-semibold text-red-700 font-mono">− {fmt(cat.total)} €</div>
                    </div>
                  </div>
                ))}

                {otherExpExVat === 0 && (
                  <div className="px-5 py-3 text-[10px] text-gray-400 italic">
                    No other expenses — add them in the Expenses tab.
                  </div>
                )}

                <div className="px-5 py-4 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-bold text-gray-700">= Verotettava tulos / Taxable profit</div>
                    <div className={`text-xl font-bold font-mono ${netProfit >= 0 ? 'text-blue-700' : 'text-red-600'}`}>{fmt(netProfit)} €</div>
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1 font-mono">
                    {fmt(incomeExVat)} − {fmt(otherExpExVat)} = {fmt(netProfit)} €
                  </div>
                </div>
              </div>

              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4 text-xs text-blue-700">
                <strong>How to file:</strong> OmaVero → Veroilmoitus → Elinkeinotoiminnan veroilmoitus.
                Revenue (<strong>{fmt(incomeExVat)} €</strong>) → <em>Liikevaihto</em>.
                {otherExpExVat > 0 && <> Expenses (<strong>{fmt(otherExpExVat)} €</strong>) → respective categories.</>}
                {' '}Taxable profit = <strong>{fmt(netProfit)} €</strong>.
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
