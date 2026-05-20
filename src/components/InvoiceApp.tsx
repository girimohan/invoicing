'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { saveInvoice, updateInvoice } from '@/actions/invoice'
import { getClients, createClient, type ClientRole } from '@/actions/client'
import { calculateInvoice } from '@/lib/calculations'
import InvoicePreview from './InvoicePreview'
import type { FormState, LineItemRow, InvoiceInput } from '@/types/invoice'

type EditInvoice = {
  id: string
  invoiceNumber: string
  invoiceDate: Date
  dueDate: Date
  paymentTerms: string
  periodStart: Date
  periodEnd: Date
  woltInvoiceNumber: string | null
  woltInvoiceDate: Date | null
  sellerName: string
  sellerAddress: string
  sellerPostalCode: string
  sellerCity: string
  sellerBusinessId: string
  sellerVatId: string
  sellerIban: string
  sellerBic: string
  sellerEmail: string | null
  sellerPhone: string | null
  buyerName: string
  buyerAddress: string
  buyerPostalCode: string
  buyerCity: string
  buyerBusinessId: string
  buyerVatId: string
  notes: string | null
  clientId: number | null
  lineItems: {
    id: string
    description: string
    earnedAmount: number
    sharePercent: number
    vatRate: number
    amountExVat: number
    vatAmount: number
    totalAmount: number
    sortOrder: number
  }[]
}

