'use client'

import { useState, useTransition, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency as fmt, round2 } from '@/lib/calculations'
import { createOwnerIncomePeriod } from '@/actions/owner-books'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

const VAT_RATES = ['25.5', '13.5', '10', '0']

type Client = { id: number; displayId: string; name: string }

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** First and last day of a month, as ISO date strings. */
function monthBounds(year: number, month: number) {
  return { start: iso(new Date(year, month, 1)), end: iso(new Date(year, month + 1, 0)) }
}

export default function AddIncomeDialog({ clients, year, defaultClientId, onClose }: {
  clients: Client[]
  year: number
  defaultClientId: number | null
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  // Default to the month just gone — that is the one being entered in practice.
  const lastMonth = new Date()
  lastMonth.setMonth(lastMonth.getMonth() - 1)
  const defaultMonth = lastMonth.getFullYear() === year ? lastMonth.getMonth() : 0

  const [clientId, setClientId] = useState<number | null>(defaultClientId ?? clients[0]?.id ?? null)
  const [month, setMonth] = useState(defaultMonth)
  const [customDates, setCustomDates] = useState(false)
  const [periodStart, setPeriodStart] = useState(monthBounds(year, defaultMonth).start)
  const [periodEnd, setPeriodEnd] = useState(monthBounds(year, defaultMonth).end)
  const [woltInvoiceRef, setWoltInvoiceRef] = useState('')
  const [totalExVat, setTotalExVat] = useState('')
  const [vatRate, setVatRate] = useState('25.5')
  const [vatOverride, setVatOverride] = useState('')
  const [tipsExVat, setTipsExVat] = useState('')
  const [description, setDescription] = useState('')

  // Keep the period in step with the month unless dates were set by hand.
  useEffect(() => {
    if (customDates) return
    const b = monthBounds(year, month)
    setPeriodStart(b.start)
    setPeriodEnd(b.end)
  }, [month, year, customDates])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const fees = parseFloat(totalExVat) || 0
  const tips = parseFloat(tipsExVat) || 0
  const rate = parseFloat(vatRate) || 0
  const computedVat = round2(fees * rate / 100)
  const vatEntered = vatOverride.trim() !== '' ? parseFloat(vatOverride) : null
  const vat = vatEntered !== null && Number.isFinite(vatEntered) ? round2(vatEntered) : computedVat
  const payout = round2(fees + vat + tips)

  // Wolt rounds per line, so a cent or two of drift is normal and the stated
  // figure wins. A larger gap usually means a typo in the fees box.
  const drift = round2(Math.abs(vat - computedVat))
  const driftWarning = vatEntered !== null && drift > 0.05

  const selectedClient = useMemo(() => clients.find((c) => c.id === clientId), [clients, clientId])

  function save(addAnother: boolean) {
    setError(null)
    if (!clientId) return setError('Choose a client.')
    if (!totalExVat.trim()) return setError('Enter the fees excluding VAT, as shown on the self-billing invoice.')
    if (fees < 0 || tips < 0) return setError('Amounts cannot be negative.')
    if (periodEnd < periodStart) return setError('The period end cannot fall before the period start.')

    startTransition(async () => {
      try {
        await createOwnerIncomePeriod({
          clientId,
          periodStart,
          periodEnd,
          woltInvoiceRef: woltInvoiceRef.trim() || undefined,
          description: description.trim() || undefined,
          totalExVat: fees,
          tipsExVat: tips,
          vatRate: rate,
          vatAmount: vatEntered !== null && Number.isFinite(vatEntered) ? vatEntered : undefined,
        })
        router.refresh()
        if (addAnother) {
          // Keep client and rate, advance the month, clear the amounts.
          setMonth((m) => (m + 1) % 12)
          setWoltInvoiceRef(''); setTotalExVat(''); setVatOverride('')
          setTipsExVat(''); setDescription('')
        } else {
          onClose()
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save the entry.')
      }
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] flex items-start justify-center p-6 overflow-y-auto"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Add income entry"
        className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl mt-8">

        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-900">Add income entry</h2>
            <p className="text-[11.5px] text-slate-500 mt-0.5">
              Copy the figures from the platform&apos;s self-billing invoice for the period
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="btn-ghost btn-sm">✕</button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {error && <div className="notice-error">{error}</div>}

          {/* Client + period */}
          <div className="grid grid-cols-3 gap-3">
            <div className="field col-span-1">
              <label htmlFor="inc-client">Client</label>
              <select id="inc-client" value={clientId ?? ''}
                onChange={(e) => setClientId(e.target.value ? Number(e.target.value) : null)}>
                {clients.length === 0 && <option value="">No clients</option>}
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.displayId} — {c.name}</option>
                ))}
              </select>
            </div>
            <div className="field col-span-1">
              <label htmlFor="inc-month">Month</label>
              <select id="inc-month" value={month} disabled={customDates}
                onChange={(e) => setMonth(Number(e.target.value))}>
                {MONTHS.map((m, i) => <option key={m} value={i}>{m} {year}</option>)}
              </select>
            </div>
            <div className="field col-span-1">
              <label htmlFor="inc-ref">Self-billing invoice ref</label>
              <input id="inc-ref" type="text" placeholder="FIN/26/XXXXXXX/1/1"
                value={woltInvoiceRef} onChange={(e) => setWoltInvoiceRef(e.target.value)} />
            </div>
          </div>

          {/* Period dates */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-[11.5px] text-slate-500 cursor-pointer">
              <input type="checkbox" checked={customDates}
                onChange={(e) => setCustomDates(e.target.checked)} />
              Set exact period dates
            </label>
            {customDates ? (
              <div className="flex items-center gap-2">
                <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)}
                  className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-[13px]" />
                <span className="text-slate-400 text-[12px]">to</span>
                <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)}
                  className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-[13px]" />
              </div>
            ) : (
              <span className="text-[11.5px] text-slate-400">
                {periodStart} → {periodEnd} · determines the VAT period
              </span>
            )}
          </div>

          {/* Amounts */}
          <div className="grid grid-cols-4 gap-3">
            <div className="field">
              <label htmlFor="inc-fees">Fees excl. VAT (€)</label>
              <input id="inc-fees" type="number" step="0.01" min="0" placeholder="0.00"
                value={totalExVat} onChange={(e) => setTotalExVat(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="inc-rate">VAT rate</label>
              <select id="inc-rate" value={vatRate} onChange={(e) => setVatRate(e.target.value)}>
                {VAT_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="inc-vat">VAT amount (€)</label>
              <input id="inc-vat" type="number" step="0.01" min="0"
                placeholder={fmt(computedVat)}
                value={vatOverride} onChange={(e) => setVatOverride(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="inc-tips">Tips (€) — 0% VAT</label>
              <input id="inc-tips" type="number" step="0.01" min="0" placeholder="0.00"
                value={tipsExVat} onChange={(e) => setTipsExVat(e.target.value)} />
            </div>
          </div>

          <p className="text-[11px] text-slate-400 -mt-1">
            Leave the VAT amount blank to calculate it from the rate. Fill it in to match the
            invoice exactly when the platform&apos;s own rounding differs.
          </p>

          {driftWarning && (
            <div className="notice-warn">
              The VAT you entered is {fmt(drift)} € away from {fmt(computedVat)} € at {rate}%.
              That is more than rounding — check the fees and VAT figures against the invoice.
            </div>
          )}

          <div className="field">
            <label htmlFor="inc-desc">Description (optional)</label>
            <input id="inc-desc" type="text" placeholder={`e.g. ${MONTHS[month]} courier fees`}
              value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          {/* Running total */}
          {(fees > 0 || tips > 0) && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] font-mono tabular-nums">
              <span className="text-slate-500">Fees {fmt(fees)}</span>
              <span className="text-slate-500">+ VAT {fmt(vat)}</span>
              {tips > 0 && <span className="text-slate-500">+ Tips {fmt(tips)}</span>}
              <span className="ml-auto font-semibold text-slate-900">
                Payout {fmt(payout)} €
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 flex items-center justify-between gap-3">
          <div className="text-[11px] text-slate-400 truncate">
            {selectedClient ? `Saving to ${selectedClient.name}'s books` : 'Choose a client'}
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={onClose} className="btn-secondary" disabled={pending}>Cancel</button>
            <button onClick={() => save(true)} className="btn-secondary" disabled={pending}>
              Save &amp; add another
            </button>
            <button onClick={() => save(false)} className="btn-primary" disabled={pending}>
              {pending ? 'Saving…' : 'Save entry'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
