'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, updateClient, deleteClient, type ClientInput } from '@/actions/client'

export type EditableClient = {
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
  shareType?: string
  defaultSharePercent?: number | null
  defaultShareAmount?: number | null
}

const blank = (displayId: string): ClientInput => ({
  displayId,
  // Everyone taken on now runs their own platform account. The other role
  // exists only on records created back when substitutes were invoiced.
  role: 'ACCOUNT_HOLDER',
  name: '', businessId: '', vatId: '', address: '', postalCode: '', city: '',
  email: '', phone: '', iban: '', bic: '', notes: '',
})

export default function ClientDialog({ client, nextDisplayId, onClose }: {
  client: EditableClient | null      // null = creating a new one
  nextDisplayId: string
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<ClientInput>(() =>
    client
      ? {
          displayId: client.displayId,
          role: client.role as ClientInput['role'],
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
          shareType: client.shareType,
          defaultSharePercent: client.defaultSharePercent ?? undefined,
          defaultShareAmount: client.defaultShareAmount ?? undefined,
        }
      : blank(nextDisplayId),
  )

  const set = (k: keyof ClientInput, v: string) => setForm((p) => ({ ...p, [k]: v }))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function save() {
    setError(null)
    if (!form.name.trim()) return setError('Name is required.')
    if (!form.displayId.trim()) return setError('Client ID is required.')
    startTransition(async () => {
      try {
        if (client) await updateClient(client.id, form)
        else await createClient(form)
        router.refresh()
        onClose()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save the client.')
      }
    })
  }

  function remove() {
    if (!client) return
    if (!confirm(`Delete ${client.name}? Their invoices are kept and simply unlinked.`)) return
    setError(null)
    startTransition(async () => {
      try {
        await deleteClient(client.id)
        router.refresh()
        onClose()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not delete the client.')
      }
    })
  }

  const field = (key: keyof ClientInput, label: string, placeholder = '', type = 'text') => (
    <div className="field">
      <label htmlFor={`c-${key}`}>{label}</label>
      <input id={`c-${key}`} type={type} placeholder={placeholder}
        value={(form[key] as string) ?? ''} onChange={(e) => set(key, e.target.value)} />
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] flex items-start justify-center p-6 overflow-y-auto"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-modal="true" aria-label={client ? 'Edit client' : 'Add client'}
        className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl mt-8">

        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-900">
              {client ? `Edit ${client.name}` : 'Add client'}
            </h2>
            <p className="text-[11.5px] text-slate-500 mt-0.5">
              Details used on invoices and reports
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="btn-ghost btn-sm">✕</button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {error && <div className="notice-error">{error}</div>}

          <div className="grid grid-cols-4 gap-3">
            {field('displayId', 'Client ID')}
            <div className="col-span-3">{field('name', 'Name', 'Full name or business name')}</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {field('businessId', 'Business ID (Y-tunnus)', '1234567-8')}
            {field('vatId', 'VAT ID', 'FI12345678')}
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-2">{field('address', 'Address')}</div>
            {field('postalCode', 'Postal code')}
            {field('city', 'City')}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {field('email', 'Email', '', 'email')}
            {field('phone', 'Phone')}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {field('iban', 'IBAN')}
            {field('bic', 'BIC')}
          </div>

          {field('notes', 'Notes')}

          {/* Only meaningful on records from the substitute-invoicing era. */}
          {client?.role === 'SUBSTITUTE_WORKER' && (
            <div className="notice-info">
              This is a past worker record, kept so their earlier income and VAT stay reportable.
              New clients are always platform account holders.
            </div>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-slate-200 flex items-center justify-between gap-3">
          {client ? (
            <button onClick={remove} className="btn-danger" disabled={pending}>Delete</button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary" disabled={pending}>Cancel</button>
            <button onClick={save} className="btn-primary" disabled={pending}>
              {pending ? 'Saving…' : client ? 'Save changes' : 'Add client'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
