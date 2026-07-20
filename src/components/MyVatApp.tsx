'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { BkVatQuarter } from '@/actions/bookkeeper-invoice'
import type { GigVatQuarter } from '@/actions/owner-books'
import { round2, formatCurrency as fmt } from '@/lib/calculations'

// ─── Types ────────────────────────────────────────────────────────────────────

type ClientOption = { id: number; displayId: string; name: string }

type Props = {
  year: number
  // Bookkeeper service fee data (from BookkeeperInvoice table)
  bkQuarters: BkVatQuarter[]
  bkAnnualExVat: number
  bkAnnualVat: number
  bkAnnualIncVat: number
  bkInvoiceCount: number
  // Gig work data (from OwnerIncomePeriod, linked invoices, expenses)
  gigQuarters: GigVatQuarter[] | null   // null = no client selected
  gigClientName: string | null
  gigAnnualOutputVat: number
  gigAnnualSubsOutputVat: number
  gigAnnualWorkerInputVat: number
  gigAnnualExpenseInputVat: number
  // For the client selector
  clients: ClientOption[]
  selectedClientId: number | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString('fi-FI', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const Q_LABELS = ['Jan-Mar', 'Apr-Jun', 'Jul-Sep', 'Oct-Dec']
const Q_DEADLINES = ['12.02', '12.05', '12.08', '12.11']

// ─── Component ────────────────────────────────────────────────────────────────

export default function MyVatApp({
  year,
  bkQuarters, bkAnnualExVat, bkAnnualVat, bkAnnualIncVat, bkInvoiceCount,
  gigQuarters, gigClientName,
  gigAnnualOutputVat, gigAnnualSubsOutputVat, gigAnnualWorkerInputVat, gigAnnualExpenseInputVat,
  clients, selectedClientId,
}: Props) {
  const router = useRouter()
  const years = Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - i)
  const autoNavigated = useRef(false)

  // On first load: if no gig client in the URL but one was saved previously, restore it
  useEffect(() => {
    if (selectedClientId !== null || autoNavigated.current) return
    autoNavigated.current = true
    try {
      const saved = localStorage.getItem('my_gig_client_id')
      if (saved) {
        const params = new URLSearchParams()
        params.set('year', String(year))
        params.set('clientId', saved)
        router.replace(`/my-vat?${params.toString()}`)
      }
    } catch { /* ignore */ }
  }, [selectedClientId, year, router])

  function navigate(yr: number, cid: number | null) {
    try {
      if (cid !== null) localStorage.setItem('my_gig_client_id', String(cid))
      else localStorage.removeItem('my_gig_client_id')
    } catch { /* ignore */ }
    const params = new URLSearchParams()
    params.set('year', String(yr))
    if (cid !== null) params.set('clientId', String(cid))
    router.push(`/my-vat?${params.toString()}`)
  }

  function combinedQ(q: number) {
    const bk  = bkQuarters.find(x => x.quarter === q)
    const gig = gigQuarters?.find(x => x.quarter === q)
    const bkVat      = bk?.totalVat ?? 0
    const gigOut     = (gig?.gigOutputVat ?? 0) + (gig?.subsOutputVat ?? 0)
    const totalOut   = round2(bkVat + gigOut)
    const totalIn    = round2((gig?.workerInputVat ?? 0) + (gig?.expenseInputVat ?? 0))
    return { bkVat, gigOut, totalOut, totalIn, net: round2(totalOut - totalIn) }
  }

  const annualTotalOut = round2(bkAnnualVat + gigAnnualOutputVat + gigAnnualSubsOutputVat)
  const annualTotalIn  = round2(gigAnnualWorkerInputVat + gigAnnualExpenseInputVat)
  const annualNet      = round2(annualTotalOut - annualTotalIn)
  const hasGig = gigQuarters !== null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 sticky top-0 z-20">
        <div>
          <h1 className="font-bold text-base text-gray-800">My VAT / Oma Vero</h1>
          <p className="text-[10px] text-gray-400">Your complete VAT position as bookkeeper + gig worker</p>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          {years.map((yr) => (
            <button key={yr} onClick={() => navigate(yr, selectedClientId)}
              className={`px-3 py-1 rounded text-xs font-semibold border transition-colors ${
                yr === year ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-500 border-gray-200 hover:border-blue-400'
              }`}>{yr}</button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-5">

        {/* Gig worker account selector */}
        <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 mb-5 flex items-center gap-4">
          <div className="shrink-0">
            <div className="text-xs font-bold text-gray-700 mb-0.5">My gig worker record</div>
            <div className="text-[10px] text-gray-400 max-w-xs">
              You work as both a bookkeeper AND a courier. Your gig work income &amp; VAT is stored under your own client record.
              Select it once — it will be remembered automatically.
            </div>
          </div>
          <div className="flex-1">
            <select
              value={selectedClientId ?? ''}
              onChange={(e) => navigate(year, e.target.value === '' ? null : parseInt(e.target.value, 10))}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs bg-white"
            >
              <option value="">— select your own client record (set once) —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.displayId} — {c.name}</option>
              ))}
            </select>
          </div>
          {hasGig ? (
            <div className="shrink-0 text-right">
              <div className="text-[10px] text-green-600 font-semibold">✓ {gigClientName}</div>
              <div className="text-[10px] text-gray-400">Gig work VAT included</div>
            </div>
          ) : (
            <div className="shrink-0 text-right">
              <div className="text-[10px] text-amber-600 font-semibold">BK fees only</div>
              <div className="text-[10px] text-gray-400">Select above for full picture</div>
            </div>
          )}
        </div>

        {/* Annual summary cards */}
        {hasGig ? (
          <div className="grid grid-cols-4 gap-4 mb-5">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-[10px] text-gray-400 mb-1 font-medium uppercase tracking-wide">Total Output VAT</div>
              <div className="text-xl font-bold text-orange-600 font-mono">{fmt(annualTotalOut)} EUR</div>
              <div className="text-[10px] text-gray-400 mt-1">BK {fmt(bkAnnualVat)} + Gig {fmt(round2(gigAnnualOutputVat + gigAnnualSubsOutputVat))}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-[10px] text-gray-400 mb-1 font-medium uppercase tracking-wide">Total Input VAT</div>
              <div className="text-xl font-bold text-green-700 font-mono">{fmt(annualTotalIn)} EUR</div>
              <div className="text-[10px] text-gray-400 mt-1">Workers {fmt(gigAnnualWorkerInputVat)} + Exp {fmt(gigAnnualExpenseInputVat)}</div>
            </div>
            <div className={`rounded-xl p-4 border ${annualNet >= 0 ? 'bg-amber-50 border-amber-300' : 'bg-green-50 border-green-300'}`}>
              <div className="text-[10px] font-semibold mb-1 uppercase tracking-wide text-amber-600">Net Payable to Vero</div>
              <div className="text-xl font-bold font-mono text-amber-700">{fmt(Math.abs(annualNet))} EUR</div>
              <div className="text-[10px] text-amber-500 mt-1">{annualNet >= 0 ? 'you owe Vero' : 'Vero owes you'}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-[10px] text-gray-400 mb-1 font-medium uppercase tracking-wide">BK Service Income</div>
              <div className="text-xl font-bold text-blue-700 font-mono">{fmt(bkAnnualExVat)} EUR</div>
              <div className="text-[10px] text-gray-400 mt-1">{bkInvoiceCount} invoice{bkInvoiceCount !== 1 ? 's' : ''}</div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-4 mb-5">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-[10px] text-gray-400 mb-1 font-medium uppercase tracking-wide">BK Service Income</div>
              <div className="text-xl font-bold text-green-700 font-mono">{fmt(bkAnnualExVat)} EUR</div>
              <div className="text-[10px] text-gray-400 mt-1">ex-VAT - {bkInvoiceCount} invoice{bkInvoiceCount !== 1 ? 's' : ''}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-[10px] text-gray-400 mb-1 font-medium uppercase tracking-wide">VAT Collected (BK)</div>
              <div className="text-xl font-bold text-orange-600 font-mono">{fmt(bkAnnualVat)} EUR</div>
              <div className="text-[10px] text-gray-400 mt-1">Output VAT from clients</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-[10px] text-gray-400 mb-1 font-medium uppercase tracking-wide">Total Invoiced</div>
              <div className="text-xl font-bold text-gray-800 font-mono">{fmt(bkAnnualIncVat)} EUR</div>
              <div className="text-[10px] text-gray-400 mt-1">inc. VAT paid by clients</div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="text-[10px] text-amber-600 mb-1 font-semibold uppercase tracking-wide">Incomplete</div>
              <div className="text-sm font-bold text-amber-700">Link gig account above</div>
              <div className="text-[10px] text-amber-500 mt-1">for full Oma Vero figure</div>
            </div>
          </div>
        )}

        {/* Quarterly combined table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-5">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-bold text-gray-700">Quarterly Oma Vero Reference — {year}</h3>
            <p className="text-[10px] text-gray-400">
              {hasGig ? 'BK fees + gig work combined. File via OmaVero > Arvonlisavero > Ilmoita ALV.' : 'Bookkeeper service fees only - link gig worker account above for full figures.'}
            </p>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Quarter</th>
                <th className="text-right px-4 py-3 font-semibold text-teal-700">BK Output VAT</th>
                {hasGig && <th className="text-right px-4 py-3 font-semibold text-indigo-600">Gig Output VAT</th>}
                <th className="text-right px-4 py-3 font-semibold text-orange-700">Total Output</th>
                {hasGig && <th className="text-right px-4 py-3 font-semibold text-red-600">Total Input</th>}
                <th className="text-right px-5 py-3 font-semibold text-blue-700">{hasGig ? 'Net Payable' : 'Remit to Vero'}</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4].map((q) => {
                const bk = bkQuarters.find(x => x.quarter === q)
                const cq = combinedQ(q)
                const active = cq.totalOut > 0 || cq.totalIn > 0
                return (
                  <tr key={q} className={`border-t border-gray-100 ${!active ? 'opacity-40' : ''}`}>
                    <td className="px-5 py-3 font-semibold text-gray-800">
                      Q{q} <span className="font-normal text-gray-400">{Q_LABELS[q-1]}</span>
                      <div className="text-[10px] text-gray-400 font-normal">Deadline: {Q_DEADLINES[q-1]}.{String(year + (q === 4 ? 1 : 0)).slice(2)}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-teal-700">{fmt(bk?.totalVat ?? 0)}</td>
                    {hasGig && <td className="px-4 py-3 text-right font-mono text-indigo-600">{fmt(cq.gigOut)}</td>}
                    <td className="px-4 py-3 text-right font-mono font-bold text-orange-700">{fmt(cq.totalOut)}</td>
                    {hasGig && <td className="px-4 py-3 text-right font-mono text-red-600">{fmt(cq.totalIn)}</td>}
                    <td className={`px-5 py-3 text-right font-mono font-bold ${cq.net >= 0 ? 'text-blue-700' : 'text-green-600'}`}>
                      {fmt(Math.abs(cq.net))}{cq.net < 0 ? ' (refund)' : ''}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="border-t-2 border-gray-300 bg-gray-50">
              <tr>
                <td className="px-5 py-3 font-bold text-gray-700">Annual Total</td>
                <td className="px-4 py-3 text-right font-bold font-mono text-teal-700">{fmt(bkAnnualVat)}</td>
                {hasGig && <td className="px-4 py-3 text-right font-bold font-mono text-indigo-600">{fmt(round2(gigAnnualOutputVat + gigAnnualSubsOutputVat))}</td>}
                <td className="px-4 py-3 text-right font-bold font-mono text-orange-700 text-base">{fmt(annualTotalOut)}</td>
                {hasGig && <td className="px-4 py-3 text-right font-bold font-mono text-red-600">{fmt(annualTotalIn)}</td>}
                <td className={`px-5 py-3 text-right font-bold font-mono text-lg ${annualNet >= 0 ? 'text-blue-700' : 'text-green-600'}`}>{fmt(Math.abs(annualNet))} EUR</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* BK invoices detail */}
        {bkInvoiceCount > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-5">
            <div className="px-5 py-3 bg-teal-50 border-b border-teal-100">
              <h3 className="text-sm font-bold text-teal-800">Bookkeeper Service Invoices — {year}</h3>
              <p className="text-[10px] text-teal-600">Invoices issued to clients. VAT = your output VAT from services.</p>
            </div>
            {bkQuarters.filter(q => q.invoices.length > 0).map((q) => (
              <div key={q.quarter} className="border-t border-gray-100">
                <div className="px-5 py-2 bg-gray-50 flex justify-between items-center">
                  <span className="text-[11px] font-bold text-gray-700">Q{q.quarter} · {Q_LABELS[q.quarter-1]}</span>
                  <span className="text-[11px] font-mono text-orange-600 font-semibold">{q.invoices.length} invoices · VAT {fmt(q.totalVat)} EUR</span>
                </div>
                <table className="w-full text-xs">
                  <tbody>
                    {q.invoices.map((inv, idx) => (
                      <tr key={inv.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                        <td className="px-5 py-2 font-mono text-[11px] text-gray-500 w-48">{inv.invoiceNumber}</td>
                        <td className="px-3 py-2 text-gray-500 w-28">{fmtDate(inv.issueDate)}</td>
                        <td className="px-3 py-2 font-medium text-gray-800">{inv.clientName}</td>
                        <td className="px-3 py-2 text-right font-mono text-gray-600">{fmt(inv.amountExVat)}</td>
                        <td className="px-3 py-2 text-right font-mono text-orange-600 font-semibold w-24">{fmt(inv.vatAmount)} EUR</td>
                        <td className="px-5 py-2 text-right font-mono font-bold text-gray-800 w-28">{fmt(inv.totalIncVat)} EUR</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        {/* Gig work VAT detail */}
        {hasGig && gigQuarters && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-5">
            <div className="px-5 py-3 bg-indigo-50 border-b border-indigo-100">
              <h3 className="text-sm font-bold text-indigo-800">Gig Work VAT — {gigClientName} — {year}</h3>
              <p className="text-[10px] text-indigo-600">Own courier income + substitute periods (output), minus worker cost + expenses (input).</p>
            </div>
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-2.5 font-semibold text-gray-600">Quarter</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-green-700">Gig Output VAT</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-indigo-600">Subs Output VAT</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-orange-600">Worker Input VAT</th>
                  <th className="text-right px-5 py-2.5 font-semibold text-red-600">Expense Input VAT</th>
                </tr>
              </thead>
              <tbody>
                {gigQuarters.map((q) => {
                  const active = q.gigOutputVat > 0 || q.subsOutputVat > 0 || q.workerInputVat > 0 || q.expenseInputVat > 0
                  return (
                    <tr key={q.quarter} className={`border-t border-gray-100 ${!active ? 'opacity-40' : ''}`}>
                      <td className="px-5 py-2.5 font-semibold text-gray-700">Q{q.quarter} <span className="font-normal text-gray-400">{Q_LABELS[q.quarter-1]}</span></td>
                      <td className="px-4 py-2.5 text-right font-mono text-green-700">{fmt(q.gigOutputVat)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-indigo-600">{fmt(q.subsOutputVat)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-orange-600">{fmt(q.workerInputVat)}</td>
                      <td className="px-5 py-2.5 text-right font-mono text-red-600">{fmt(q.expenseInputVat)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="border-t-2 border-gray-200 bg-indigo-50">
                <tr>
                  <td className="px-5 py-2.5 font-bold text-indigo-800">Total</td>
                  <td className="px-4 py-2.5 text-right font-bold font-mono text-green-700">{fmt(gigAnnualOutputVat)}</td>
                  <td className="px-4 py-2.5 text-right font-bold font-mono text-indigo-600">{fmt(gigAnnualSubsOutputVat)}</td>
                  <td className="px-4 py-2.5 text-right font-bold font-mono text-orange-600">{fmt(gigAnnualWorkerInputVat)}</td>
                  <td className="px-5 py-2.5 text-right font-bold font-mono text-red-600">{fmt(gigAnnualExpenseInputVat)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* How to file */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-xs text-blue-800">
          <div className="font-bold text-sm mb-2">How to file in OmaVero (ALV-ilmoitus)</div>
          <ol className="list-decimal list-inside space-y-1 mb-3">
            <li>OmaVero &gt; <strong>Arvonlisavero &gt; Ilmoita ALV</strong></li>
            <li>Select the filing period (quarter)</li>
            <li><strong>Kotimaan myynti 25,5%</strong> = BK fees ex-VAT{hasGig ? ' + own gig income ex-VAT + full Wolt gross on substitute periods' : ''}</li>
            <li><strong>Vero kotimaan myynneista</strong> = {fmt(annualTotalOut)} EUR (total output VAT)</li>
            {hasGig && annualTotalIn > 0 && <li><strong>Vahennettava vero</strong> = {fmt(annualTotalIn)} EUR (worker invoices + expense VAT)</li>}
            <li>Submit — Vero calculates net automatically</li>
          </ol>
          <div className="bg-white border border-blue-100 rounded-lg p-3 font-mono text-[11px]">
            <strong>Your {year} summary:</strong><br />
            Output VAT = BK fees {fmt(bkAnnualVat)} EUR{hasGig ? ` + gig/subs ${fmt(round2(gigAnnualOutputVat + gigAnnualSubsOutputVat))} EUR = ${fmt(annualTotalOut)} EUR` : ''}<br />
            {hasGig && <>Input VAT = {fmt(annualTotalIn)} EUR<br /></>}
            <strong>Net payable = {fmt(Math.abs(annualNet))} EUR{annualNet < 0 ? ' (refund)' : ''}</strong>
          </div>
        </div>

      </div>
    </div>
  )
}
