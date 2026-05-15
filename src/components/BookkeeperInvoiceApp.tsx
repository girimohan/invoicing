'use client'

import { useState, useEffect, useTransition } from 'react'
import { getClients } from '@/actions/client'
import {
  createBookkeeperInvoice,
  getNextBkInvoiceNumber,
  getBookkeeperInvoices,
  type BookkeeperInvoiceInput,
} from '@/actions/bookkeeper-invoice'
import type { BookkeeperInvoice } from '@prisma/client'

// ─── Types ────────────────────────────────────────────────────────────────────

type ClientOption = {
  id: number
  displayId: string
  name: string
  businessId: string | null
  vatId: string | null
  address: string | null
  postalCode: string | null
  city: string | null
  email: string | null
}

type BkDetails = {
  name: string
  businessId: string
  vatId: string
  address: string
  postalCode: string
  city: string
  iban: string
  bic: string
  email: string
  phone: string
}

const STORAGE_KEY = 'bk_my_details'

const emptyBk = (): BkDetails => ({
  name: '', businessId: '', vatId: '', address: '',
  postalCode: '', city: '', iban: '', bic: '', email: '', phone: '',
})

function today() {
  return new Date().toISOString().split('T')[0]
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function round2(n: number) { return Math.round(n * 100) / 100 }

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('fi-FI', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function fmt(n: number) { return n.toFixed(2) }

function formatIbanDisplay(raw: string) {
  return raw.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim()
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BookkeeperInvoiceApp({
  initialInvoiceNumber,
}: {
  initialInvoiceNumber: string
}) {
  const [bk, setBk] = useState<BkDetails>(emptyBk)
  const [clients, setClients] = useState<ClientOption[]>([])
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null)
  const [client, setClient] = useState({
    name: '', businessId: '', vatId: '', address: '',
    postalCode: '', city: '', email: '',
  })

  const [invoiceNumber, setInvoiceNumber] = useState(initialInvoiceNumber)
  const [issueDate, setIssueDate] = useState(today())
  const [dueDate, setDueDate] = useState(addDays(today(), 14))
  const [paymentTerms, setPaymentTerms] = useState('14 pv netto / 14 days net')
  const [serviceDescription, setServiceDescription] = useState(
    'Kirjanpito- ja veroilmoituspalvelu / Bookkeeping & tax filing services'
  )
  const [amountExVat, setAmountExVat] = useState('25')
  const [vatRate, setVatRate] = useState('25.5')
  const [notes, setNotes] = useState('')

  const [history, setHistory] = useState<BookkeeperInvoice[]>([])
  const [savedId, setSavedId] = useState<string | null>(null)
  const [submitting, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Load bookkeeper details from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setBk(JSON.parse(raw))
    } catch { /* ignore */ }
  }, [])

  // Load clients + history
  useEffect(() => {
    getClients().then((list) => setClients(list as ClientOption[])).catch(() => {})
    getBookkeeperInvoices().then((list) => setHistory(list as BookkeeperInvoice[])).catch(() => {})
  }, [])

  // Persist bookkeeper details to localStorage whenever they change
  function setBkField(field: keyof BkDetails, value: string) {
    setBk((prev) => {
      const next = { ...prev, [field]: value }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  // When client is selected from dropdown
  function selectClient(id: number | null) {
    setSelectedClientId(id)
    if (id === null) {
      setClient({ name: '', businessId: '', vatId: '', address: '', postalCode: '', city: '', email: '' })
      return
    }
    const c = clients.find((x) => x.id === id)
    if (c) {
      setClient({
        name: c.name,
        businessId: c.businessId ?? '',
        vatId: c.vatId ?? '',
        address: c.address ?? '',
        postalCode: c.postalCode ?? '',
        city: c.city ?? '',
        email: c.email ?? '',
      })
    }
  }

  function setClientField(field: keyof typeof client, value: string) {
    setClient((prev) => ({ ...prev, [field]: value }))
  }

  // Computed values
  const amtEx = parseFloat(amountExVat) || 0
  const vatPct = parseFloat(vatRate) || 0
  const vatAmt = round2(amtEx * vatPct / 100)
  const total = round2(amtEx + vatAmt)

  // Validate required fields
  function validate(): string | null {
    if (!bk.name.trim()) return 'Your name is required.'
    if (!bk.businessId.trim()) return 'Your Business ID (Y-tunnus) is required.'
    if (!bk.vatId.trim()) return 'Your VAT ID (ALV-tunnus) is required.'
    if (!bk.address.trim()) return 'Your street address is required.'
    if (!bk.postalCode.trim()) return 'Your postal code is required.'
    if (!bk.city.trim()) return 'Your city is required.'
    if (!bk.iban.trim()) return 'Your IBAN is required.'
    if (!bk.bic.trim()) return 'Your BIC/SWIFT is required.'
    if (!client.name.trim()) return 'Client name is required.'
    if (!invoiceNumber.trim()) return 'Invoice number is required.'
    if (!issueDate) return 'Issue date is required.'
    if (!dueDate) return 'Due date is required.'
    if (amtEx <= 0) return 'Amount must be greater than 0.'
    return null
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validate()
    if (err) { setError(err); return }
    setError(null)

    const payload: BookkeeperInvoiceInput = {
      invoiceNumber,
      issueDate,
      dueDate,
      paymentTerms,
      bkName: bk.name,
      bkBusinessId: bk.businessId,
      bkVatId: bk.vatId,
      bkAddress: bk.address,
      bkPostalCode: bk.postalCode,
      bkCity: bk.city,
      bkIban: bk.iban,
      bkBic: bk.bic,
      bkEmail: bk.email || undefined,
      bkPhone: bk.phone || undefined,
      clientId: selectedClientId,
      clientName: client.name,
      clientBusinessId: client.businessId || undefined,
      clientVatId: client.vatId || undefined,
      clientAddress: client.address || undefined,
      clientPostalCode: client.postalCode || undefined,
      clientCity: client.city || undefined,
      clientEmail: client.email || undefined,
      serviceDescription,
      amountExVat: amtEx,
      vatRate: vatPct,
      vatAmount: vatAmt,
      totalIncVat: total,
      notes: notes || undefined,
    }

    startTransition(async () => {
      try {
        const result = await createBookkeeperInvoice(payload)
        setSavedId(result.id)
        setSuccessMsg(`Invoice ${invoiceNumber} saved!`)
        // Refresh invoice number for next invoice
        const next = await getNextBkInvoiceNumber()
        setInvoiceNumber(next)
        setNotes('')
        setSelectedClientId(null)
        setClient({ name: '', businessId: '', vatId: '', address: '', postalCode: '', city: '', email: '' })
        // Refresh history
        getBookkeeperInvoices().then((list) => setHistory(list as BookkeeperInvoice[])).catch(() => {})
        setTimeout(() => setSuccessMsg(null), 5000)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save invoice.')
      }
    })
  }

  // Field helper for bookkeeper details
  const bkField = (label: string, field: keyof BkDetails, opts?: { placeholder?: string; type?: string; required?: boolean }) => (
    <div className="field">
      <label>{label}{opts?.required !== false ? ' *' : ''}</label>
      <input
        type={opts?.type ?? 'text'}
        value={bk[field]}
        onChange={(e) => setBkField(field, e.target.value)}
        placeholder={opts?.placeholder}
      />
    </div>
  )

  return (
    <div className="flex h-[calc(100vh-36px)]">
      {/* ── LEFT: Form ── */}
      <div className="w-[55%] overflow-y-auto bg-white">
        <form onSubmit={handleSubmit} noValidate>
          {/* Sticky header */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
            <div>
              <h1 className="font-bold text-base">Bookkeeper Invoice</h1>
              <p className="text-[10px] text-gray-400">Create an invoice for your bookkeeping services</p>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="bg-indigo-700 text-white text-xs px-4 py-1.5 rounded font-semibold hover:bg-indigo-800 disabled:opacity-50"
            >
              {submitting ? 'Saving…' : 'Save & Generate Invoice'}
            </button>
          </div>

          {error && (
            <div className="mx-6 mt-3 text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded">{error}</div>
          )}
          {successMsg && savedId && (
            <div className="mx-6 mt-3 text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded flex items-center justify-between">
              <span>{successMsg}</span>
              <a
                href={`/api/bookkeeper-invoice/${savedId}/pdf`}
                target="_blank"
                className="ml-3 bg-green-700 text-white px-3 py-1 rounded text-xs font-semibold hover:bg-green-800"
              >
                Download PDF
              </a>
            </div>
          )}

          <div className="px-6 py-4 space-y-6">

            {/* ── My Details (Bookkeeper / Seller) ── */}
            <div className="form-section">
              <div className="form-section-title">My Details (Invoice From)</div>
              <p className="text-[10px] text-gray-400 mb-3">These are saved in your browser automatically.</p>

              <div className="grid grid-cols-4 gap-3 mb-3">
                <div className="field col-span-2">
                  <label>Full Name / Company *</label>
                  <input value={bk.name} onChange={(e) => setBkField('name', e.target.value)} placeholder="Your name or company" />
                </div>
                {bkField('Business ID (Y-tunnus)', 'businessId', { placeholder: '1234567-8' })}
                {bkField('VAT ID (ALV-tunnus)', 'vatId', { placeholder: 'FI12345678' })}
              </div>
              <div className="grid grid-cols-4 gap-3 mb-3">
                <div className="field col-span-2">
                  <label>Street Address *</label>
                  <input value={bk.address} onChange={(e) => setBkField('address', e.target.value)} />
                </div>
                {bkField('Postal Code', 'postalCode', { placeholder: '00100' })}
                {bkField('City', 'city', { placeholder: 'Helsinki' })}
              </div>
              <div className="grid grid-cols-4 gap-3 mb-3">
                {bkField('IBAN', 'iban', { placeholder: 'FI12 3456 7890 1234 56' })}
                {bkField('BIC/SWIFT', 'bic', { placeholder: 'NDEAFIHH' })}
                {bkField('Email', 'email', { type: 'email', required: false })}
                {bkField('Phone', 'phone', { type: 'tel', required: false })}
              </div>
            </div>

            {/* ── Client (Bill To) ── */}
            <div className="form-section">
              <div className="form-section-title">Client (Bill To)</div>

              <div className="mb-3">
                <label className="block text-[10px] font-medium text-gray-600 mb-1">Select from saved clients</label>
                <select
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs bg-white"
                  value={selectedClientId ?? ''}
                  onChange={(e) => selectClient(e.target.value === '' ? null : parseInt(e.target.value, 10))}
                >
                  <option value="">— select client or fill manually below —</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.displayId} — {c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-4 gap-3 mb-3">
                <div className="field col-span-2">
                  <label>Client Name *</label>
                  <input
                    value={client.name}
                    onChange={(e) => setClientField('name', e.target.value)}
                    placeholder="Client full name or company"
                    readOnly={selectedClientId !== null}
                    className={selectedClientId !== null ? 'bg-gray-50 cursor-default' : ''}
                  />
                </div>
                <div className="field">
                  <label>Business ID</label>
                  <input
                    value={client.businessId}
                    onChange={(e) => setClientField('businessId', e.target.value)}
                    readOnly={selectedClientId !== null}
                    className={selectedClientId !== null ? 'bg-gray-50 cursor-default' : ''}
                  />
                </div>
                <div className="field">
                  <label>VAT ID</label>
                  <input
                    value={client.vatId}
                    onChange={(e) => setClientField('vatId', e.target.value)}
                    readOnly={selectedClientId !== null}
                    className={selectedClientId !== null ? 'bg-gray-50 cursor-default' : ''}
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="field col-span-2">
                  <label>Street Address</label>
                  <input
                    value={client.address}
                    onChange={(e) => setClientField('address', e.target.value)}
                    readOnly={selectedClientId !== null}
                    className={selectedClientId !== null ? 'bg-gray-50 cursor-default' : ''}
                  />
                </div>
                <div className="field">
                  <label>Postal Code</label>
                  <input
                    value={client.postalCode}
                    onChange={(e) => setClientField('postalCode', e.target.value)}
                    readOnly={selectedClientId !== null}
                    className={selectedClientId !== null ? 'bg-gray-50 cursor-default' : ''}
                  />
                </div>
                <div className="field">
                  <label>City</label>
                  <input
                    value={client.city}
                    onChange={(e) => setClientField('city', e.target.value)}
                    readOnly={selectedClientId !== null}
                    className={selectedClientId !== null ? 'bg-gray-50 cursor-default' : ''}
                  />
                </div>
              </div>
            </div>

            {/* ── Invoice Details ── */}
            <div className="form-section">
              <div className="form-section-title">Invoice Details</div>
              <div className="grid grid-cols-4 gap-3 mb-3">
                <div className="field col-span-2">
                  <label>Invoice Number</label>
                  <input
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="font-mono font-semibold"
                  />
                </div>
                <div className="field">
                  <label>Issue Date</label>
                  <input type="date" value={issueDate} onChange={(e) => {
                    setIssueDate(e.target.value)
                    setDueDate(addDays(e.target.value, 14))
                  }} />
                </div>
                <div className="field">
                  <label>Due Date</label>
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="field col-span-4">
                  <label>Payment Terms</label>
                  <input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
                </div>
              </div>
            </div>

            {/* ── Service ── */}
            <div className="form-section">
              <div className="form-section-title">Service</div>
              <div className="grid grid-cols-4 gap-3 mb-3">
                <div className="field col-span-4">
                  <label>Service Description</label>
                  <input value={serviceDescription} onChange={(e) => setServiceDescription(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="field">
                  <label>Amount (excl. VAT) €</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amountExVat}
                    onChange={(e) => setAmountExVat(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>VAT Rate %</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={vatRate}
                    onChange={(e) => setVatRate(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>VAT Amount €</label>
                  <input
                    readOnly
                    value={fmt(vatAmt)}
                    className="bg-gray-50 cursor-default font-mono"
                  />
                </div>
                <div className="field">
                  <label>Total (incl. VAT) €</label>
                  <input
                    readOnly
                    value={fmt(total)}
                    className="bg-gray-50 cursor-default font-mono font-semibold text-indigo-700"
                  />
                </div>
              </div>
            </div>

            {/* ── Notes ── */}
            <div className="form-section">
              <div className="form-section-title">Notes (optional)</div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                placeholder="Any additional notes for the client…"
              />
            </div>

          </div>
        </form>
      </div>

      {/* ── RIGHT: Preview + History ── */}
      <div className="w-[45%] overflow-y-auto bg-gray-50 border-l border-gray-200">
        {/* Live preview */}
        <div className="bg-white m-4 rounded shadow-sm p-6 font-sans text-[11px]">
          <div className="flex justify-between mb-5">
            {/* Seller */}
            <div>
              <div className="font-bold text-base">{bk.name || <span className="text-gray-300">Your Name</span>}</div>
              {bk.address && <div className="text-gray-600">{bk.address}</div>}
              {(bk.postalCode || bk.city) && <div className="text-gray-600">{bk.postalCode} {bk.city}</div>}
              {bk.phone && <div className="text-gray-600">Puh: {bk.phone}</div>}
              {bk.email && <div className="text-gray-600">{bk.email}</div>}
              {bk.businessId && <div className="text-gray-500 mt-1">Y-tunnus: {bk.businessId}</div>}
              {bk.vatId && <div className="text-gray-500">ALV-tunnus: {bk.vatId}</div>}
            </div>
            {/* Invoice meta */}
            <div className="text-right">
              <div className="font-bold text-xl tracking-wide mb-2">LASKU / INVOICE</div>
              <table className="text-right ml-auto text-[10px]">
                <tbody>
                  <tr><td className="text-gray-400 pr-3">Laskunumero / Invoice No:</td><td className="font-bold">{invoiceNumber}</td></tr>
                  <tr><td className="text-gray-400 pr-3">Päivämäärä / Date:</td><td className="font-bold">{fmtDate(issueDate)}</td></tr>
                  <tr><td className="text-gray-400 pr-3">Eräpäivä / Due Date:</td><td className="font-bold">{fmtDate(dueDate)}</td></tr>
                  <tr><td className="text-gray-400 pr-3">Maksuehto / Payment Terms:</td><td className="font-bold">{paymentTerms}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <hr className="border-gray-200 mb-4" />

          {/* Bill To */}
          <div className="mb-4">
            <div className="text-[9px] uppercase tracking-wide text-gray-400 mb-1">Laskutettava / Bill To</div>
            <div className="font-bold">{client.name || <span className="text-gray-300">Client Name</span>}</div>
            {client.address && <div className="text-gray-600">{client.address}</div>}
            {(client.postalCode || client.city) && <div className="text-gray-600">{client.postalCode} {client.city}</div>}
            {client.businessId && <div className="text-gray-500">Y-tunnus: {client.businessId}</div>}
            {client.vatId && <div className="text-gray-500">ALV-tunnus: {client.vatId}</div>}
          </div>

          <hr className="border-gray-200 mb-4" />

          {/* Service table */}
          <table className="w-full mb-4 text-[10px]">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="py-1.5 px-2 font-semibold">Palvelu / Service</th>
                <th className="py-1.5 px-2 font-semibold text-right">Veroton</th>
                <th className="py-1.5 px-2 font-semibold text-right">ALV %</th>
                <th className="py-1.5 px-2 font-semibold text-right">ALV €</th>
                <th className="py-1.5 px-2 font-semibold text-right">Yhteensä</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-2 px-2">{serviceDescription}</td>
                <td className="py-2 px-2 text-right">{fmt(amtEx)} €</td>
                <td className="py-2 px-2 text-right">{fmt(vatPct)} %</td>
                <td className="py-2 px-2 text-right">{fmt(vatAmt)} €</td>
                <td className="py-2 px-2 text-right">{fmt(total)} €</td>
              </tr>
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end mb-5">
            <table className="text-[10px]">
              <tbody>
                <tr>
                  <td className="text-gray-400 pr-6 text-right">Veroton myynti / Tax base:</td>
                  <td className="text-right w-20">{fmt(amtEx)} €</td>
                </tr>
                <tr>
                  <td className="text-gray-400 pr-6 text-right">ALV {fmt(vatPct)} %:</td>
                  <td className="text-right">{fmt(vatAmt)} €</td>
                </tr>
                <tr className="border-t-2 border-gray-800 font-bold text-sm">
                  <td className="pt-1 pr-6 text-right">Maksettava yhteensä / Total due:</td>
                  <td className="pt-1 text-right text-indigo-700">{fmt(total)} €</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Payment box */}
          <div className="border border-gray-200 rounded p-3 text-[10px]">
            <div className="font-bold text-[11px] mb-2 border-b border-gray-100 pb-1">Maksutiedot / Payment Details</div>
            <div className="grid grid-cols-2 gap-1">
              <span className="text-gray-400">IBAN:</span>
              <span className="font-bold">{bk.iban ? formatIbanDisplay(bk.iban) : <span className="text-gray-300">—</span>}</span>
              <span className="text-gray-400">BIC/SWIFT:</span>
              <span className="font-bold">{bk.bic || <span className="text-gray-300">—</span>}</span>
              <span className="text-gray-400">Viite / Ref:</span>
              <span className="font-bold">{invoiceNumber}</span>
              <span className="text-gray-400">Eräpäivä:</span>
              <span className="font-bold">{fmtDate(dueDate)}</span>
              <span className="text-gray-400">Summa:</span>
              <span className="font-bold text-indigo-700">{fmt(total)} €</span>
            </div>
          </div>

          {notes && (
            <div className="mt-3 text-[10px]">
              <div className="text-[9px] uppercase tracking-wide text-gray-400 mb-1">Lisätiedot / Notes</div>
              <div className="text-gray-600 whitespace-pre-line">{notes}</div>
            </div>
          )}
        </div>

        {/* Invoice History */}
        {history.length > 0 && (
          <div className="mx-4 mb-6">
            <h2 className="text-xs font-bold text-gray-700 mb-2">Past Bookkeeper Invoices</h2>
            <div className="bg-white rounded shadow-sm overflow-hidden">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="py-2 px-3 text-left font-semibold text-gray-600">Invoice No</th>
                    <th className="py-2 px-3 text-left font-semibold text-gray-600">Client</th>
                    <th className="py-2 px-3 text-left font-semibold text-gray-600">Date</th>
                    <th className="py-2 px-3 text-right font-semibold text-gray-600">Total</th>
                    <th className="py-2 px-3 text-center font-semibold text-gray-600">PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((inv) => (
                    <tr key={inv.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-1.5 px-3 font-mono">{inv.invoiceNumber}</td>
                      <td className="py-1.5 px-3">{inv.clientName}</td>
                      <td className="py-1.5 px-3 text-gray-500">
                        {new Date(inv.issueDate).toLocaleDateString('fi-FI', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </td>
                      <td className="py-1.5 px-3 text-right font-semibold">{inv.totalIncVat.toFixed(2)} €</td>
                      <td className="py-1.5 px-3 text-center">
                        <a
                          href={`/api/bookkeeper-invoice/${inv.id}/pdf`}
                          target="_blank"
                          className="text-indigo-600 hover:underline font-medium"
                        >
                          PDF
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
