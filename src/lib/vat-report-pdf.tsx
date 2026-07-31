import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  type Styles,
} from '@react-pdf/renderer'
import type { VatPeriod } from './vat-report'
import { formatCurrency as fmt } from './calculations'

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    paddingTop: 40,
    paddingBottom: 50,
    paddingHorizontal: 50,
    color: '#111111',
  },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  clientBlock: { width: '55%' },
  clientName: { fontFamily: 'Helvetica-Bold', fontSize: 12, marginBottom: 3 },
  clientLine: { lineHeight: 1.5, fontSize: 9 },

  reportBlock: { width: '40%', alignItems: 'flex-end' },
  reportTitle: { fontFamily: 'Helvetica-Bold', fontSize: 16, marginBottom: 6, letterSpacing: 0.5 },
  reportLine: { fontSize: 9, color: '#555555', lineHeight: 1.5 },
  reportLineStrong: { fontFamily: 'Helvetica-Bold', fontSize: 9 },

  divider: { borderBottom: '0.5pt solid #cccccc', marginBottom: 16 },

  sectionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    marginBottom: 8,
    marginTop: 14,
  },

  table: { marginBottom: 4 },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderTop: '0.5pt solid #cccccc',
    borderBottom: '0.5pt solid #cccccc',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottom: '0.3pt solid #e8e8e8',
  },
  colH: { fontFamily: 'Helvetica-Bold', fontSize: 7.5 },
  colDesc: { flex: 1 },
  colAmt: { width: 80, textAlign: 'right' },

  subtotalRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderTop: '0.8pt solid #999999',
  },
  subtotalLabel: { flex: 1, fontFamily: 'Helvetica-Bold', fontSize: 9 },
  subtotalAmt: { width: 80, textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 9 },

  netBox: {
    marginTop: 20,
    padding: 14,
    border: '1pt solid #111111',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  netLabel: { fontFamily: 'Helvetica-Bold', fontSize: 12 },
  netValue: { fontFamily: 'Helvetica-Bold', fontSize: 16 },

  emptyNote: { fontSize: 9, color: '#888888', fontStyle: 'italic', paddingVertical: 8, paddingHorizontal: 8 },

  footer: {
    position: 'absolute',
    bottom: 24,
    left: 50,
    right: 50,
    fontSize: 7,
    color: '#aaaaaa',
    borderTop: '0.3pt solid #dddddd',
    paddingTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
} as unknown as Styles)

type ReportRow = { label: string; amount: number }

function Section({ title, rows, subtotalLabel }: { title: string; rows: ReportRow[]; subtotalLabel: string }) {
  const subtotal = rows.reduce((sum, r) => sum + r.amount, 0)
  return (
    <View>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={s.table}>
        <View style={s.tableHeaderRow}>
          <Text style={[s.colH, s.colDesc]}>Source</Text>
          <Text style={[s.colH, s.colAmt]}>VAT (€)</Text>
        </View>
        {rows.length === 0 ? (
          <Text style={s.emptyNote}>No amounts for this period.</Text>
        ) : (
          rows.map((r) => (
            <View style={s.tableRow} key={r.label}>
              <Text style={s.colDesc}>{r.label}</Text>
              <Text style={s.colAmt}>{fmt(r.amount)}</Text>
            </View>
          ))
        )}
        <View style={s.subtotalRow}>
          <Text style={s.subtotalLabel}>{subtotalLabel}</Text>
          <Text style={s.subtotalAmt}>{fmt(subtotal)}</Text>
        </View>
      </View>
    </View>
  )
}

export function VatReportPDF({
  client,
  period,
  year,
  isAccountHolder,
  generatedAt,
}: {
  client: { name: string; businessId: string | null; vatId: string | null }
  period: VatPeriod
  year: number
  isAccountHolder: boolean
  generatedAt: Date
}) {
  const outputRows: ReportRow[] = isAccountHolder
    ? [
        { label: 'Own Wolt income (Myyntivero)', amount: period.outVatOwn },
        { label: 'Substitute worker invoices, output pass-through', amount: period.outVatSubs },
        { label: 'Bookkeeping services issued', amount: period.outVatBk },
      ].filter(r => r.amount !== 0)
    : [{ label: 'Your invoices (Myyntivero)', amount: period.outVat }].filter(r => r.amount !== 0)

  const inputRows: ReportRow[] = (isAccountHolder
    ? [
        { label: 'Worker invoices (paid to substitute workers)', amount: period.inVatW },
        { label: 'Bookkeeper service fee paid', amount: period.inVatBkFee },
        { label: 'Other business expenses', amount: period.inVatE },
      ]
    : [
        { label: 'Bookkeeper service fee paid', amount: period.inVatBkFee },
        { label: 'Other business expenses', amount: period.inVatE },
      ]
  ).filter(r => r.amount !== 0)

  const netPayable = period.net >= 0
  const fmtDate = (d: Date) => d.toLocaleDateString('fi-FI', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <Document
      title={`VAT Filing Summary — ${client.name} — ${period.label}`}
      author={client.name}
      creator="Barmo Bookkeeping"
    >
      <Page size="A4" style={s.page}>
        <View style={s.headerRow}>
          <View style={s.clientBlock}>
            <Text style={s.clientName}>{client.name}</Text>
            {client.businessId && <Text style={s.clientLine}>Y-tunnus: {client.businessId}</Text>}
            {client.vatId && <Text style={s.clientLine}>ALV-tunnus: {client.vatId}</Text>}
          </View>
          <View style={s.reportBlock}>
            <Text style={s.reportTitle}>VAT FILING SUMMARY</Text>
            <Text style={s.reportLineStrong}>{period.label}, {year}</Text>
            <Text style={s.reportLine}>Generated {fmtDate(generatedAt)}</Text>
          </View>
        </View>

        <View style={s.divider} />

        <Section title="VAT collected — Myyntivero (output VAT)" rows={outputRows} subtotalLabel="Total output VAT" />
        <Section title="VAT deductible — Ostovero (input VAT)" rows={inputRows} subtotalLabel="Total input VAT" />

        <View style={s.netBox}>
          <Text style={s.netLabel}>{netPayable ? 'Payable to Vero' : 'Refundable from Vero'}</Text>
          <Text style={s.netValue}>{fmt(Math.abs(period.net))} €</Text>
        </View>

        <View style={s.footer} fixed>
          <Text>VAT filing summary — for client reference only, not a formal invoice or tax filing document.</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
