'use client'

import { useState, useEffect, useMemo } from 'react'
import { formatCurrency as fmt, round2 } from '@/lib/calculations'
import type { VatFilingFrequency } from '@/lib/vat-report'
import {
  currentOpenPeriod, vatPeriodsForYear, daysUntil, formatDueDate,
  type VatPeriodBounds,
} from '@/lib/vat-deadlines'
import type { ClientDashboardRow, MonthTotals } from '@/actions/dashboard'
import AddIncomeDialog from '@/components/AddIncomeDialog'
import ClientDialog, { type EditableClient } from '@/components/ClientDialog'

// Shared with BooksApp so the two screens always agree on filing frequency.
const VAT_FREQ_STORAGE_KEY = 'books_vat_filing_freq'

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function sumPeriod(months: MonthTotals[], p: VatPeriodBounds) {
  const inRange = months.filter((m) => m.m >= p.startMonth && m.m <= p.endMonth)
  const sum = (f: (m: MonthTotals) => number) => round2(inRange.reduce((s, m) => s + f(m), 0))
  return {
    net: sum((m) => m.net),
    turnover: sum((m) => m.incomeExVat),
    hasData: inRange.some((m) => m.incomeExVat !== 0 || m.expenseExVat !== 0 || m.outVat !== 0 || m.inVat !== 0),
    // Months in the period with no income recorded — the gaps still to enter.
    gaps: inRange.filter((m) => m.incomeExVat === 0 && m.outVat === 0).map((m) => m.m),
  }
}

function isBilledFor(row: ClientDashboardRow, p: VatPeriodBounds): boolean {
  return row.billedPeriods.some((b) => {
    const end = new Date(b.periodEnd)
    return end.getFullYear() === p.year && end.getMonth() >= p.startMonth && end.getMonth() <= p.endMonth
  })
}

