'use client'

import { useState, useTransition } from 'react'
import { deleteInvoice } from '@/actions/invoice'

// ─── Types ────────────────────────────────────────────────────────────────────

type LineItem = {
  id: string
  description: string
  earnedAmount: number
  sharePercent: number
  vatRate: number
  amountExVat: number
  vatAmount: number
  totalAmount: number
}

type Invoice = {
  id: string
  invoiceNumber: string
  invoiceDate: Date
  dueDate: Date
  periodStart: Date
  periodEnd: Date
  sellerName: string
  sellerBusinessId: string
  buyerName: string
  totalExVat: number
  totalVat: number
  totalIncVat: number
  clientId: number | null
  client: { id: number; displayId: string; name: string } | null
  lineItems: LineItem[]
  notes: string | null
}

type Props = {
  invoices: Invoice[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString('fi-FI', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function fmt(n: number) { return n.toFixed(2) }

function round2(n: number) { return Math.round(n * 100) / 100 }

// ─── Component ────────────────────────────────────────────────────────────────

export default function InvoiceHistoryApp({ invoices: initial }: Props) {
  const [invoices, setInvoices] = useState<Invoice[]>(initial)
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear())
  const [expandedWorker, setExpandedWorker] = useState<string | null>(null)
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Available years from invoice data
  const years = Array.from(
    new Set(invoices.map((inv) => new Date(inv.invoiceDate).getFullYear()))
  ).sort((a, b) => b - a)
  if (!years.includes(new Date().getFullYear())) years.unshift(new Date().getFullYear())

  // Filter by selected year
  const yearInvoices = invoices.filter(
    (inv) => new Date(inv.invoiceDate).getFullYear() === selectedYear
  )

  // ── Group by worker (seller) ──────────────────────────────────────────────
  const workerMap = new Map<string, { name: string; businessId: string; clientId: number | null; displayId: string | null; invoices: Invoice[] }>()

  for (const inv of yearInvoices) {
    const key = inv.sellerName
    if (!workerMap.has(key)) {
      workerMap.set(key, {
        name: inv.sellerName,
        businessId: inv.sellerBusinessId,
        clientId: inv.clientId,
        displayId: inv.client?.displayId ?? null,
        invoices: [],
      })
    }
    workerMap.get(key)!.invoices.push(inv)
  }
  const workers = Array.from(workerMap.values()).sort((a, b) => a.name.localeCompare(b.name))

  // ── VAT summary for selected year ─────────────────────────────────────────
  const vatMap = new Map<number, { base: number; vat: number }>()
  for (const inv of yearInvoices) {
    for (const item of inv.lineItems) {
      const e = vatMap.get(item.vatRate) ?? { base: 0, vat: 0 }
      vatMap.set(item.vatRate, {
        base: round2(e.base + item.amountExVat),
        vat: round2(e.vat + item.vatAmount),
      })
    }
  }
  const vatBreakdown = Array.from(vatMap.entries())
    .map(([rate, { base, vat }]) => ({ rate, base, vat }))
    .sort((a, b) => b.rate - a.rate)

  const grandTotalExVat = round2(yearInvoices.reduce((s, inv) => s + inv.totalExVat, 0))
  const grandTotalVat = round2(yearInvoices.reduce((s, inv) => s + inv.totalVat, 0))
  const grandTotal = round2(yearInvoices.reduce((s, inv) => s + inv.totalIncVat, 0))

  // ── Per worker totals ─────────────────────────────────────────────────────
  function workerTotals(invs: Invoice[]) {
    const grossTotal = round2(invs.reduce((s, i) => s + i.lineItems.reduce((ls, li) => ls + li.earnedAmount * (li.sharePercent / 100), 0), 0))
    const exVat = round2(invs.reduce((s, i) => s + i.totalExVat, 0))
    const vat = round2(invs.reduce((s, i) => s + i.totalVat, 0))
    const total = round2(invs.reduce((s, i) => s + i.totalIncVat, 0))
    return { grossTotal, exVat, vat, total }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  function handleDelete(inv: Invoice) {
    if (!confirm(`Delete invoice ${inv.invoiceNumber}? This cannot be undone.`)) return
    startTransition(async () => {
      await deleteInvoice(inv.id)
      setInvoices((prev) => prev.filter((i) => i.id !== inv.id))
    })
  }

  // ── Quarterly VAT breakdown ───────────────────────────────────────────────
  const quarters = [1, 2, 3, 4]
  function quarterInvoices(q: number) {
    return yearInvoices.filter((inv) => {
      const m = new Date(inv.invoiceDate).getMonth() // 0-indexed
      return Math.floor(m / 3) + 1 === q
    })
  }
  function quarterVat(q: number) {
    const qInvs = quarterInvoices(q)
    const base = round2(qInvs.reduce((s, inv) => s + inv.totalExVat, 0))
    const vat = round2(qInvs.reduce((s, inv) => s + inv.totalVat, 0))
    const total = round2(qInvs.reduce((s, inv) => s + inv.totalIncVat, 0))
    return { base, vat, total, count: qInvs.length }
  }

  return (
    <div className="p-5 max-w-6xl mx-auto">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-bold">Invoice History</h1>
          <p className="text-xs text-gray-400 mt-0.5">Per-worker breakdown · VAT filing · Income tax reference</p>
        </div>
        <a
          href="/"
          className="bg-blue-700 text-white text-xs px-4 py-2 rounded font-semibold hover:bg-blue-800"
        >
          + New Invoice
        </a>
      </div>

      {/* ── Year selector ── */}
      <div className="flex gap-2 mb-5">
        {years.map((yr) => (
          <button
            key={yr}
            onClick={() => setSelectedYear(yr)}
            className={`px-3 py-1 rounded text-xs font-semibold border transition-colors ${
              yr === selectedYear
                ? 'bg-blue-700 text-white border-blue-700'
                : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
            }`}
          >
            {yr}
          </button>
        ))}
      </div>

      {yearInvoices.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          No invoices for {selectedYear} yet.{' '}
          <a href="/" className="text-blue-600 hover:underline">Create one →</a>
        </div>
      ) : (
        <>
          {/* ══ Section 1: VAT Filing Summary ══════════════════════════════════ */}
          <div className="mb-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-amber-700 mb-3">
              VAT Filing Summary — {selectedYear}
            </h2>
            <div className="grid grid-cols-2 gap-4 mb-4 lg:grid-cols-4">
              {/* Annual totals */}
              <div className="bg-amber-50 border border-amber-200 rounded p-3">
                <div className="text-[10px] text-amber-700 font-semibold uppercase tracking-wide mb-2">Annual Totals</div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-gray-500">Turnover excl. VAT:</span><span className="font-bold">{fmt(grandTotalExVat)} €</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Total VAT collected:</span><span className="font-bold text-amber-700">{fmt(grandTotalVat)} €</span></div>
                  <div className="flex justify-between border-t border-amber-200 pt-1"><span className="text-gray-500">Total incl. VAT:</span><span className="font-bold">{fmt(grandTotal)} €</span></div>
                  <div className="flex justify-between text-gray-400"><span>Invoice count:</span><span>{yearInvoices.length}</span></div>
                </div>
              </div>
              {/* Per VAT rate */}
              {vatBreakdown.map((vb) => (
                <div key={vb.rate} className="bg-white border border-gray-200 rounded p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-2">
                    {vb.rate === 0 ? 'Zero-rated (0% VAT)' : `VAT ${fmt(vb.rate)}% Rate`}
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-gray-500">Tax base (veroton):</span><span className="font-bold">{fmt(vb.base)} €</span></div>
                    {vb.rate > 0 && (
                      <div className="flex justify-between"><span className="text-gray-500">VAT to remit:</span><span className="font-bold text-blue-700">{fmt(vb.vat)} €</span></div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Quarterly breakdown */}
            <div className="bg-white border border-gray-200 rounded overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-200 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                Quarterly Breakdown (for VAT period filing)
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-[10px] text-gray-400">
                    <th className="text-left px-3 py-2 font-medium">Quarter</th>
                    <th className="text-right px-3 py-2 font-medium">Invoices</th>
                    <th className="text-right px-3 py-2 font-medium">Excl. VAT</th>
                    <th className="text-right px-3 py-2 font-medium">VAT collected</th>
                    <th className="text-right px-3 py-2 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {quarters.map((q) => {
                    const { base, vat, total, count } = quarterVat(q)
                    const months = ['Jan–Mar', 'Apr–Jun', 'Jul–Sep', 'Oct–Dec'][q - 1]
                    return (
                      <tr key={q} className={`border-b border-gray-50 ${count === 0 ? 'text-gray-300' : ''}`}>
                        <td className="px-3 py-2 font-medium">Q{q} <span className="text-gray-400 font-normal">({months})</span></td>
                        <td className="px-3 py-2 text-right">{count}</td>
                        <td className="px-3 py-2 text-right font-mono">{count > 0 ? `${fmt(base)} €` : '—'}</td>
                        <td className="px-3 py-2 text-right font-mono text-amber-700">{count > 0 ? `${fmt(vat)} €` : '—'}</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold">{count > 0 ? `${fmt(total)} €` : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                    <td className="px-3 py-2">Annual Total</td>
                    <td className="px-3 py-2 text-right">{yearInvoices.length}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(grandTotalExVat)} €</td>
                    <td className="px-3 py-2 text-right font-mono text-amber-700">{fmt(grandTotalVat)} €</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(grandTotal)} €</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ══ Section 2: Per-Worker Breakdown ════════════════════════════════ */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-purple-700 mb-3">
              Per Substitute Worker — {selectedYear}
            </h2>
            <div className="space-y-3">
              {workers.map((worker) => {
                const totals = workerTotals(worker.invoices)
                const workerKey = worker.name
                const isOpen = expandedWorker === workerKey

                return (
                  <div key={workerKey} className="bg-white border border-gray-200 rounded overflow-hidden">
                    {/* Worker header — click to expand */}
                    <button
                      type="button"
                      onClick={() => setExpandedWorker(isOpen ? null : workerKey)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-gray-800">{worker.name}</span>
                        {worker.displayId && (
                          <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-mono">
                            ID {worker.displayId}
                          </span>
                        )}
                        {worker.businessId && (
                          <span className="text-[10px] text-gray-400">Y-tunnus: {worker.businessId}</span>
                        )}
                        <span className="text-[10px] text-gray-400">{worker.invoices.length} invoice{worker.invoices.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right hidden sm:block">
                          <div className="text-[10px] text-gray-400">Excl. VAT</div>
                          <div className="text-xs font-mono font-semibold">{fmt(totals.exVat)} €</div>
                        </div>
                        <div className="text-right hidden sm:block">
                          <div className="text-[10px] text-gray-400">VAT</div>
                          <div className="text-xs font-mono text-amber-700">{fmt(totals.vat)} €</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-gray-400">Total incl. VAT</div>
                          <div className="text-sm font-bold text-blue-700">{fmt(totals.total)} €</div>
                        </div>
                        <span className="text-gray-400 text-xs">{isOpen ? '▲' : '▼'}</span>
                      </div>
                    </button>

                    {/* Expanded: invoices table */}
                    {isOpen && (
                      <div className="border-t border-gray-100">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-200 text-[10px] text-gray-400 uppercase tracking-wide">
                              <th className="text-left px-3 py-2 font-medium">Invoice #</th>
                              <th className="text-left px-3 py-2 font-medium">Date</th>
                              <th className="text-left px-3 py-2 font-medium">Period</th>
                              <th className="text-left px-3 py-2 font-medium">Buyer</th>
                              <th className="text-right px-3 py-2 font-medium">Excl. VAT</th>
                              <th className="text-right px-3 py-2 font-medium">VAT</th>
                              <th className="text-right px-3 py-2 font-medium">Total</th>
                              <th className="text-center px-3 py-2 font-medium">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {worker.invoices.map((inv) => {
                              const rowOpen = expandedInvoice === inv.id
                              return (
                                <>
                                  <tr
                                    key={inv.id}
                                    className="border-b border-gray-100 hover:bg-blue-50 cursor-pointer"
                                    onClick={() => setExpandedInvoice(rowOpen ? null : inv.id)}
                                  >
                                    <td className="px-3 py-2 font-mono font-semibold text-blue-700">{inv.invoiceNumber}</td>
                                    <td className="px-3 py-2 text-gray-600">{fmtDate(inv.invoiceDate)}</td>
                                    <td className="px-3 py-2 text-gray-400 text-[10px]">
                                      {fmtDate(inv.periodStart)} – {fmtDate(inv.periodEnd)}
                                    </td>
                                    <td className="px-3 py-2">{inv.buyerName}</td>
                                    <td className="px-3 py-2 text-right font-mono">{fmt(inv.totalExVat)} €</td>
                                    <td className="px-3 py-2 text-right font-mono text-amber-700">{fmt(inv.totalVat)} €</td>
                                    <td className="px-3 py-2 text-right font-mono font-semibold">{fmt(inv.totalIncVat)} €</td>
                                    <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                                      <div className="flex gap-2 justify-center">
                                        <a
                                          href={`/api/invoice/${inv.id}/pdf`}
                                          target="_blank"
                                          className="text-blue-600 hover:underline"
                                        >
                                          PDF
                                        </a>
                                        <button
                                          type="button"
                                          disabled={isPending}
                                          onClick={() => handleDelete(inv)}
                                          className="text-red-500 hover:underline disabled:opacity-40"
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    </td>
                                  </tr>

                                  {/* Expanded line items */}
                                  {rowOpen && (
                                    <tr key={`${inv.id}-detail`} className="bg-blue-50">
                                      <td colSpan={8} className="px-5 py-3">
                                        <div className="text-[10px] font-bold uppercase tracking-wide text-blue-600 mb-2">Line Items</div>
                                        <table className="w-full text-[10px]">
                                          <thead>
                                            <tr className="text-gray-400 border-b border-blue-100">
                                              <th className="text-left pb-1 font-medium">Description</th>
                                              <th className="text-right pb-1 font-medium">Gross (Wolt)</th>
                                              <th className="text-right pb-1 font-medium">Share %</th>
                                              <th className="text-right pb-1 font-medium">Excl. VAT</th>
                                              <th className="text-right pb-1 font-medium">VAT %</th>
                                              <th className="text-right pb-1 font-medium">VAT €</th>
                                              <th className="text-right pb-1 font-medium">Total</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {inv.lineItems.map((li) => (
                                              <tr key={li.id} className="border-b border-blue-50">
                                                <td className="py-1">{li.description}</td>
                                                <td className="py-1 text-right font-mono">{fmt(li.earnedAmount)} €</td>
                                                <td className="py-1 text-right">{li.sharePercent}%</td>
                                                <td className="py-1 text-right font-mono">{fmt(li.amountExVat)} €</td>
                                                <td className="py-1 text-right">{li.vatRate}%</td>
                                                <td className="py-1 text-right font-mono text-amber-700">{fmt(li.vatAmount)} €</td>
                                                <td className="py-1 text-right font-mono font-semibold">{fmt(li.totalAmount)} €</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                        {inv.notes && (
                                          <div className="mt-2 text-gray-500 italic">Notes: {inv.notes}</div>
                                        )}
                                      </td>
                                    </tr>
                                  )}
                                </>
                              )
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold text-xs">
                              <td colSpan={4} className="px-3 py-2 text-gray-600">Worker Total</td>
                              <td className="px-3 py-2 text-right font-mono">{fmt(totals.exVat)} €</td>
                              <td className="px-3 py-2 text-right font-mono text-amber-700">{fmt(totals.vat)} €</td>
                              <td className="px-3 py-2 text-right font-mono">{fmt(totals.total)} €</td>
                              <td />
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
