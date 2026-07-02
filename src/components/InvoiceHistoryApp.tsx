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
  buyerClientId: number | null
  buyerClient: { id: number; displayId: string; name: string } | null
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
  const [viewMode, setViewMode] = useState<'worker' | 'owner'>('worker')
  const [expandedWorker, setExpandedWorker] = useState<string | null>(null)
  const [expandedOwner, setExpandedOwner] = useState<string | null>(null)
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

      {/* ── Year + view mode selectors ── */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex gap-2">
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
        <div className="flex gap-1 bg-gray-100 rounded p-0.5">
          {(['worker', 'owner'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                viewMode === mode ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {mode === 'worker' ? 'By Substitute Worker' : 'By Account Holder'}
            </button>
          ))}
        </div>
      </div>

      {yearInvoices.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          No invoices for {selectedYear} yet.{' '}
          <a href="/" className="text-blue-600 hover:underline">Create one →</a>
        </div>
      ) : viewMode === 'worker' ? (
        <>
          {/* ══ Per-Worker Breakdown ═══════════════════════════════════════════ */}
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

                    {/* Expanded: VAT summary + invoices table */}
                    {isOpen && (
                      <div className="border-t border-gray-100">
                        {/* Per-worker VAT Filing Summary */}
                        {(() => {
                          const wVatMap = new Map<number, { base: number; vat: number }>()
                          for (const inv of worker.invoices) {
                            for (const item of inv.lineItems) {
                              const e = wVatMap.get(item.vatRate) ?? { base: 0, vat: 0 }
                              wVatMap.set(item.vatRate, {
                                base: round2(e.base + item.amountExVat),
                                vat: round2(e.vat + item.vatAmount),
                              })
                            }
                          }
                          const wVatBreakdown = Array.from(wVatMap.entries())
                            .map(([rate, { base, vat }]) => ({ rate, base, vat }))
                            .sort((a, b) => b.rate - a.rate)
                          const wQuarters = [1, 2, 3, 4].map(q => {
                            const qInvs = worker.invoices.filter(inv => Math.floor(new Date(inv.invoiceDate).getMonth() / 3) + 1 === q)
                            return {
                              q,
                              base: round2(qInvs.reduce((s, inv) => s + inv.totalExVat, 0)),
                              vat: round2(qInvs.reduce((s, inv) => s + inv.totalVat, 0)),
                              total: round2(qInvs.reduce((s, inv) => s + inv.totalIncVat, 0)),
                              count: qInvs.length,
                            }
                          })
                          return (
                            <div className="px-4 py-4 border-b border-gray-200 bg-amber-50/30">
                              <div className="text-[10px] font-bold uppercase tracking-widest text-amber-700 mb-3">
                                VAT Filing Summary — {selectedYear}
                              </div>
                              <div className="grid grid-cols-2 gap-3 mb-3 lg:grid-cols-4">
                                <div className="bg-white border border-amber-200 rounded p-3">
                                  <div className="text-[10px] text-amber-700 font-semibold uppercase tracking-wide mb-2">Annual Totals</div>
                                  <div className="space-y-1 text-xs">
                                    <div className="flex justify-between"><span className="text-gray-500">Excl. VAT:</span><span className="font-bold">{fmt(totals.exVat)} €</span></div>
                                    <div className="flex justify-between"><span className="text-gray-500">VAT collected:</span><span className="font-bold text-amber-700">{fmt(totals.vat)} €</span></div>
                                    <div className="flex justify-between border-t border-amber-200 pt-1"><span className="text-gray-500">Incl. VAT:</span><span className="font-bold">{fmt(totals.total)} €</span></div>
                                    <div className="flex justify-between text-gray-400"><span>Invoices:</span><span>{worker.invoices.length}</span></div>
                                  </div>
                                </div>
                                {wVatBreakdown.map((vb) => (
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
                              <div className="bg-white border border-gray-200 rounded overflow-hidden">
                                <div className="bg-gray-50 border-b border-gray-200 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                                  Quarterly Breakdown
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
                                    {wQuarters.map(({ q, base, vat, total, count }) => {
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
                                      <td className="px-3 py-2 text-right">{worker.invoices.length}</td>
                                      <td className="px-3 py-2 text-right font-mono">{fmt(totals.exVat)} €</td>
                                      <td className="px-3 py-2 text-right font-mono text-amber-700">{fmt(totals.vat)} €</td>
                                      <td className="px-3 py-2 text-right font-mono">{fmt(totals.total)} €</td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            </div>
                          )
                        })()}
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
                                        <a
                                          href={`/?edit=${inv.id}`}
                                          className="text-amber-600 hover:underline"
                                        >
                                          Edit
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
      ) : (
        /* ══ BY OWNER VIEW ══════════════════════════════════════════════════ */
        (() => {
          // Group invoices by account holder (buyerClientId → buyerClient, or buyerName fallback)
          const ownerMap = new Map<string, {
            key: string
            name: string
            clientId: number | null
            displayId: string | null
            invoices: Invoice[]
          }>()
          for (const inv of yearInvoices) {
            const key = inv.buyerClientId ? String(inv.buyerClientId) : `name:${inv.buyerName}`
            if (!ownerMap.has(key)) {
              ownerMap.set(key, {
                key,
                name: inv.buyerClient?.name ?? inv.buyerName,
                clientId: inv.buyerClientId,
                displayId: inv.buyerClient?.displayId ?? null,
                invoices: [],
              })
            }
            ownerMap.get(key)!.invoices.push(inv)
          }
          const owners = Array.from(ownerMap.values()).sort((a, b) => a.name.localeCompare(b.name))

          function qOf(d: Date) { return Math.floor(new Date(d).getMonth() / 3) + 1 }

          return (
            <div className="space-y-8">
              <p className="text-[10px] text-gray-400 -mb-2">
                Bookkeeper view — gross Wolt income, worker costs, and exact figures to enter in OmaVero VAT return.
              </p>
              {owners.length === 0 && (
                <div className="text-center py-12 text-gray-400 text-sm">No account holder links found for {selectedYear}. Link invoices to a client using the Account Holder field when creating them.</div>
              )}
              {owners.map((owner) => {
                // ── Compute financials ───────────────────────────────────────
                // earnedAmount = gross Wolt income for that line (before splitting by sharePercent)
                // amountExVat  = earnedAmount * sharePercent/100  (worker's portion, ex-VAT)
                // vatAmount    = amountExVat * vatRate/100         (VAT the holder pays to worker)
                const allItems = owner.invoices.flatMap(i => i.lineItems)

                const woltIncomeExVat     = round2(allItems.reduce((s, li) => s + li.earnedAmount, 0))
                const outputVat           = round2(allItems.reduce((s, li) => s + li.earnedAmount * li.vatRate / 100, 0))
                const workerPaymentsExVat = round2(owner.invoices.reduce((s, i) => s + i.totalExVat, 0))
                const inputVat            = round2(owner.invoices.reduce((s, i) => s + i.totalVat, 0))
                const netVatToRemit       = round2(outputVat - inputVat)
                const holderNetIncome     = round2(woltIncomeExVat - workerPaymentsExVat)
                const totalWorkerCost     = round2(owner.invoices.reduce((s, i) => s + i.totalIncVat, 0))

                // ── Quarterly VAT breakdown ──────────────────────────────────
                const quarters = [1, 2, 3, 4].map(q => {
                  const qInvs  = owner.invoices.filter(i => qOf(i.invoiceDate) === q)
                  const qItems = qInvs.flatMap(i => i.lineItems)
                  return {
                    q,
                    wolt:      round2(qItems.reduce((s, li) => s + li.earnedAmount, 0)),
                    outVat:    round2(qItems.reduce((s, li) => s + li.earnedAmount * li.vatRate / 100, 0)),
                    workerEx:  round2(qInvs.reduce((s, i) => s + i.totalExVat, 0)),
                    inVat:     round2(qInvs.reduce((s, i) => s + i.totalVat, 0)),
                    netVat:    round2(
                      qItems.reduce((s, li) => s + li.earnedAmount * li.vatRate / 100, 0) -
                      qInvs.reduce((s, i) => s + i.totalVat, 0)
                    ),
                    count: qInvs.length,
                  }
                })

                const isOwnerOpen = expandedOwner === owner.key

                return (
                  <div key={owner.key} className="bg-white border border-gray-200 rounded overflow-hidden">

                    {/* ── Header — click to expand ────────────────────────────── */}
                    <button
                      type="button"
                      onClick={() => setExpandedOwner(isOwnerOpen ? null : owner.key)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-indigo-700 hover:bg-indigo-800 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2">
                        {owner.displayId && (
                          <span className="bg-white/20 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">{owner.displayId}</span>
                        )}
                        <span className="font-bold text-white">{owner.name}</span>
                        <span className="text-indigo-200 text-[10px]">
                          {owner.invoices.length} worker invoice{owner.invoices.length !== 1 ? 's' : ''} — {selectedYear}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                          <div className="text-[10px] text-indigo-200">Net income ex-VAT</div>
                          <div className="text-xs font-mono font-semibold text-white">{fmt(holderNetIncome)} €</div>
                        </div>
                        <div className="text-right hidden sm:block">
                          <div className="text-[10px] text-indigo-200">Net VAT</div>
                          <div className={`text-xs font-mono font-semibold ${netVatToRemit >= 0 ? 'text-red-300' : 'text-green-300'}`}>{fmt(netVatToRemit)} €</div>
                        </div>
                        {owner.clientId && (
                          <div onClick={(e) => e.stopPropagation()}>
                            <a href={`/books?client=${owner.clientId}`}
                              className="bg-white/20 hover:bg-white/30 text-white text-xs px-3 py-1.5 rounded font-semibold transition-colors">
                              Open Client Books →
                            </a>
                          </div>
                        )}
                        <span className="text-indigo-200 text-xs">{isOwnerOpen ? '▲' : '▼'}</span>
                      </div>
                    </button>

                    {isOwnerOpen && (
                    <div className="p-5 space-y-5">

                      {/* ── Financial summary + VAT filing side by side ───────── */}
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

                        {/* Income & cost breakdown */}
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                          <div className="bg-gray-50 border-b border-gray-200 px-4 py-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Income Statement</span>
                          </div>
                          <table className="w-full text-sm">
                            <tbody>
                              <tr className="border-b border-gray-100">
                                <td className="px-4 py-2.5 text-gray-600">Gross Wolt income (ex-VAT)</td>
                                <td className="px-4 py-2.5 text-right font-mono font-semibold text-gray-800">+ {fmt(woltIncomeExVat)} €</td>
                              </tr>
                              <tr className="border-b border-gray-100">
                                <td className="px-4 py-2.5 text-gray-600">Worker payments (ex-VAT)</td>
                                <td className="px-4 py-2.5 text-right font-mono text-red-600">− {fmt(workerPaymentsExVat)} €</td>
                              </tr>
                              <tr className="bg-indigo-50 border-b border-indigo-100">
                                <td className="px-4 py-2.5 font-semibold text-indigo-800">Holder net income (ex-VAT)</td>
                                <td className="px-4 py-2.5 text-right font-mono font-bold text-indigo-800">= {fmt(holderNetIncome)} €</td>
                              </tr>
                              <tr className="border-b border-gray-100 bg-gray-50">
                                <td className="px-4 py-2 text-[11px] text-gray-500">VAT billed by workers (paid out)</td>
                                <td className="px-4 py-2 text-right font-mono text-[11px] text-orange-600">− {fmt(totalWorkerCost - workerPaymentsExVat)} €</td>
                              </tr>
                              <tr>
                                <td className="px-4 py-2 text-[11px] text-gray-500">Total cash paid to workers (incl. VAT)</td>
                                <td className="px-4 py-2 text-right font-mono text-[11px] text-gray-600">{fmt(totalWorkerCost)} €</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        {/* VAT Filing Reference */}
                        <div className="border-2 border-indigo-300 rounded-lg overflow-hidden">
                          <div className="bg-indigo-600 px-4 py-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-white">OmaVero — VAT Return Entries</span>
                          </div>
                          <table className="w-full text-sm">
                            <tbody>
                              <tr className="border-b border-gray-100 bg-blue-50/50">
                                <td className="px-4 py-1.5 text-[10px] font-bold text-blue-700 uppercase tracking-wide" colSpan={2}>SALES</td>
                              </tr>
                              <tr className="border-b border-gray-100">
                                <td className="px-4 py-2 text-gray-600">Taxable sales (veroton myynti)</td>
                                <td className="px-4 py-2 text-right font-mono font-semibold text-gray-800">{fmt(woltIncomeExVat)} €</td>
                              </tr>
                              <tr className="border-b border-gray-200">
                                <td className="px-4 py-2 text-gray-600">Output VAT / vero myynneistä</td>
                                <td className="px-4 py-2 text-right font-mono font-semibold text-blue-700">{fmt(outputVat)} €</td>
                              </tr>
                              <tr className="border-b border-gray-100 bg-orange-50/50">
                                <td className="px-4 py-1.5 text-[10px] font-bold text-orange-700 uppercase tracking-wide" colSpan={2}>PURCHASES</td>
                              </tr>
                              <tr className="border-b border-gray-100">
                                <td className="px-4 py-2 text-gray-600">Taxable purchases (veroton osto)</td>
                                <td className="px-4 py-2 text-right font-mono font-semibold text-gray-800">{fmt(workerPaymentsExVat)} €</td>
                              </tr>
                              <tr className="border-b border-gray-200">
                                <td className="px-4 py-2 text-gray-600">Input VAT / vero ostoista</td>
                                <td className="px-4 py-2 text-right font-mono font-semibold text-orange-600">− {fmt(inputVat)} €</td>
                              </tr>
                              <tr className={netVatToRemit >= 0 ? 'bg-red-50' : 'bg-green-50'}>
                                <td className={`px-4 py-3 font-bold text-sm ${netVatToRemit >= 0 ? 'text-red-700' : 'text-green-700'}`}>
                                  {netVatToRemit >= 0 ? '▲ Net VAT payable (maksettava ALV)' : '▼ VAT refund (palautettava ALV)'}
                                </td>
                                <td className={`px-4 py-3 text-right font-mono font-bold text-base ${netVatToRemit >= 0 ? 'text-red-700' : 'text-green-700'}`}>
                                  {fmt(Math.abs(netVatToRemit))} €
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* ── Quarterly VAT breakdown ───────────────────────────── */}
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Quarterly VAT Breakdown</div>
                        <table className="w-full text-xs border border-gray-200 rounded overflow-hidden">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="text-left px-3 py-2 font-semibold text-gray-600">Quarter</th>
                              <th className="text-right px-3 py-2 font-semibold text-gray-600">Wolt Income ex-VAT</th>
                              <th className="text-right px-3 py-2 font-semibold text-blue-600">Output VAT</th>
                              <th className="text-right px-3 py-2 font-semibold text-gray-600">Worker Payments ex-VAT</th>
                              <th className="text-right px-3 py-2 font-semibold text-orange-600">Input VAT</th>
                              <th className="text-right px-3 py-2 font-semibold text-gray-700">Net VAT</th>
                            </tr>
                          </thead>
                          <tbody>
                            {quarters.map(q => (
                              <tr key={q.q} className={`border-t border-gray-100 ${q.count === 0 ? 'opacity-40' : ''}`}>
                                <td className="px-3 py-2 font-semibold text-gray-600">Q{q.q} <span className="font-normal text-gray-400">({q.count} inv.)</span></td>
                                <td className="px-3 py-2 text-right font-mono">{q.wolt > 0 ? fmt(q.wolt) : '—'} {q.wolt > 0 ? '€' : ''}</td>
                                <td className="px-3 py-2 text-right font-mono text-blue-700">{q.outVat > 0 ? fmt(q.outVat) : '—'} {q.outVat > 0 ? '€' : ''}</td>
                                <td className="px-3 py-2 text-right font-mono">{q.workerEx > 0 ? fmt(q.workerEx) : '—'} {q.workerEx > 0 ? '€' : ''}</td>
                                <td className="px-3 py-2 text-right font-mono text-orange-600">{q.inVat > 0 ? fmt(q.inVat) : '—'} {q.inVat > 0 ? '€' : ''}</td>
                                <td className={`px-3 py-2 text-right font-mono font-semibold ${q.netVat > 0 ? 'text-red-600' : q.netVat < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                  {q.count > 0 ? `${fmt(q.netVat)} €` : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                            <tr>
                              <td className="px-3 py-2 text-gray-600">Annual total</td>
                              <td className="px-3 py-2 text-right font-mono">{fmt(woltIncomeExVat)} €</td>
                              <td className="px-3 py-2 text-right font-mono text-blue-700">{fmt(outputVat)} €</td>
                              <td className="px-3 py-2 text-right font-mono">{fmt(workerPaymentsExVat)} €</td>
                              <td className="px-3 py-2 text-right font-mono text-orange-600">{fmt(inputVat)} €</td>
                              <td className={`px-3 py-2 text-right font-mono ${netVatToRemit > 0 ? 'text-red-600' : 'text-green-600'}`}>{fmt(netVatToRemit)} €</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      {/* ── Invoice detail table ──────────────────────────────── */}
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Worker Invoices Detail</div>
                        <table className="w-full text-xs border border-gray-200 rounded overflow-hidden">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="text-left px-3 py-2 font-semibold text-gray-600">Invoice #</th>
                              <th className="text-left px-3 py-2 font-semibold text-gray-600">Worker</th>
                              <th className="text-left px-3 py-2 font-semibold text-gray-600">Date</th>
                              <th className="text-right px-3 py-2 font-semibold text-gray-600">Wolt Gross (ex-VAT)</th>
                              <th className="text-right px-3 py-2 font-semibold text-gray-600">Worker Payment (ex-VAT)</th>
                              <th className="text-right px-3 py-2 font-semibold text-orange-600">Input VAT</th>
                              <th className="text-right px-3 py-2 font-semibold text-gray-600">Total Paid</th>
                              <th className="px-2 py-2"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {owner.invoices.map((inv) => {
                              const invWolt = round2(inv.lineItems.reduce((s, li) => s + li.earnedAmount, 0))
                              return (
                                <tr key={inv.id} className="border-t border-gray-100 hover:bg-gray-50">
                                  <td className="px-3 py-2 font-mono text-gray-600">{inv.invoiceNumber}</td>
                                  <td className="px-3 py-2 text-gray-700">{inv.sellerName}</td>
                                  <td className="px-3 py-2 text-gray-500">{fmtDate(inv.invoiceDate)}</td>
                                  <td className="px-3 py-2 text-right font-mono text-indigo-700">{fmt(invWolt)} €</td>
                                  <td className="px-3 py-2 text-right font-mono">{fmt(inv.totalExVat)} €</td>
                                  <td className="px-3 py-2 text-right font-mono text-orange-600">{fmt(inv.totalVat)} €</td>
                                  <td className="px-3 py-2 text-right font-mono font-semibold">{fmt(inv.totalIncVat)} €</td>
                                  <td className="px-2 py-2">
                                    <a href={`/api/invoice/${inv.id}/pdf`} target="_blank"
                                      className="text-blue-500 hover:underline text-[10px]">PDF</a>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>

                    </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })()
      )}
    </div>
  )
}
