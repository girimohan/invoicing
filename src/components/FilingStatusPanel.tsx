'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency as fmt } from '@/lib/calculations'
import { formatDueDate, type VatPeriodBounds } from '@/lib/vat-deadlines'
import { assessCorrection, correctionAdvice } from '@/lib/vat-filing'
import {
  recordVatFiling, deleteVatFiling, type VatFilingRecord,
} from '@/actions/vat-filing'

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function FilingStatusPanel({
  clientId, year, period, frequency, filing, totals, onChanged,
}: {
  clientId: number
  year: number
  period: VatPeriodBounds
  frequency: string
  filing: VatFilingRecord | null
  totals: { outVat: number; inVat: number; net: number }
  /** Called after the filing record changes, so the caller can refetch. */
  onChanged: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [filedOn, setFiledOn] = useState(todayIso())
  const [error, setError] = useState<string | null>(null)

  function markFiled() {
    setError(null)
    startTransition(async () => {
      try {
        await recordVatFiling({
          clientId, year,
          periodKey: period.key,
          frequency,
          periodStart: isoDate(new Date(year, period.startMonth, 1)),
          periodEnd: isoDate(new Date(year, period.endMonth + 1, 0)),
          dueDate: isoDate(period.dueDate),
          filedOn,
          outputVat: totals.outVat,
          deductibleVat: totals.inVat,
          netVat: totals.net,
        })
        onChanged()
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save the filing record.')
      }
    })
  }

  function undo() {
    if (!confirm(`Remove the filing record for ${period.label}? The books themselves are untouched.`)) return
    setError(null)
    startTransition(async () => {
      try {
        await deleteVatFiling(clientId, year, period.key)
        onChanged()
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not remove the filing record.')
      }
    })
  }

  // ── Not filed yet ──────────────────────────────────────────────────────────
  if (!filing) {
    return (
      <div className="card card-pad mt-4">
        {error && <div className="notice-error mb-3">{error}</div>}
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="card-title">Mark {period.label} as filed</div>
            <div className="card-hint">
              Record what you submitted, so a later entry that changes these months is caught.
              Net VAT to be recorded: <strong className="font-mono">{fmt(totals.net)} €</strong>
            </div>
          </div>
          <div className="flex items-end gap-2 shrink-0">
            <div className="field">
              <label htmlFor="filed-on">Filed on</label>
              <input id="filed-on" type="date" value={filedOn} onChange={(e) => setFiledOn(e.target.value)} />
            </div>
            <button onClick={markFiled} className="btn-primary" disabled={pending}>
              {pending ? 'Saving…' : 'Mark as filed'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Filed — compare against what the books say now ─────────────────────────
  const assessment = assessCorrection(
    { netVat: filing.netVat, filedOn: new Date(filing.filedOn), dueDate: new Date(filing.dueDate), year },
    totals.net,
  )
  const advice = correctionAdvice(assessment, period.label)
  const matches = assessment.route === 'none'

  return (
    <div className={`card card-pad mt-4 ${
      matches ? '' : assessment.route === 'replacement' ? 'border-rose-300' : 'border-amber-300'
    }`}>
      {error && <div className="notice-error mb-3">{error}</div>}

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={matches ? 'pill-success' : assessment.route === 'replacement' ? 'pill-danger' : 'pill-warn'}>
              {matches ? 'filed' : 'changed since filed'}
            </span>
            <span className="text-[12px] text-slate-500">
              {period.label} filed {formatDueDate(new Date(filing.filedOn))}
            </span>
          </div>

          <p className={`text-[12px] leading-relaxed mt-2 ${matches ? 'text-slate-500' : 'text-slate-700'}`}>
            {advice}
          </p>

          {!matches && (
            <div className="mt-2.5 flex gap-5 text-[12px] font-mono tabular-nums">
              <span className="text-slate-500">Filed <strong className="text-slate-700">{fmt(filing.netVat)} €</strong></span>
              <span className="text-slate-500">Books now <strong className="text-slate-700">{fmt(totals.net)} €</strong></span>
              <span className={assessment.difference > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                {assessment.difference > 0 ? '+' : ''}{fmt(assessment.difference)} €
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <button onClick={undo} className="btn-ghost btn-sm" disabled={pending}>
            Remove record
          </button>
          {!matches && !assessment.expired && (
            <button onClick={markFiled} className="btn-secondary btn-sm" disabled={pending}>
              {pending ? 'Saving…' : 'Re-filed — update record'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