type ClientOption = {
  id: number
  displayId: string
  role: string
  name: string
  businessId: string | null
  vatId: string | null
  address: string | null
  postalCode: string | null
  city: string | null
  email: string | null
  phone: string | null
  iban?: string | null
  bic?: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

// (profiles now stored in DB — see Clients page)

function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

const defaultLineItems: LineItemRow[] = [
  { id: '1', description: 'Wolt Courier Fees', earnedAmount: '', sharePercent: '75', vatRate: '25.5' },
  { id: '2', description: 'Tips', earnedAmount: '', sharePercent: '100', vatRate: '0' },
  { id: '3', description: 'Others (if any)', earnedAmount: '', sharePercent: '75', vatRate: '25.5' },
]

function toDateStr(d: Date | string | null | undefined): string {
  if (!d) return ''
  return new Date(d).toISOString().split('T')[0]
}

function buildEditForm(inv: EditInvoice): FormState {
  return {
    invoiceNumber: inv.invoiceNumber,
    invoiceDate: toDateStr(inv.invoiceDate),
    dueDate: toDateStr(inv.dueDate),
    paymentTerms: inv.paymentTerms,
    periodStart: toDateStr(inv.periodStart),
    periodEnd: toDateStr(inv.periodEnd),
    woltInvoiceNumber: inv.woltInvoiceNumber ?? '',
    woltInvoiceDate: toDateStr(inv.woltInvoiceDate),
    sellerName: inv.sellerName,
    sellerAddress: inv.sellerAddress,
    sellerPostalCode: inv.sellerPostalCode,
    sellerCity: inv.sellerCity,
    sellerBusinessId: inv.sellerBusinessId,
    sellerVatId: inv.sellerVatId,
    sellerIban: inv.sellerIban,
    sellerBic: inv.sellerBic,
    sellerEmail: inv.sellerEmail ?? '',
    sellerPhone: inv.sellerPhone ?? '',
    buyerName: inv.buyerName,
    buyerAddress: inv.buyerAddress,
    buyerPostalCode: inv.buyerPostalCode,
    buyerCity: inv.buyerCity,
    buyerBusinessId: inv.buyerBusinessId,
    buyerVatId: inv.buyerVatId,
    notes: inv.notes ?? '',
  }
}

function buildInitialForm(invoiceNumber: string): FormState {
  const today = todayIso()
  return {
    invoiceNumber,
    invoiceDate: today,
    dueDate: addDays(today, 14),
    paymentTerms: '14 pv netto / 14 days net',
    periodStart: '',
    periodEnd: '',
    woltInvoiceNumber: '',
    woltInvoiceDate: '',
    sellerName: '',
    sellerAddress: '',
    sellerPostalCode: '',
    sellerCity: '',
    sellerBusinessId: '',
    sellerVatId: '',
    sellerIban: '',
    sellerBic: '',
    sellerEmail: '',
    sellerPhone: '',
    buyerName: '',
    buyerAddress: '',
    buyerPostalCode: '',
    buyerCity: '',
    buyerBusinessId: '',
    buyerVatId: '',
    notes: '',
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InvoiceApp({
  initialInvoiceNumber,
  editInvoice = null,
}: {
  initialInvoiceNumber: string
  editInvoice?: EditInvoice | null
}) {
  const [form, setForm] = useState<FormState>(() =>
    editInvoice ? buildEditForm(editInvoice) : buildInitialForm(initialInvoiceNumber)
  )
  const [lineItems, setLineItems] = useState<LineItemRow[]>(() =>
    editInvoice
      ? editInvoice.lineItems.map((li) => ({
          id: li.id,
          description: li.description,
          earnedAmount: String(li.earnedAmount),
          sharePercent: String(li.sharePercent),
          vatRate: String(li.vatRate),
        }))
      : defaultLineItems
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const profileSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ahProfileSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── All clients split by role ──
  const [allClients, setAllClients] = useState<ClientOption[]>([])
  const [selectedWorkerId, setSelectedWorkerId] = useState<number | null>(null)
  const [selectedHolderId, setSelectedHolderId] = useState<number | null>(null)
  const [invoiceSeq, setInvoiceSeq] = useState<'1' | '2'>('1')
  const [workerSaving, setWorkerSaving] = useState(false)
  const [holderSaving, setHolderSaving] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [ahProfileSaved, setAhProfileSaved] = useState(false)

  const workers = allClients.filter((c) => c.role === 'SUBSTITUTE_WORKER')
  const holders = allClients.filter((c) => c.role === 'ACCOUNT_HOLDER')

  // ── Load clients from DB on mount ──
  useEffect(() => {
    getClients().then((list) => {
      setAllClients(list as ClientOption[])
      // If no worker is selected yet, set invoice number from next client ID
      if (selectedWorkerId === null) {
        const ids = (list as ClientOption[]).map((c) => parseInt(c.displayId, 10) || 100)
        const nextId = ids.length === 0 ? '101' : String(Math.max(...ids) + 1)
        const yyyymm = new Date().toISOString().slice(0, 7).replace('-', '')
        setForm((prev) => ({
          ...prev,
          invoiceNumber: `BB-${nextId}-${yyyymm}-${invoiceSeq}`,
        }))
      }
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Auto-calculate due date when invoice date changes ──
  useEffect(() => {
    if (form.invoiceDate) {
      setForm((prev) => ({ ...prev, dueDate: addDays(form.invoiceDate, 14) }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.invoiceDate])

  // ── Computed totals ──
  const calculated = useMemo(() => calculateInvoice(lineItems), [lineItems])

  // ── Handlers ──
  const handleChange = useCallback(
    (field: keyof FormState, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }))
    },
    []
  )

  const handleLineItemChange = useCallback(
    (id: string, field: keyof LineItemRow, value: string) => {
      setLineItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
      )
    },
    []
  )

  const addLineItem = useCallback(() => {
    setLineItems((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        description: '',
        earnedAmount: '',
        sharePercent: '75',
        vatRate: '25.5',
      },
    ])
  }, [])

  const removeLineItem = useCallback((id: string) => {
    setLineItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  // ── Save current seller fields as a Substitute Worker client in DB ──
  const saveWorkerToDb = useCallback(async () => {
    if (!form.sellerName) return
    setWorkerSaving(true)
    try {
      const nextId = allClients.length === 0
        ? '101'
        : String(Math.max(...allClients.map((c) => parseInt(c.displayId, 10) || 100)) + 1)
      const created = await createClient({
        displayId: nextId,
        role: 'SUBSTITUTE_WORKER' as ClientRole,
        name: form.sellerName,
        businessId: form.sellerBusinessId,
        vatId: form.sellerVatId,
        address: form.sellerAddress,
        postalCode: form.sellerPostalCode,
        city: form.sellerCity,
        email: form.sellerEmail,
        phone: form.sellerPhone,
        iban: form.sellerIban,
        bic: form.sellerBic,
      })
      setAllClients((prev) => [...prev, created as ClientOption])
      setSelectedWorkerId(created.id)
      setProfileSaved(true)
      if (profileSavedTimer.current) clearTimeout(profileSavedTimer.current)
      profileSavedTimer.current = setTimeout(() => setProfileSaved(false), 2500)
    } catch { /* ignore */ } finally {
      setWorkerSaving(false)
    }
  }, [form, allClients])

  // ── Save current buyer fields as an Account Holder client in DB ──
  const saveHolderToDb = useCallback(async () => {
    if (!form.buyerName) return
    setHolderSaving(true)
    try {
      const nextId = allClients.length === 0
        ? '101'
        : String(Math.max(...allClients.map((c) => parseInt(c.displayId, 10) || 100)) + 1)
      const created = await createClient({
        displayId: nextId,
        role: 'ACCOUNT_HOLDER' as ClientRole,
        name: form.buyerName,
        businessId: form.buyerBusinessId,
        vatId: form.buyerVatId,
        address: form.buyerAddress,
        postalCode: form.buyerPostalCode,
        city: form.buyerCity,
      })
      setAllClients((prev) => [...prev, created as ClientOption])
      setSelectedHolderId(created.id)
      setAhProfileSaved(true)
      if (ahProfileSavedTimer.current) clearTimeout(ahProfileSavedTimer.current)
      ahProfileSavedTimer.current = setTimeout(() => setAhProfileSaved(false), 2500)
    } catch { /* ignore */ } finally {
      setHolderSaving(false)
    }
  }, [form, allClients])

  // ── Select a substitute worker → fill seller fields ──
  // ── Select a substitute worker → fill seller fields + generate invoice number ──
  const selectWorker = useCallback((clientId: number | null) => {
    setSelectedWorkerId(clientId)
    if (clientId === null) return
    const c = workers.find((w) => w.id === clientId)
    if (!c) return
    const yyyymm = new Date().toISOString().slice(0, 7).replace('-', '')
    setForm((prev) => ({
      ...prev,
      sellerName: c.name,
      sellerAddress: c.address ?? '',
      sellerPostalCode: c.postalCode ?? '',
      sellerCity: c.city ?? '',
      sellerBusinessId: c.businessId ?? '',
      sellerVatId: c.vatId ?? '',
      sellerIban: c.iban ?? '',
      sellerBic: c.bic ?? '',
      sellerEmail: c.email ?? '',
      sellerPhone: c.phone ?? '',
      invoiceNumber: `BB-${c.displayId}-${yyyymm}-${invoiceSeq}`,
    }))
  }, [workers, invoiceSeq])

  // ── Select an account holder → fill buyer fields only ──
  const selectHolder = useCallback((clientId: number | null, seq: '1' | '2') => {
    setSelectedHolderId(clientId)
    setInvoiceSeq(seq)
    if (clientId === null) return
    const c = holders.find((h) => h.id === clientId)
    if (!c) return
    setForm((prev) => ({
      ...prev,
      buyerName: c.name,
      buyerAddress: c.address ?? '',
      buyerPostalCode: c.postalCode ?? '',
      buyerCity: c.city ?? '',
      buyerBusinessId: c.businessId ?? '',
      buyerVatId: c.vatId ?? '',
    }))
  }, [holders])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Basic validation
    const required: [keyof FormState, string][] = [
      ['invoiceNumber', 'Invoice number'],
      ['invoiceDate', 'Invoice date'],
      ['dueDate', 'Due date'],
      ['periodStart', 'Period start'],
      ['periodEnd', 'Period end'],
      ['sellerName', 'Seller name'],
      ['sellerBusinessId', 'Seller Business ID (Y-tunnus)'],
      ['sellerVatId', 'Seller VAT ID'],
      ['sellerIban', 'IBAN'],
      ['sellerBic', 'BIC'],
    ]
    for (const [field, label] of required) {
      if (!form[field]) {
        setError(`${label} is required.`)
        return
      }
    }
    if (lineItems.length === 0) {
      setError('At least one line item is required.')
      return
    }
    // Filter out completely blank rows (users often leave "Others" empty)
    const filledItems = lineItems.filter(
      (item) => item.description.trim() || item.earnedAmount.trim()
    )
    if (filledItems.length === 0) {
      setError('At least one line item with a description and earned amount is required.')
      return
    }
    for (const item of filledItems) {
      if (!item.description.trim()) {
        setError(`A line item with amount "${item.earnedAmount}" is missing a description.`)
        return
      }
      if (!item.earnedAmount.trim()) {
        setError(`Line item "${item.description}" is missing an earned amount.`)
        return
      }
    }

    setSubmitting(true)
    try {
      const invoiceData: InvoiceInput = {
        ...form,
        totalExVat: calculated.totalExVat,
        totalVat: calculated.totalVat,
        totalIncVat: calculated.totalIncVat,
        workerId: selectedWorkerId ?? null,
        buyerClientId: selectedHolderId ?? null,
        lineItems: filledItems.map((item) => {
          const idx = lineItems.indexOf(item)
          return {
            id: item.id,
            description: item.description,
            earnedAmount: parseFloat(item.earnedAmount) || 0,
            sharePercent: parseFloat(item.sharePercent) ?? 100,
            vatRate: parseFloat(item.vatRate) || 0,
            amountExVat: calculated.lineItems[idx]?.amountExVat ?? 0,
            vatAmount: calculated.lineItems[idx]?.vatAmount ?? 0,
            totalAmount: calculated.lineItems[idx]?.totalAmount ?? 0,
            sortOrder: idx,
          }
        }),
      }

      const { id } = editInvoice
        ? await updateInvoice(editInvoice.id, invoiceData)
        : await saveInvoice(invoiceData)

      // Trigger PDF download
      const link = document.createElement('a')
      link.href = `/api/invoice/${id}/pdf`
      link.download = `invoice-${form.invoiceNumber}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      if (editInvoice) {
        window.location.href = '/invoices'
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save invoice.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Input helpers ──
  const inp = (
    field: keyof FormState,
    opts?: { required?: boolean; type?: string; placeholder?: string; readOnly?: boolean }
  ) => (
    <input
      type={opts?.type ?? 'text'}
      value={form[field]}
      onChange={(e) => handleChange(field, e.target.value)}
      required={opts?.required}
      placeholder={opts?.placeholder}
      readOnly={opts?.readOnly}
      className={opts?.readOnly ? 'readonly' : ''}
    />
  )

  const fc = (label: string, input: React.ReactNode) => (
    <div className="field">
      <label>{label}</label>
      {input}
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-32px)] overflow-hidden">
      {/* ── LEFT PANEL: Entry Form ── */}
      <div className="w-[55%] overflow-y-auto bg-white">
        <form onSubmit={handleSubmit} noValidate>
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
            <h1 className="font-bold text-base">
              {editInvoice ? `Editing: ${editInvoice.invoiceNumber}` : 'New Substitute Invoice'}
            </h1>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="bg-blue-700 text-white text-xs px-4 py-1.5 rounded font-semibold hover:bg-blue-800 disabled:opacity-50"
              >
                {submitting
                  ? (editInvoice ? 'Updating…' : 'Generating…')
                  : (editInvoice ? 'Update & Re-download PDF' : 'Generate Invoice (PDF)')}
              </button>
            </div>
          </div>

          {error && (
            <div className="mx-6 mt-3 text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded">
              {error}
            </div>
          )}

          <div className="px-6 py-4 space-y-6">

            {/* ── Step 1: Select Parties & Invoice Number ── */}
            <div className="form-section">
              <div className="form-section-title">Step 1 — Select Parties</div>

              {/* Worker + Holder selectors side by side */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {/* Worker selector */}
                <div className="bg-purple-50 border border-purple-100 rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-purple-700">Substitute Worker (Invoice From)</span>
                    <a href="/clients" target="_blank" className="text-[10px] text-purple-500 hover:underline">Manage →</a>
                  </div>
                  <select
                    className="w-full border border-purple-200 rounded px-2 py-1.5 text-xs bg-white"
                    value={selectedWorkerId ?? ''}
                    onChange={(e) => {
                      const val = e.target.value
                      selectWorker(val === '' ? null : parseInt(val, 10))
                    }}
                  >
                    <option value="">— select or fill below —</option>
                    {workers.map((c) => (
                      <option key={c.id} value={c.id}>{c.displayId} — {c.name}</option>
                    ))}
                  </select>
                  {workers.length === 0 && (
                    <p className="text-[10px] text-purple-400 mt-1">No workers yet. Fill details below and save.</p>
                  )}
                </div>

                {/* Holder selector */}
                <div className="bg-green-50 border border-green-100 rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-green-700">Account Holder (Invoice To)</span>
                    <a href="/clients" target="_blank" className="text-[10px] text-green-600 hover:underline">Manage →</a>
                  </div>
                  <select
                    className="w-full border border-green-200 rounded px-2 py-1.5 text-xs bg-white"
                    value={selectedHolderId ?? ''}
                    onChange={(e) => {
                      const val = e.target.value
                      selectHolder(val === '' ? null : parseInt(val, 10), invoiceSeq)
                    }}
                  >
                    <option value="">— select or fill below —</option>
                    {holders.map((c) => (
                      <option key={c.id} value={c.id}>{c.displayId} — {c.name}</option>
                    ))}
                  </select>
                  {holders.length === 0 && (
                    <p className="text-[10px] text-green-500 mt-1">No account holders yet. Fill details below and save.</p>
                  )}
                </div>
              </div>

              {/* Invoice Number — auto-generated from holder selection */}
              <div className="bg-blue-50 border border-blue-200 rounded p-3 flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-[10px] font-semibold text-blue-700 mb-1 uppercase tracking-wide">
                    Invoice Number {selectedWorkerId ? '(auto-generated from worker)' : ''}
                  </label>
                  <input
                    type="text"
                    value={form.invoiceNumber}
                    onChange={(e) => handleChange('invoiceNumber', e.target.value)}
                      placeholder="Auto-generated — you can type to override"
                    className="w-full border border-blue-300 rounded px-2 py-1.5 text-sm font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-blue-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-blue-700 mb-1">Invoice Sequence</label>
                  <select
                    className="border border-blue-200 rounded px-2 py-1.5 text-xs bg-white"
                    value={invoiceSeq}
                    onChange={(e) => {
                      const seq = e.target.value as '1' | '2'
                      setInvoiceSeq(seq)
                      if (selectedWorkerId !== null) {
                        const c = workers.find((w) => w.id === selectedWorkerId)
                        if (c) setForm((prev) => ({
                          ...prev,
                          invoiceNumber: `BB-${c.displayId}-${new Date().toISOString().slice(0, 7).replace('-', '')}-${seq}`,
                        }))
                      } else {
                        const ids = allClients.map((c) => parseInt(c.displayId, 10) || 100)
                        const nextId = ids.length === 0 ? '101' : String(Math.max(...ids) + 1)
                        const yyyymm = new Date().toISOString().slice(0, 7).replace('-', '')
                        setForm((prev) => ({
                          ...prev,
                          invoiceNumber: `BB-${nextId}-${yyyymm}-${seq}`,
                        }))
                      }
                    }}
                  >
                    <option value="1">1st invoice (mid-month)</option>
                    <option value="2">2nd invoice (end-month)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ── Step 2: Invoice Dates & Period ── */}
            <div className="form-section">
              <div className="form-section-title">Step 2 — Invoice Dates & Period</div>
              <div className="grid grid-cols-2 gap-3">
                {fc('Invoice Date *', inp('invoiceDate', { required: true, type: 'date' }))}
                {fc('Due Date *', inp('dueDate', { required: true, type: 'date' }))}
                {fc('Payment Terms', inp('paymentTerms'))}
                <div /> {/* spacer */}
                {fc('Period Start *', inp('periodStart', { required: true, type: 'date' }))}
                {fc('Period End *', inp('periodEnd', { required: true, type: 'date' }))}
              </div>
            </div>

            {/* ── Wolt Reference (internal only, not on invoice) ── */}
            <div className="form-section">
              <div className="form-section-title">Wolt Self-Billing Reference <span className="normal-case font-normal text-gray-400">(internal record only — not printed on invoice)</span></div>
              <div className="grid grid-cols-2 gap-3">
                {fc('Wolt Invoice Number', inp('woltInvoiceNumber', { placeholder: 'e.g. FIN/26/3111862-6/1/1' }))}
                {fc('Wolt Invoice Date', inp('woltInvoiceDate', { type: 'date' }))}
              </div>
            </div>

            {/* ── Seller (Substitute Worker) ── */}
            <div className="form-section">
              <div className="form-section-title">Seller — Substitute Worker Details</div>
              <div className="grid grid-cols-1 gap-3">
                {fc('Full Name / Company Name *', inp('sellerName', { required: true }))}
                {fc('Street Address *', inp('sellerAddress', { required: true }))}
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                {fc('Postal Code *', inp('sellerPostalCode', { required: true, placeholder: '00100' }))}
                {fc('City *', inp('sellerCity', { required: true }))}
                {fc('Business ID (Y-tunnus) *', inp('sellerBusinessId', { required: true, placeholder: '1234567-8' }))}
                {fc('VAT ID (ALV-tunnus) *', inp('sellerVatId', { required: true, placeholder: 'FI12345678' }))}
                {fc('IBAN *', inp('sellerIban', { required: true, placeholder: 'FI12 3456 7890 1234 56' }))}
                {fc('BIC/SWIFT *', inp('sellerBic', { required: true, placeholder: 'NDEAFIHH' }))}
                {fc('Email', inp('sellerEmail', { type: 'email' }))}
                {fc('Phone', inp('sellerPhone', { type: 'tel' }))}
              </div>
              <div className="mt-2 flex justify-end">
                {selectedWorkerId === null && (
                  <button type="button" onClick={saveWorkerToDb} disabled={workerSaving}
                    className="text-xs border border-purple-300 text-purple-700 px-3 py-1 rounded hover:bg-purple-50 disabled:opacity-50">
                    {profileSaved ? 'Saved ✓' : workerSaving ? 'Saving…' : '+ Save as Substitute Worker'}
                  </button>
                )}
                {selectedWorkerId !== null && (
                  <span className="text-xs text-purple-500 italic">Saved in clients ✓</span>
                )}
              </div>
            </div>

            {/* ── Account Holder (Invoice To) ── */}
            <div className="form-section">
              <div className="form-section-title">Buyer — Account Holder Details</div>
              <div className="grid grid-cols-1 gap-3">
                {fc('Full Name / Company Name *', inp('buyerName', { required: true, placeholder: 'e.g. Mohan Giri' }))}
                {fc('Street Address *', inp('buyerAddress', { required: true }))}
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                {fc('Postal Code *', inp('buyerPostalCode', { required: true }))}
                {fc('City *', inp('buyerCity', { required: true }))}
                {fc('Business ID (Y-tunnus) *', inp('buyerBusinessId', { required: true, placeholder: '1234567-8' }))}
                {fc('VAT ID (ALV-tunnus) *', inp('buyerVatId', { required: true, placeholder: 'FI12345678' }))}
              </div>
              <div className="mt-2 flex justify-end">
                {selectedHolderId === null && (
                  <button type="button" onClick={saveHolderToDb} disabled={holderSaving}
                    className="text-xs border border-green-400 text-green-700 px-3 py-1 rounded hover:bg-green-50 disabled:opacity-50">
                    {ahProfileSaved ? 'Saved ✓' : holderSaving ? 'Saving…' : '+ Save as Account Holder'}
                  </button>
                )}
                {selectedHolderId !== null && (
                  <span className="text-xs text-green-600 italic">Saved in clients ✓</span>
                )}
              </div>
            </div>

            {/* ── Line Items ── */}
            <div className="form-section">
              <div className="form-section-title">Line Items</div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="text-left p-2 border border-gray-200 font-medium">Description</th>
                      <th className="p-2 border border-gray-200 font-medium w-28 text-right">Earned (ex VAT) €</th>
                      <th className="p-2 border border-gray-200 font-medium w-20 text-right">Share %</th>
                      <th className="p-2 border border-gray-200 font-medium w-24 text-right">Claimed (ex VAT) €</th>
                      <th className="p-2 border border-gray-200 font-medium w-16">VAT %</th>
                      <th className="p-2 border border-gray-200 font-medium w-20 text-right">VAT €</th>
                      <th className="p-2 border border-gray-200 font-medium w-24 text-right">Total €</th>
                      <th className="p-2 border border-gray-200 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item, idx) => {
                      const c = calculated.lineItems[idx]
                      return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="p-1 border border-gray-200">
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => handleLineItemChange(item.id, 'description', e.target.value)}
                              className="w-full border-0 p-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 rounded"
                              placeholder="Description"
                            />
                          </td>
                          <td className="p-1 border border-gray-200">
                            <input
                              type="number"
                              value={item.earnedAmount}
                              onChange={(e) => handleLineItemChange(item.id, 'earnedAmount', e.target.value)}
                              className="w-full border-0 p-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400 rounded"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                            />
                          </td>
                          <td className="p-1 border border-gray-200">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={item.sharePercent}
                              onChange={(e) => handleLineItemChange(item.id, 'sharePercent', e.target.value)}
                              list="share-presets"
                              className="w-full border-0 p-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400 rounded"
                              placeholder="75"
                            />
                            <datalist id="share-presets">
                              <option value="100" />
                              <option value="80" />
                              <option value="75" />
                              <option value="50" />
                              <option value="25" />
                            </datalist>
                          </td>
                          <td className="p-1 border border-gray-200 text-right text-gray-600 pr-2 font-mono">
                            {c ? c.amountExVat.toFixed(2) : '0.00'}
                          </td>
                          <td className="p-1 border border-gray-200">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={item.vatRate}
                              onChange={(e) => handleLineItemChange(item.id, 'vatRate', e.target.value)}
                              list="vat-presets"
                              className="w-full border-0 p-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400 rounded"
                              placeholder="25.5"
                            />
                            <datalist id="vat-presets">
                              <option value="25.5" />
                              <option value="14" />
                              <option value="10" />
                              <option value="0" />
                            </datalist>
                          </td>
                          <td className="p-1 border border-gray-200 text-right text-gray-600 pr-2 font-mono">
                            {c ? c.vatAmount.toFixed(2) : '0.00'}
                          </td>
                          <td className="p-1 border border-gray-200 text-right font-medium pr-2 font-mono">
                            {c ? c.totalAmount.toFixed(2) : '0.00'}
                          </td>
                          <td className="p-1 border border-gray-200 text-center">
                            <button
                              type="button"
                              onClick={() => removeLineItem(item.id)}
                              className="text-red-400 hover:text-red-600 font-bold leading-none"
                              title="Remove line"
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                onClick={addLineItem}
                className="mt-2 text-xs text-blue-600 hover:underline"
              >
                + Add line item
              </button>
            </div>

            {/* ── Totals summary ── */}
            <div className="form-section">
              <div className="form-section-title">Totals (Auto-calculated)</div>
              <div className="bg-gray-50 border border-gray-200 rounded p-4 text-sm">
                {/* VAT breakdown */}
                {calculated.vatBreakdown.map((vb) => (
                  <div key={vb.rate} className="text-xs text-gray-500 mb-1">
                    <div className="flex justify-between">
                      <span>Turnover at {vb.rate}% VAT:</span>
                      <span>{vb.base.toFixed(2)} €</span>
                    </div>
                    <div className="flex justify-between">
                      <span>VAT {vb.rate}%:</span>
                      <span>{vb.vat.toFixed(2)} €</span>
                    </div>
                  </div>
                ))}
                <div className="border-t border-gray-300 pt-2 mt-2 space-y-1">
                  <div className="flex justify-between text-gray-600">
                    <span>Total excl. VAT:</span>
                    <span>{calculated.totalExVat.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Total VAT:</span>
                    <span>{calculated.totalVat.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between font-bold text-base border-t border-gray-400 pt-1 mt-1">
                    <span>Total incl. VAT:</span>
                    <span>{calculated.totalIncVat.toFixed(2)} €</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Notes ── */}
            <div className="form-section">
              <div className="form-section-title">Notes (optional)</div>
              <div className="field">
                <textarea
                  value={form.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  rows={3}
                  className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                  placeholder="Any additional notes or terms…"
                />
              </div>
            </div>

            {/* ── VAT Filing Data ── */}
            <div className="form-section">
              <div className="form-section-title">VAT Filing Data (this invoice)</div>
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-xs space-y-1">
                {calculated.vatBreakdown.map((vb) => (
                  <div key={vb.rate} className="flex gap-6">
                    <span className="text-yellow-700 font-medium w-36">
                      {vb.rate === 0 ? 'Zero-rated turnover:' : `Turnover ${vb.rate}% VAT:`}
                    </span>
                    <span>{vb.base.toFixed(2)} €</span>
                    {vb.rate > 0 && (
                      <>
                        <span className="text-yellow-700 font-medium">VAT to remit:</span>
                        <span>{vb.vat.toFixed(2)} €</span>
                      </>
                    )}
                  </div>
                ))}
                {calculated.vatBreakdown.length === 0 && (
                  <span className="text-gray-400">Enter line items to see VAT filing data.</span>
                )}
              </div>
            </div>

          </div>
        </form>
      </div>

      {/* ── RIGHT PANEL: Live Invoice Preview ── */}
      <div className="w-[45%] border-l border-gray-300 overflow-y-auto bg-gray-200 p-4">
        <InvoicePreview form={form} lineItems={lineItems} calculated={calculated} />
      </div>
    </div>
  )
}