export default function Dashboard({ clients, records, nextDisplayId, year, years }: {
  clients: ClientDashboardRow[]
  records: EditableClient[]
  nextDisplayId: string
  year: number
  years: number[]
}) {
  const [frequency, setFrequency] = useState<VatFilingFrequency>('quarterly')
  const [periodKey, setPeriodKey] = useState<string | null>(null)
  const [days, setDays] = useState<number | null>(null)
  const [addingIncomeFor, setAddingIncomeFor] = useState<number | null | 'any'>(null)
  const [editing, setEditing] = useState<EditableClient | null | 'new'>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(VAT_FREQ_STORAGE_KEY)
      if (saved === 'quarterly' || saved === 'semiannual' || saved === 'annual') setFrequency(saved)
    } catch { /* ignore */ }
  }, [])

  const periods = useMemo(() => vatPeriodsForYear(year, frequency), [year, frequency])
  const defaultPeriod = useMemo(() => currentOpenPeriod(year, frequency), [year, frequency])
  const period = periods.find((p) => p.key === periodKey) ?? defaultPeriod

  // Deferred to the client so server and client render identical markup even
  // when the app sits open across a date boundary.
  useEffect(() => { setDays(daysUntil(period.dueDate)) }, [period.dueDate])

  const rows = useMemo(
    () => clients.map((c) => ({ client: c, f: sumPeriod(c.months, period), billed: isBilledFor(c, period) })),
    [clients, period],
  )

  // Records from the substitute era with nothing current: their history stays
  // fully reportable, they just aren't part of today's work.
  const current = rows.filter((r) => !(r.client.role === 'SUBSTITUTE_WORKER' && !r.f.hasData))
  const past    = rows.filter((r) => r.client.role === 'SUBSTITUTE_WORKER' && !r.f.hasData)

  const needEntries = current.filter((r) => r.f.gaps.length > 0).length
  const overdue = days !== null && days < 0
  const soon    = days !== null && days >= 0 && days <= 14

  const clientOptions = clients.map((c) => ({ id: c.id, displayId: c.displayId, name: c.name }))
  const recordFor = (id: number) => records.find((r) => r.id === id) ?? null

  return (
    <div className="page">
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-subtitle">
            {period.label} · VAT due {formatDueDate(period.dueDate)}
            {days === null ? '' : overdue ? ` — overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`
              : days === 0 ? ' — today' : ` — in ${days} day${days === 1 ? '' : 's'}`}
            {needEntries > 0 && ` · ${needEntries} still need entries`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="segmented">
            {years.map((yr) => (
              <a key={yr} href={`/?year=${yr}`}
                className={`segmented-item ${yr === year ? 'segmented-item-active' : ''}`}>{yr}</a>
            ))}
          </div>
          <button onClick={() => setEditing('new')} className="btn-secondary">Add client</button>
          <button onClick={() => setAddingIncomeFor('any')} className="btn-primary">Add income</button>
        </div>
      </div>

      {/* The deadline only gets its own band when it actually needs attention. */}
      {(overdue || soon) && (
        <div className={`mb-4 ${overdue ? 'notice-error' : 'notice-warn'}`}>
          The {period.label} VAT return is {overdue ? `overdue — it was due ${formatDueDate(period.dueDate)}`
            : `due ${formatDueDate(period.dueDate)}`}. Each client files their own return in OmaVero.
        </div>
      )}

      {/* ── Period tabs ── */}
      <div className="segmented mb-3">
        {periods.map((p) => (
          <button key={p.key} onClick={() => setPeriodKey(p.key)}
            className={`segmented-item ${p.key === period.key ? 'segmented-item-active' : ''}`}>
            {p.label}
          </button>
        ))}
      </div>

      {/* ── Client list ──
          Figures belong to one client each — nothing is summed across clients,
          because they file separately and a combined total would mean nothing. */}
      {clients.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-state-title">No clients yet</div>
          <button onClick={() => setEditing('new')} className="btn-primary mt-3">Add your first client</button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Client</th>
                <th className="text-right">Turnover</th>
                <th className="text-right">Net VAT</th>
                <th>Entries</th>
                <th className="text-center">Fee</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {current.map(({ client, f, billed }) => (
                <tr key={client.id} className="row-link">
                  <td>
                    <a href={`/books?client=${client.id}&year=${year}`} className="group flex items-center gap-2">
                      <span className="font-mono text-[10px] text-slate-400 tabular-nums">{client.displayId}</span>
                      <span className="font-medium text-slate-800 group-hover:text-indigo-700">{client.name}</span>
                    </a>
                  </td>
                  <td className="cell-num">{fmt(f.turnover)}</td>
                  <td className={`cell-num font-semibold ${
                    f.net > 0 ? 'text-slate-900' : f.net < 0 ? 'text-emerald-600' : 'text-slate-400'
                  }`}>{fmt(f.net)}</td>
                  <td>
                    {f.gaps.length === 0
                      ? <span className="pill-success">complete</span>
                      : <span className="pill-warn">{f.gaps.map((m) => MONTH_ABBR[m]).join(', ')} missing</span>}
                  </td>
                  <td className="text-center">
                    {billed
                      ? <span className="pill-success">invoiced</span>
                      : <span className="pill-neutral">not billed</span>}
                  </td>
                  <td className="text-right whitespace-nowrap">
                    {f.gaps.length > 0 && (
                      <button onClick={() => setAddingIncomeFor(client.id)} className="btn-secondary btn-sm mr-1">
                        + Income
                      </button>
                    )}
                    <button onClick={() => setEditing(recordFor(client.id))} className="btn-ghost btn-sm"
                      title={`Edit ${client.name}`}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Past clients ── */}
      {past.length > 0 && (
        <div className="mt-5">
          <div className="section-title mb-2">Past clients — no activity in {period.label}</div>
          <div className="card overflow-hidden">
            <table className="data-table">
              <tbody>
                {past.map(({ client }) => (
                  <tr key={client.id} className="row-link">
                    <td>
                      <a href={`/books?client=${client.id}&year=${year}`} className="group flex items-center gap-2">
                        <span className="font-mono text-[10px] text-slate-400 tabular-nums">{client.displayId}</span>
                        <span className="font-medium text-slate-600 group-hover:text-indigo-700">{client.name}</span>
                      </a>
                    </td>
                    <td className="text-[11.5px] text-slate-400">
                      Earlier income and VAT stay available in their books
                    </td>
                    <td className="text-right">
                      <button onClick={() => setEditing(recordFor(client.id))} className="btn-ghost btn-sm">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {addingIncomeFor !== null && (
        <AddIncomeDialog
          clients={clientOptions}
          year={year}
          defaultClientId={addingIncomeFor === 'any' ? null : addingIncomeFor}
          onClose={() => setAddingIncomeFor(null)}
        />
      )}

      {editing !== null && (
        <ClientDialog
          client={editing === 'new' ? null : editing}
          nextDisplayId={nextDisplayId}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
