'use client'

import { useState, useTransition, useEffect } from 'react'
import { getClients, createClient, updateClient, deleteClient, type ClientInput, type ClientRole } from '@/actions/client'

type Client = {
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
  iban: string | null
  bic: string | null
  notes: string | null
  shareType: string
  defaultSharePercent: number | null
  defaultShareAmount: number | null
  createdAt: Date
  updatedAt: Date
  invoiceCount?: number
  buyerInvoiceCount?: number
}

type Props = {
  clients: Client[]
  nextDisplayId: string
}

const emptyForm = (nextDisplayId: string): ClientInput => ({
  displayId: nextDisplayId,
  role: 'SUBSTITUTE_WORKER',
  name: '',
  businessId: '',
  vatId: '',
  address: '',
  postalCode: '',
  city: '',
  email: '',
  phone: '',
  iban: '',
  bic: '',
  notes: '',
  shareType: 'PERCENT',
  defaultSharePercent: undefined,
  defaultShareAmount: undefined,
})

export default function ClientsManager({ clients: initial, nextDisplayId }: Props) {
  const [clients, setClients] = useState<Client[]>(initial)

  // Fetch fresh client data on mount to ensure role field is populated
  // (RSC serialization can drop the role field in some Next.js versions)
  useEffect(() => {
    getClients().then((fresh) => setClients(fresh as Client[]))
  }, [])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<ClientInput>(() => emptyForm(nextDisplayId))
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const set = (field: keyof ClientInput, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const fc = (label: string, field: keyof ClientInput, opts?: { type?: string; placeholder?: string; required?: boolean }) => (
    <div className="field">
      <label>{label}</label>
      <input
        type={opts?.type ?? 'text'}
        value={(form[field] as string) ?? ''}
        onChange={(e) => set(field, e.target.value)}
        placeholder={opts?.placeholder}
        required={opts?.required}
      />
    </div>
  )

  const openNew = () => {
    setEditingId(null)
    const next = clients.length === 0
      ? nextDisplayId
      : String(Math.max(...clients.map((c) => parseInt(c.displayId, 10) || 100)) + 1)
    setForm(emptyForm(next))
    setError(null)
    setShowForm(true)
  }

  const openEdit = (client: Client) => {
    setEditingId(client.id)
    setForm({
      displayId: client.displayId,
      role: client.role as ClientRole,
      name: client.name,
      businessId: client.businessId ?? '',
      vatId: client.vatId ?? '',
      address: client.address ?? '',
      postalCode: client.postalCode ?? '',
      city: client.city ?? '',
      email: client.email ?? '',
      phone: client.phone ?? '',
      iban: client.iban ?? '',
      bic: client.bic ?? '',
      notes: client.notes ?? '',
      shareType: client.shareType ?? 'PERCENT',
      defaultSharePercent: client.defaultSharePercent ?? undefined,
      defaultShareAmount: client.defaultShareAmount ?? undefined,
    })
    setError(null)
    setShowForm(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.displayId.trim() || !form.name.trim()) {
      setError('Client ID and Name are required.')
      return
    }
    // Check duplicate displayId (only for new clients)
    if (editingId === null && clients.some((c) => c.displayId === form.displayId.trim())) {
      setError(`Client ID "${form.displayId}" is already taken.`)
      return
    }
    setError(null)

    startTransition(async () => {
      try {
        if (editingId !== null) {
          const updated = await updateClient(editingId, form)
          setClients((prev) => prev.map((c) => (c.id === editingId ? (updated as Client) : c)))
        } else {
          const created = await createClient(form)
          setClients((prev) => [...prev, created as Client].sort((a, b) => a.displayId.localeCompare(b.displayId)))
        }
        setShowForm(false)
        setEditingId(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save client.')
      }
    })
  }

  const handleDelete = (client: Client) => {
    if (!confirm(`Delete client "${client.name}" (${client.displayId})? This will NOT delete their invoices.`)) return
    startTransition(async () => {
      try {
        await deleteClient(client.id)
        setClients((prev) => prev.filter((c) => c.id !== client.id))
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to delete client.')
      }
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-bold">Clients</h1>
          <p className="text-xs text-gray-500 mt-0.5">Store Substitute Workers and Account Holders. IDs start at 101. Invoice number format: BB-&#123;accountHolderId&#125;-&#123;YYYYMM&#125;-1/2</p>
        </div>
        <button
          onClick={openNew}
          className="bg-blue-700 text-white text-xs px-4 py-2 rounded font-semibold hover:bg-blue-800"
        >
          + Add Client
        </button>
      </div>

      {/* ── Client Form ── */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6 shadow-sm">
          <h2 className="font-semibold text-sm mb-4">{editingId !== null ? 'Edit Client' : 'New Client'}</h2>
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded mb-3">{error}</div>
          )}
          <form onSubmit={handleSubmit} noValidate>
            <div className="grid grid-cols-4 gap-3 mb-3">
              {fc('Client ID *', 'displayId', { placeholder: '101', required: true })}
              <div className="field">
                <label>Role *</label>
                <select
                  value={form.role}
                  onChange={(e) => set('role', e.target.value)}
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs"
                >
                  <option value="SUBSTITUTE_WORKER">Substitute Worker (Invoice From)</option>
                  <option value="ACCOUNT_HOLDER">Account Holder (Invoice To)</option>
                </select>
              </div>
              {fc('Full Name / Company *', 'name', { required: true })}
              {fc('Business ID (Y-tunnus)', 'businessId', { placeholder: '1234567-8' })}
            </div>
            <div className="grid grid-cols-4 gap-3 mb-3">
              {fc('VAT ID (ALV-tunnus)', 'vatId', { placeholder: 'FI12345678' })}
              {fc('Street Address', 'address')}
              {fc('Postal Code', 'postalCode', { placeholder: '00100' })}
              {fc('City', 'city')}
            </div>
            <div className="grid grid-cols-4 gap-3 mb-3">
              {fc('Email', 'email', { type: 'email' })}
              {fc('Phone', 'phone', { type: 'tel' })}
              {fc('IBAN', 'iban', { placeholder: 'FI12 3456 7890 1234 56' })}
              {fc('BIC/SWIFT', 'bic', { placeholder: 'NDEAFIHH' })}
            </div>
            <div className="grid grid-cols-4 gap-3 mb-4">
              <div className="field col-span-4">
                <label>Notes</label>
                <input
                  type="text"
                  value={form.notes ?? ''}
                  onChange={(e) => set('notes', e.target.value)}
                  placeholder="Optional internal notes"
                />
              </div>
            </div>

            {/* ── Share preference (for Account Holders) ── */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
              <div className="text-[11px] font-bold text-orange-800 mb-2 uppercase tracking-wide">
                Worker Share Default (Account Holder only)
              </div>
              <p className="text-[10px] text-orange-600 mb-3">
                When creating invoices for this account holder, line items will use this share setting by default.
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="field">
                  <label className="text-[10px]">Share Type</label>
                  <select
                    value={form.shareType ?? 'PERCENT'}
                    onChange={(e) => set('shareType', e.target.value)}
                    className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs"
                  >
                    <option value="PERCENT">% Percentage of Wolt gross</option>
                    <option value="AMOUNT">€ Fixed amount per payout</option>
                  </select>
                </div>
                {(form.shareType ?? 'PERCENT') === 'PERCENT' ? (
                  <div className="field">
                    <label className="text-[10px]">Default Share %</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={form.defaultSharePercent ?? ''}
                      onChange={(e) => setForm((prev) => ({ ...prev, defaultSharePercent: e.target.value ? parseFloat(e.target.value) : undefined }))}
                      placeholder="e.g. 75"
                      className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs"
                    />
                    <span className="text-[9px] text-orange-500">Worker keeps this % of each Wolt gross line</span>
                  </div>
                ) : (
                  <div className="field">
                    <label className="text-[10px]">Fixed Amount per Payout (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.defaultShareAmount ?? ''}
                      onChange={(e) => setForm((prev) => ({ ...prev, defaultShareAmount: e.target.value ? parseFloat(e.target.value) : undefined }))}
                      placeholder="e.g. 250.00"
                      className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs"
                    />
                    <span className="text-[9px] text-orange-500">Worker receives this flat amount regardless of Wolt gross</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isPending}
                className="bg-blue-700 text-white text-xs px-4 py-1.5 rounded font-semibold hover:bg-blue-800 disabled:opacity-50"
              >
                {isPending ? 'Saving…' : editingId !== null ? 'Save Changes' : 'Add Client'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingId(null) }}
                className="text-xs border border-gray-300 px-4 py-1.5 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Clients Table ── */}
      {clients.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-10 text-center text-gray-400 text-sm">
          No clients yet. Click <strong>+ Add Client</strong> to add a Substitute Worker or Account Holder.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-600 w-20">ID</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-600 w-40">Role</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Name</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Business ID</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-600">City</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Email / Phone</th>
                <th className="text-center px-4 py-2.5 font-semibold text-gray-600 w-28">Worker Share</th>
                <th className="text-center px-4 py-2.5 font-semibold text-gray-600 w-24">Invoices</th>
                <th className="px-4 py-2.5 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client, i) => {
                return (
                  <tr key={client.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-2.5 font-mono font-semibold text-blue-700">{client.displayId}</td>
                    <td className="px-4 py-2.5">
                      {client.role === 'SUBSTITUTE_WORKER' ? (
                        <span className="bg-purple-100 text-purple-700 text-[10px] font-medium px-2 py-0.5 rounded-full">Substitute Worker</span>
                      ) : (
                        <span className="bg-green-100 text-green-700 text-[10px] font-medium px-2 py-0.5 rounded-full">Account Holder</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-medium">{client.name}</td>
                    <td className="px-4 py-2.5 text-gray-500">{client.businessId || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-500">{client.city || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-500">
                      {client.email && <div>{client.email}</div>}
                      {client.phone && <div>{client.phone}</div>}
                      {!client.email && !client.phone && '—'}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {client.role === 'ACCOUNT_HOLDER' ? (
                        client.shareType === 'AMOUNT'
                          ? <span className="bg-orange-100 text-orange-700 text-[10px] font-semibold px-2 py-0.5 rounded">
                              € {client.defaultShareAmount ?? '?'}
                            </span>
                          : <span className="bg-blue-100 text-blue-700 text-[10px] font-semibold px-2 py-0.5 rounded">
                              {client.defaultSharePercent != null ? `${client.defaultSharePercent}%` : '—'}
                            </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {client.role === 'SUBSTITUTE_WORKER' ? (
                        <span className="inline-flex items-center justify-center min-w-[1.5rem] bg-purple-100 text-purple-700 font-semibold text-[10px] px-1.5 py-0.5 rounded-full">
                          {client.invoiceCount ?? 0}
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center min-w-[1.5rem] bg-green-100 text-green-700 font-semibold text-[10px] px-1.5 py-0.5 rounded-full">
                          {client.buyerInvoiceCount ?? 0}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => openEdit(client)}
                        className="text-blue-600 hover:underline mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(client)}
                        className="text-red-400 hover:text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
