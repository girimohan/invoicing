'use client'

import { useState, useEffect, useMemo } from 'react'
import { formatCurrency as fmt, round2 } from '@/lib/calculations'
import type { VatFilingFrequency } from '@/lib/vat-report'
import {
  currentOpenPeriod, vatPeriodsForYear, daysUntil, formatDueDate,
  type VatPeriodBounds,
} from '@/lib/vat-deadlines'
import type { ClientDashboardRow, MonthTotals } from '@/actions/dashboard'

// Shared with BooksApp so the two screens always agree on filing frequency.
const VAT_FREQ_STORAGE_KEY = 'books_vat_filing_freq'

type PeriodFigures = {
  outVat: number; inVat: number; net: number
  incomeExVat: number; expenseExVat: number
  monthsWithData: number
}

function sumPeriod(months: MonthTotals[], p: VatPeriodBounds): PeriodFigures {
  const inRange = months.filter((m) => m.m >= p.startMonth && m.m <= p.endMonth)
  const sum = (f: (m: MonthTotals) => number) => round2(inRange.reduce((s, m) => s + f(m), 0))
  return {
    outVat: sum((m) => m.outVat),
    inVat: sum((m) => m.inVat),
    net: sum((m) => m.net),
    incomeExVat: sum((m) => m.incomeExVat),
    expenseExVat: sum((m) => m.expenseExVat),
    monthsWithData: inRange.filter(
      (m) => m.incomeExVat !== 0 || m.expenseExVat !== 0 || m.outVat !== 0 || m.inVat !== 0,
    ).length,
  }
}

/** Has a bookkeeping fee invoice been issued covering this VAT period? */
function isBilledFor(row: ClientDashboardRow, p: VatPeriodBounds): boolean {
  return row.billedPeriods.some((b) => {
    const end = new Date(b.periodEnd)
    return end.getFullYear() === p.year && end.getMonth() >= p.startMonth && end.getMonth() <= p.endMonth
  })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fi-FI', { day: '2-digit', month: '2-digit' })
}

// ─── Deadline strip ───────────────────────────────────────────────────────────

