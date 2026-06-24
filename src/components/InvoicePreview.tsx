'use client'

import { useMemo } from 'react'
import type { FormState, LineItemRow, Calculated } from '@/types/invoice'
import { formatDate, formatIban, formatCurrency } from '@/lib/calculations'
import { numberToWords } from '@/lib/numberToWords'
import { buildBaseNumber, generateReference, validateBaseNumber } from '@/lib/viitenumero'

interface Props {
  form: FormState
  lineItems: LineItemRow[]
  calculated: Calculated
}

export default function InvoicePreview({ form, lineItems, calculated }: Props) {
  const f = (n: number) => formatCurrency(n)

  // Compute live reference number from form fields (mirrors InvoiceApp logic)
  const liveRef = useMemo(() => {
    if (!form.includeReference) return null
    const seq = form.refInvoiceSeq?.trim()
    if (!seq) return null
    const base = buildBaseNumber({
      clientCode: form.refClientCode?.trim() || undefined,
      yearMonth: form.refYearMonth?.trim() || undefined,
      invoiceSeq: seq,
    })
    if (validateBaseNumber(base)) return null
    return generateReference(form.referenceType ?? 'domestic', base)
  }, [form.includeReference, form.referenceType, form.refClientCode, form.refYearMonth, form.refInvoiceSeq])

  return (
    // A4 paper simulation
    <div
      className="bg-white shadow-md mx-auto text-gray-900"
      style={{
        width: '210mm',
        minHeight: '297mm',
        padding: '14mm 16mm',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '9pt',
        lineHeight: '1.4',
      }}
    >
      {/* ── Header: Seller (left) + Invoice title/details (right) ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16pt' }}>
        {/* Seller block */}
        <div style={{ width: '48%' }}>
          <div style={{ fontWeight: 'bold', fontSize: '12pt', marginBottom: '2pt' }}>
            {form.sellerName || <span className="text-gray-300">Seller Name</span>}
          </div>
          <div>{form.sellerAddress || <span className="text-gray-300">Street Address</span>}</div>
          <div>
            {form.sellerPostalCode || <span className="text-gray-300">00000</span>}{' '}
            {form.sellerCity || <span className="text-gray-300">City</span>}
          </div>
          {form.sellerPhone && <div>Puh: {form.sellerPhone}</div>}
          {form.sellerEmail && <div>{form.sellerEmail}</div>}
          <div style={{ marginTop: '6pt' }}>
            Y-tunnus: {form.sellerBusinessId || <span className="text-gray-300">0000000-0</span>}
          </div>
          <div>
            ALV-tunnus: {form.sellerVatId || <span className="text-gray-300">FI00000000</span>}
          </div>
        </div>

        {/* Invoice title + details */}
        <div style={{ width: '48%', textAlign: 'right' }}>
          <div
            style={{
              fontWeight: 'bold',
              fontSize: '18pt',
              letterSpacing: '1px',
              marginBottom: '8pt',
            }}
          >
            LASKU / INVOICE
          </div>
          <DetailRow label="Laskunumero / Invoice No:" value={form.invoiceNumber || '—'} />
          <DetailRow label="Päivämäärä / Date:" value={form.invoiceDate ? formatDate(form.invoiceDate) : '—'} />
          <DetailRow label="Eräpäivä / Due Date:" value={form.dueDate ? formatDate(form.dueDate) : '—'} />
          <DetailRow label="Maksuehto / Payment Terms:" value={form.paymentTerms || '—'} />
          <DetailRow
            label="Laskutuskausi / Billing Period:"
            value={
              form.periodStart && form.periodEnd
                ? `${formatDate(form.periodStart)} – ${formatDate(form.periodEnd)}`
                : '—'
            }
          />
          {/* Wolt reference is internal only — not shown on invoice */}
        </div>
      </div>

      <Divider />

      {/* ── Account Holder (Buyer) ── */}
      <div style={{ marginBottom: '14pt' }}>
        <div style={{ fontSize: '7pt', textTransform: 'uppercase', color: '#888', marginBottom: '3pt' }}>
          Laskutettava / Account Holder (Bill To)
        </div>
        <div style={{ fontWeight: 'bold', fontSize: '10pt' }}>
          {form.buyerName || '—'}
        </div>
        <div>{form.buyerAddress}</div>
        <div>
          {form.buyerPostalCode} {form.buyerCity}
        </div>
        <div>Y-tunnus: {form.buyerBusinessId}</div>
        <div>ALV-tunnus: {form.buyerVatId}</div>
      </div>

      <Divider />

      {/* ── Line items table ── */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          marginBottom: '14pt',
          fontSize: '8.5pt',
        }}
      >
        <thead>
          <tr
            style={{
              backgroundColor: '#f0f0f0',
              borderTop: '0.5pt solid #ccc',
              borderBottom: '0.5pt solid #ccc',
            }}
          >
            <Th align="left">Description / Kuvaus</Th>
            <Th align="right" w="58pt">Earned{' '}(ex VAT) €</Th>
            <Th align="right" w="40pt">Share %</Th>
            <Th align="right" w="58pt">Claimed{' '}(ex VAT) €</Th>
            <Th align="right" w="36pt">VAT %</Th>
            <Th align="right" w="48pt">VAT €</Th>
            <Th align="right" w="58pt">Total €</Th>
          </tr>
        </thead>
        <tbody>
          {lineItems.length === 0 && (
            <tr>
              <td colSpan={8} style={{ padding: '6pt', color: '#aaa', fontStyle: 'italic' }}>
                No line items
              </td>
            </tr>
          )}
          {lineItems.map((item, idx) => {
            const c = calculated.lineItems[idx]
            return (
              <tr
                key={item.id}
                style={{
                  borderBottom: '0.3pt solid #e0e0e0',
                  backgroundColor: idx % 2 === 1 ? '#fafafa' : 'transparent',
                }}
              >
                <Td>{item.description || <span style={{ color: '#aaa' }}>—</span>}</Td>
                <Td align="right">{item.earnedAmount ? parseFloat(item.earnedAmount).toFixed(2) : '—'}</Td>
                <Td align="right">{item.sharePercent || '100'}%</Td>
                <Td align="right">{c ? f(c.amountExVat) : '0.00'}</Td>
                <Td align="right">{item.vatRate}%</Td>
                <Td align="right">{c ? f(c.vatAmount) : '0.00'}</Td>
                <Td align="right" bold>
                  {c ? f(c.totalAmount) : '0.00'}
                </Td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* ── Totals ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12pt' }}>
        <div style={{ width: '260pt' }}>
          {/* Per-rate breakdown */}
          {calculated.vatBreakdown.map((vb) => (
            <div key={vb.rate}>
              <TotalRow
                label={`Veroton myynti / Tax base ALV ${vb.rate}%:`}
                value={`${f(vb.base)} €`}
                small
              />
              {vb.rate > 0 && (
                <TotalRow label={`ALV / VAT ${vb.rate}%:`} value={`${f(vb.vat)} €`} small />
              )}
            </div>
          ))}
          <div style={{ borderTop: '0.5pt solid #ccc', marginTop: '4pt', paddingTop: '4pt' }} />
          <TotalRow label="Yhteensä ilman ALV / Total excl. VAT:" value={`${f(calculated.totalExVat)} €`} />
          <TotalRow label="ALV yhteensä / Total VAT:" value={`${f(calculated.totalVat)} €`} />
          {/* Grand total */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              borderTop: '1pt solid #111',
              paddingTop: '4pt',
              marginTop: '4pt',
              fontWeight: 'bold',
              fontSize: '11pt',
            }}
          >
            <span>Maksettava yhteensä / Total due:</span>
            <span>{f(calculated.totalIncVat)} €</span>
          </div>
        </div>
      </div>

      {/* ── Amount in words ── */}
      <div style={{ fontSize: '8pt', color: '#444', fontStyle: 'italic', marginBottom: '14pt' }}>
        Summa sanoin / Amount in words:{' '}
        {calculated.totalIncVat > 0 ? numberToWords(calculated.totalIncVat) : '—'}
      </div>

      {/* ── Payment info box ── */}
      <div
        style={{
          border: '0.8pt solid #ccc',
          padding: '8pt',
          marginTop: '4pt',
        }}
      >
        <div style={{ fontWeight: 'bold', fontSize: '8.5pt', borderBottom: '0.3pt solid #ddd', paddingBottom: '4pt', marginBottom: '5pt' }}>
          MAKSUTIEDOT / PAYMENT DETAILS
        </div>
        <PayRow label="Saajan nimi / Payee:" value={form.sellerName || '—'} />
        <PayRow label="Tilinumero / IBAN:" value={formatIban(form.sellerIban) || '—'} />
        <PayRow label="BIC / SWIFT:" value={form.sellerBic || '—'} />
        {liveRef && (
          <PayRow label="Viitenumero / Reference:" value={liveRef.formattedReference} bold />
        )}
        {liveRef ? (
          <div style={{ fontSize: '7.5pt', color: '#555', marginTop: '6pt', fontStyle: 'italic' }}>
            Merkitse viitenumero maksun yhteyteen.<br />
            Include the reference number with your payment.
          </div>
        ) : (
          <div style={{ fontSize: '7.5pt', color: '#888', marginTop: '6pt', fontStyle: 'italic' }}>
            Ei viitenumeroa / No reference number
          </div>
        )}
      </div>

      {/* ── Notes ── */}
      {form.notes && (
        <div style={{ marginTop: '10pt' }}>
          <div style={{ fontSize: '7pt', textTransform: 'uppercase', color: '#888', marginBottom: '3pt' }}>
            Huomiot / Notes
          </div>
          <div style={{ lineHeight: '1.5' }}>{form.notes}</div>
        </div>
      )}

      {/* ── Footer ── */}
      <div
        style={{
          borderTop: '0.3pt solid #ddd',
          marginTop: '24pt',
          paddingTop: '4pt',
          fontSize: '7pt',
          color: '#aaa',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>
          {form.sellerName} | Y-tunnus: {form.sellerBusinessId} | {form.sellerVatId}
        </span>
        <span>Lasku nro / Invoice No {form.invoiceNumber}</span>
      </div>
    </div>
  )
}

// ── Small helper sub-components ─────────────────────────────────────────────

function Divider() {
  return (
    <div
      style={{ borderBottom: '0.5pt solid #ccc', marginBottom: '14pt' }}
    />
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2pt', gap: '8pt' }}>
      <span style={{ color: '#666', fontSize: '8pt', minWidth: '130pt', textAlign: 'right' }}>{label}</span>
      <span style={{ fontWeight: 'bold', minWidth: '80pt', textAlign: 'left' }}>{value}</span>
    </div>
  )
}

function Th({
  children,
  align = 'left',
  w,
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
  w?: string
}) {
  return (
    <th
      style={{
        padding: '4pt 5pt',
        textAlign: align,
        fontWeight: 'bold',
        fontSize: '8pt',
        width: w,
      }}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  align = 'left',
  bold,
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
  bold?: boolean
}) {
  return (
    <td
      style={{
        padding: '4pt 5pt',
        textAlign: align,
        fontWeight: bold ? 'bold' : 'normal',
      }}
    >
      {children}
    </td>
  )
}

function TotalRow({
  label,
  value,
  small,
}: {
  label: string
  value: string
  small?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '2pt',
        fontSize: small ? '8pt' : '9pt',
        color: small ? '#666' : '#111',
      }}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

function PayRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: '8pt', marginBottom: '3pt' }}>
      <span style={{ color: '#666', fontSize: '8pt', width: '120pt', flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: bold ? 'bold' : 'normal', fontSize: bold ? '10pt' : '9pt', letterSpacing: bold ? '0.5px' : undefined }}>{value}</span>
    </div>
  )
}
