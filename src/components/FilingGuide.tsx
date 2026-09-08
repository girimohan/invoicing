'use client'

import { useState, useEffect, useMemo } from 'react'
import { formatCurrency as fmt, round2 } from '@/lib/calculations'
import type { VatFilingFrequency } from '@/lib/vat-report'
import {
  vatPeriodsForYear, currentOpenPeriod, daysUntil, formatDueDate,
  type VatPeriodBounds,
} from '@/lib/vat-deadlines'
import {
  VAT_STEPS, ANNUAL_STEPS, RECENT_CHANGES, VAT_RATES, THRESHOLDS, SOURCES, VERIFIED_ON,
  type GuideStep,
} from '@/lib/filing-guide'
import { getFilingFigures, type FilingFigures } from '@/actions/filing'
import { getVatFilings, type VatFilingRecord } from '@/actions/vat-filing'
import FilingStatusPanel from '@/components/FilingStatusPanel'

const VAT_FREQ_STORAGE_KEY = 'books_vat_filing_freq'

type Client = { id: number; displayId: string; name: string }
type Mode = 'vat' | 'annual'

// ─── Step row ─────────────────────────────────────────────────────────────────

function Step({ step, index, value, done, onToggle }: {
  step: GuideStep
  index: number
  value: string | null
  done: boolean
  onToggle: () => void
}) {
  return (
    <li className={`flex gap-3.5 px-5 py-4 border-b border-slate-100 last:border-0 transition-colors ${
      done ? 'bg-slate-50/60' : ''
    }`}>
      <button
        onClick={onToggle}
        aria-pressed={done}
        aria-label={done ? `Mark step ${index + 1} not done` : `Mark step ${index + 1} done`}
        className={`mt-0.5 w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center
                    transition-colors duration-150 ${
          done
            ? 'bg-emerald-500 border-emerald-500 text-white'
            : 'border-slate-300 text-transparent hover:border-indigo-400'
        }`}
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="3"
          strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
          <path d="m4 10.5 4 4 8-9" />
        </svg>
      </button>

      <div className="min-w-0 flex-1">
        <div className={`text-[13px] font-semibold ${done ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
          <span className="text-slate-300 font-mono mr-1.5 tabular-nums">{index + 1}</span>
          {step.title}
        </div>
        <p className={`text-[12px] leading-relaxed mt-1 ${done ? 'text-slate-400' : 'text-slate-600'}`}>
          {step.body}
        </p>

        {step.warn && (
          <div className="notice-warn mt-2.5 text-[11.5px]">Check this before you submit.</div>
        )}

        {step.field && (
          <div className="mt-2.5 flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-2.5">
            <div className="min-w-0">
              <div className="text-[9px] font-semibold uppercase tracking-[0.07em] text-slate-400">
                MyTax field
              </div>
              <div className="text-[12px] font-medium text-slate-700 truncate">{step.field}</div>
            </div>
            {value !== null && (
              <div className="text-[17px] font-semibold text-indigo-700 font-mono tabular-nums shrink-0">
                {value}
              </div>
            )}
          </div>
        )}

        {step.source && (
          <a href={SOURCES[step.source]} target="_blank" rel="noreferrer"
            className="inline-block mt-2 text-[11px] text-indigo-600 hover:underline">
            vero.fi source ↗
          </a>
        )}
      </div>
    </li>
  )
}

// ─── Filing guide ─────────────────────────────────────────────────────────────

export default function FilingGuide({ clients, year, years }: {
  clients: Client[]
  year: number
  years: number[]
}) {
  const [mode, setMode] = useState<Mode>('vat')
  const [clientId, setClientId] = useState<number | null>(clients[0]?.id ?? null)
  const [frequency, setFrequency] = useState<VatFilingFrequency>('quarterly')
  const [periodKey, setPeriodKey] = useState<string | null>(null)
  const [data, setData] = useState<FilingFigures | null>(null)
  const [filings, setFilings] = useState<VatFilingRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(VAT_FREQ_STORAGE_KEY)
      if (saved === 'quarterly' || saved === 'semiannual' || saved === 'annual') setFrequency(saved)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (clientId === null) { setData(null); setFilings([]); return }
    setLoading(true)
    Promise.all([getFilingFigures(clientId, year), getVatFilings(clientId, year)])
      .then(([figures, f]) => { setData(figures); setFilings(f) })
      .catch(() => { setData(null); setFilings([]) })
      .finally(() => setLoading(false))
  }, [clientId, year, refreshKey])

  const periods = useMemo(() => vatPeriodsForYear(year, frequency), [year, frequency])
  const defaultPeriod = useMemo(() => currentOpenPeriod(year, frequency), [year, frequency])
  const period: VatPeriodBounds = periods.find((p) => p.key === periodKey) ?? defaultPeriod

  // Progress is per client + year + period + mode, so ticking off Q2 for one
  // client doesn't mark Q3 or another client as done.
  const progressKey = `${mode}:${clientId}:${year}:${mode === 'vat' ? period.key : 'annual'}`
  const isDone = (i: number) => !!checked[`${progressKey}:${i}`]
  const toggle = (i: number) =>
    setChecked((prev) => ({ ...prev, [`${progressKey}:${i}`]: !prev[`${progressKey}:${i}`] }))

  const periodTotals = useMemo(() => {
    if (!data) return null
    const inRange = data.months.filter((m) => m.m >= period.startMonth && m.m <= period.endMonth)
    const sum = (f: (m: FilingFigures['months'][number]) => number) =>
      round2(inRange.reduce((s, m) => s + f(m), 0))
    return { outVat: sum((m) => m.outVat), inVat: sum((m) => m.inVat), net: sum((m) => m.net), tips: sum((m) => m.tips) }
  }, [data, period])

  function figureFor(step: GuideStep): string | null {
    if (!step.figure || !data) return null
    const a = data.annual
    const p = periodTotals
    switch (step.figure) {
      case 'outputVat':         return p ? `${fmt(p.outVat)} €` : null
      case 'deductibleVat':     return p ? `${fmt(p.inVat)} €` : null
      case 'netVat':            return p ? `${fmt(p.net)} €` : null
      case 'zeroRatedTurnover': return p ? `${fmt(p.tips)} €` : null
      case 'turnover':          return `${fmt(a.turnover)} €`
      case 'expenses':          return `${fmt(a.taxDeductibleExpenses)} €`
      case 'depreciation':      return `${fmt(a.depreciation)} €`
      case 'taxableProfit':     return `${fmt(a.taxableProfit)} €`
      default:                  return null
    }
  }

  const steps = mode === 'vat' ? VAT_STEPS : ANNUAL_STEPS
  const doneCount = steps.filter((_, i) => isDone(i)).length
  const days = data ? daysUntil(period.dueDate) : null

  return (
    <div className="page">
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Filing Guide</h1>
          <p className="page-subtitle">
            Step-by-step OmaVero filing for a client, with their own figures against each field
          </p>
        </div>
        <div className="segmented shrink-0">
          {years.map((yr) => (
            <a key={yr} href={`/filing?year=${yr}`}
              className={`segmented-item ${yr === year ? 'segmented-item-active' : ''}`}>{yr}</a>
          ))}
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="card card-pad mb-5 flex flex-wrap items-end gap-4">
        <div className="field min-w-[220px]">
          <label htmlFor="filing-client">Client</label>
          <select id="filing-client" value={clientId ?? ''}
            onChange={(e) => setClientId(e.target.value ? Number(e.target.value) : null)}>
            {clients.length === 0 && <option value="">No clients</option>}
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.displayId} — {c.name}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>What are you filing?</label>
          <div className="segmented">
            {(['vat', 'annual'] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className={`segmented-item ${mode === m ? 'segmented-item-active' : ''}`}>
                {m === 'vat' ? 'VAT return' : 'Annual tax return'}
              </button>
            ))}
          </div>
        </div>

        {mode === 'vat' && (
          <div className="field">
            <label>Period</label>
            <div className="segmented">
              {periods.map((p) => (
                <button key={p.key} onClick={() => setPeriodKey(p.key)}
                  className={`segmented-item ${p.key === period.key ? 'segmented-item-active' : ''}`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="ml-auto text-right">
          <div className="text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-400">
            {mode === 'vat' ? 'Due' : 'Form 5 due'}
          </div>
          <div className={`text-[13px] font-semibold ${
            mode === 'vat' && days !== null && days < 0 ? 'text-rose-600' : 'text-slate-800'
          }`}>
            {mode === 'vat' ? formatDueDate(period.dueDate) : `1 April ${year + 1}`}
          </div>
        </div>
      </div>

      {/* ── Progress ── */}
      <div className="flex items-center justify-between mb-3">
        <div className="section-title">
          {mode === 'vat'
            ? `VAT return — ${period.label}${data ? ` · ${data.clientName}` : ''}`
            : `Business tax return (Form 5) — ${year}${data ? ` · ${data.clientName}` : ''}`}
        </div>
        <div className="text-[11px] text-slate-400">
          {doneCount} of {steps.length} done
        </div>
      </div>
      <div className="h-1 rounded-full bg-slate-200 overflow-hidden mb-4">
        <div className="h-full bg-emerald-500 transition-all duration-300"
          style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>

      {/* ── Steps ── */}
      {loading ? (
        <div className="card empty-state">Loading figures…</div>
      ) : (
        <div className="card overflow-hidden">
          <ol>
            {steps.map((step, i) => (
              <Step key={step.title} step={step} index={i} value={figureFor(step)}
                done={isDone(i)} onToggle={() => toggle(i)} />
            ))}
          </ol>
        </div>
      )}

      {/* ── Filing status ──
          Placed right after the steps: marking the period filed is the last
          thing you do, and afterwards this is where a divergence shows up. */}
      {mode === 'vat' && data && periodTotals && clientId !== null && (
        <FilingStatusPanel
          clientId={clientId}
          year={year}
          period={period}
          frequency={frequency}
          filing={filings.find((f) => f.periodKey === period.key) ?? null}
          totals={periodTotals}
          onChanged={() => setRefreshKey((k) => k + 1)}
        />
      )}

      {/* ── Rate note ── */}
      {mode === 'vat' && data && data.salesVatRates.length > 0 && (
        <div className="notice-info mt-4">
          Sales in {data.clientName}&apos;s books for {year} use{' '}
          <strong>{data.salesVatRates.map((r) => `${r}%`).join(' and ')}</strong>
          {data.salesVatRates.length > 1
            ? ' — split the output VAT across those rate rows rather than entering one total.'
            : ' — the whole output VAT figure goes on that one rate row.'}
        </div>
      )}

      {/* ── Reference ──
          Folded away by default: it matters when something looks wrong, not
          on every visit. */}
      <details className="card mt-4 group">
        <summary className="card-header cursor-pointer list-none select-none">
          <div>
            <div className="card-title">Rates, thresholds and recent changes</div>
            <div className="card-hint">Checked against vero.fi on {VERIFIED_ON}</div>
          </div>
          <span className="text-slate-400 text-[12px] group-open:hidden">Show</span>
          <span className="text-slate-400 text-[12px] hidden group-open:inline">Hide</span>
        </summary>

        <div className="px-5 py-4 border-t border-slate-200/70 space-y-5">
          <div>
            <div className="section-title mb-2">Watch out for these — the rules changed</div>
            <ul className="space-y-2">
              {RECENT_CHANGES.map((c) => (
                <li key={c.what} className="text-[12px]">
                  <span className="font-semibold text-slate-800">{c.what}.</span>{' '}
                  <span className="text-slate-500">{c.detail}</span>{' '}
                  <a href={SOURCES[c.source]} target="_blank" rel="noreferrer"
                    className="text-indigo-600 hover:underline whitespace-nowrap">vero.fi ↗</a>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="section-title mb-2">VAT rates</div>
              <ul className="space-y-1.5">
                {VAT_RATES.map((r) => (
                  <li key={`${r.rate}-${r.label}`} className="text-[12px] flex gap-2">
                    <span className="font-semibold text-slate-800 tabular-nums w-12 shrink-0">{r.rate}%</span>
                    <span className="text-slate-500">{r.note}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="section-title mb-2">Thresholds &amp; deadlines</div>
              <ul className="space-y-1.5 text-[12px]">
                <li className="flex justify-between gap-3">
                  <span className="text-slate-500">VAT registration required above</span>
                  <span className="font-semibold text-slate-800 tabular-nums">{THRESHOLDS.vatRegistration.toLocaleString('fi-FI')} €</span>
                </li>
                <li className="flex justify-between gap-3">
                  <span className="text-slate-500">Quarterly VAT period up to</span>
                  <span className="font-semibold text-slate-800 tabular-nums">{THRESHOLDS.quarterlyPeriod.toLocaleString('fi-FI')} €</span>
                </li>
                <li className="flex justify-between gap-3">
                  <span className="text-slate-500">Annual VAT period up to</span>
                  <span className="font-semibold text-slate-800 tabular-nums">{THRESHOLDS.annualPeriod.toLocaleString('fi-FI')} €</span>
                </li>
                <li className="flex justify-between gap-3">
                  <span className="text-slate-500">VAT return &amp; payment</span>
                  <span className="font-semibold text-slate-800">12th of 2nd month after</span>
                </li>
                <li className="flex justify-between gap-3">
                  <span className="text-slate-500">Business tax return (Form 5)</span>
                  <span className="font-semibold text-slate-800">1 April</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </details>

      <p className="text-[11px] text-slate-400 mt-4">
        Finnish tax rules change most years — check the linked vero.fi pages before relying on a step. Not tax advice.
      </p>
    </div>
  )
}