function DeadlineCard({ period }: { period: VatPeriodBounds }) {
  const [days, setDays] = useState<number | null>(null)
  // Deferred to the client so server and client render identical markup even
  // when the app sits open across midnight or a date boundary.
  useEffect(() => { setDays(daysUntil(period.dueDate)) }, [period.dueDate])

  const overdue = days !== null && days < 0
  const soon = days !== null && days >= 0 && days <= 14

  const accent = overdue ? 'text-rose-600' : soon ? 'text-amber-600' : 'text-slate-900'
  const label =
    days === null ? 'Deadline'
    : overdue     ? 'Overdue by'
    : days === 0  ? 'Due'
    :               'Days remaining'
  const value =
    days === null ? '—'
    : overdue     ? `${Math.abs(days)}d`
    : days === 0  ? 'today'
    :               String(days)

  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${accent}`}>{value}</div>
      <div className="stat-note">
        {period.label} · due {formatDueDate(period.dueDate)}
      </div>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard({ clients, year, years }: {
  clients: ClientDashboardRow[]
  year: number
  years: number[]
}) {
  const [frequency, setFrequency] = useState<VatFilingFrequency>('quarterly')
  const [periodKey, setPeriodKey] = useState<string | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(VAT_FREQ_STORAGE_KEY)
      if (saved === 'quarterly' || saved === 'semiannual' || saved === 'annual') setFrequency(saved)
    } catch { /* ignore */ }
  }, [])

  function changeFrequency(f: VatFilingFrequency) {
    setFrequency(f)
    setPeriodKey(null)
    try { localStorage.setItem(VAT_FREQ_STORAGE_KEY, f) } catch { /* ignore */ }
  }

  const periods = useMemo(() => vatPeriodsForYear(year, frequency), [year, frequency])
  const defaultPeriod = useMemo(() => currentOpenPeriod(year, frequency), [year, frequency])
  const period = periods.find((p) => p.key === periodKey) ?? defaultPeriod

  const rows = useMemo(
    () => clients.map((c) => ({ client: c, figures: sumPeriod(c.months, period), billed: isBilledFor(c, period) })),
    [clients, period],
  )

  // Legacy substitute workers fall quiet once that model winds down — keep them
  // reachable, but out of the daily working view.
  const active  = rows.filter((r) => r.figures.monthsWithData > 0 || r.client.role === 'ACCOUNT_HOLDER')
  const dormant = rows.filter((r) => !active.includes(r))

  const totalNet     = round2(active.reduce((s, r) => s + r.figures.net, 0))
  const totalTurnover = round2(active.reduce((s, r) => s + r.figures.incomeExVat, 0))
  const unbilled     = active.filter((r) => !r.billed && r.figures.monthsWithData > 0)
  const missingData  = active.filter((r) => r.figures.monthsWithData === 0)

  return (
    <div className="page">
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            VAT position, filing deadlines and billing status across all clients
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="segmented">
            {years.map((yr) => (
              <a key={yr} href={`/?year=${yr}`}
                className={`segmented-item ${yr === year ? 'segmented-item-active' : ''}`}>{yr}</a>
            ))}
          </div>
          <a href="/bookkeeper" className="btn-primary">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" className="w-3.5 h-3.5">
              <path d="M10 4.5v11M4.5 10h11" />
            </svg>
            New Service Invoice
          </a>
        </div>
      </div>

      {/* ── Headline figures ── */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <DeadlineCard period={period} />
        <div className="stat">
          <div className="stat-label">Net VAT payable</div>
          <div className={`stat-value ${totalNet < 0 ? 'text-emerald-600' : ''}`}>{fmt(totalNet)} €</div>
          <div className="stat-note">{period.label} · all clients</div>
        </div>
        <div className="stat">
          <div className="stat-label">Turnover</div>
          <div className="stat-value">{fmt(totalTurnover)} €</div>
          <div className="stat-note">{period.label} · excl. VAT</div>
        </div>
        <div className="stat">
          <div className="stat-label">Unbilled clients</div>
          <div className={`stat-value ${unbilled.length > 0 ? 'text-indigo-600' : ''}`}>{unbilled.length}</div>
          <div className="stat-note">
            {unbilled.length === 0 ? 'all invoiced for this period' : `of ${active.length} need a service invoice`}
          </div>
        </div>
      </div>

      {/* ── Period + filing frequency selectors ── */}
      <div className="flex items-center justify-between mb-3 gap-4">
        <div className="segmented">
          {periods.map((p) => (
            <button key={p.key} onClick={() => setPeriodKey(p.key)}
              className={`segmented-item ${p.key === period.key ? 'segmented-item-active' : ''}`}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="segmented">
          {(['quarterly', 'semiannual', 'annual'] as const).map((f) => (
            <button key={f} onClick={() => changeFrequency(f)}
              className={`segmented-item ${frequency === f ? 'segmented-item-active' : ''}`}>
              {f === 'quarterly' ? 'Quarterly' : f === 'semiannual' ? 'Half-year' : 'Annual'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Client table ── */}
      {clients.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-state-title">No clients yet</div>
          <div className="text-[12px]">
            Add one from the <a href="/clients" className="text-indigo-600 font-medium hover:underline">Clients</a> page.
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Client</th>
                <th className="text-right">Turnover</th>
                <th className="text-right">Output VAT</th>
                <th className="text-right">Input VAT</th>
                <th className="text-right">Net VAT</th>
                <th>Status</th>
                <th className="text-right">Last entry</th>
                <th className="text-center">Service fee</th>
              </tr>
            </thead>
            <tbody>
              {active.map(({ client, figures, billed }) => (
                <tr key={client.id} className="row-link">
                  <td>
                    <a href={`/books?client=${client.id}&year=${year}`} className="group flex items-center gap-2">
                      <span className="font-mono text-[10px] text-slate-400 tabular-nums">{client.displayId}</span>
                      <span className="font-medium text-slate-800 group-hover:text-indigo-700">{client.name}</span>
                      {client.role === 'SUBSTITUTE_WORKER' && (
                        <span className="pill-neutral">legacy worker</span>
                      )}
                    </a>
                  </td>
                  <td className="cell-num">{fmt(figures.incomeExVat)}</td>
                  <td className="cell-num">{fmt(figures.outVat)}</td>
                  <td className="cell-num">{fmt(figures.inVat)}</td>
                  <td className={`cell-num font-semibold ${
                    figures.net > 0 ? 'text-slate-900' : figures.net < 0 ? 'text-emerald-600' : 'text-slate-400'
                  }`}>{fmt(figures.net)}</td>
                  <td>
                    {figures.monthsWithData === 0
                      ? <span className="pill-warn">no entries</span>
                      : <span className="pill-info">open</span>}
                  </td>
                  <td className="text-right text-[11px] text-slate-400 tabular-nums">
                    {client.lastEntryAt ? fmtDate(client.lastEntryAt) : '—'}
                  </td>
                  <td className="text-center">
                    {billed ? (
                      <span className="pill-success">invoiced</span>
                    ) : (
                      <a href={`/bookkeeper?client=${client.id}`}
                        className="btn-secondary btn-sm"
                        title={`Issue a service invoice to ${client.name} for ${period.label}`}>
                        Bill
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>Net VAT payable — {period.label}</td>
                <td className={`cell-num text-[14px] font-semibold ${
                  totalNet < 0 ? 'text-emerald-600' : 'text-slate-900'
                }`}>{fmt(totalNet)} €</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ── Action panels ── */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        {unbilled.length > 0 && (
          <div className="card card-pad flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="card-title">
                {unbilled.length} client{unbilled.length === 1 ? '' : 's'} to bill for {period.label}
              </div>
              <div className="card-hint truncate">{unbilled.map((r) => r.client.name).join(' · ')}</div>
            </div>
            <a href="/bookkeeper" className="btn-primary shrink-0">Issue invoices</a>
          </div>
        )}

        {missingData.length > 0 && (
          <div className="card card-pad flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="card-title">
                {missingData.length} client{missingData.length === 1 ? '' : 's'} with no entries in {period.label}
              </div>
              <div className="card-hint truncate">{missingData.map((r) => r.client.name).join(' · ')}</div>
            </div>
            <a href={`/books?client=${missingData[0].client.id}&year=${year}`} className="btn-secondary shrink-0">
              Open books
            </a>
          </div>
        )}
      </div>

      {/* ── Dormant / legacy clients ── */}
      {dormant.length > 0 && (
        <div className="mt-5 text-[11px] text-slate-400">
          <span className="font-semibold text-slate-500">No activity in {period.label}:</span>{' '}
          {dormant.map((r, i) => (
            <span key={r.client.id}>
              {i > 0 && ' · '}
              <a href={`/books?client=${r.client.id}&year=${year}`} className="hover:text-indigo-600 hover:underline">
                {r.client.name}
              </a>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
