import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  type Styles,
} from '@react-pdf/renderer'
import type { BookkeeperInvoice } from '@prisma/client'
import { formatIban } from './calculations'

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

  sellerBlock: { width: '48%' },
  sellerName: { fontFamily: 'Helvetica-Bold', fontSize: 12, marginBottom: 3 },
  sellerLine: { lineHeight: 1.5, fontSize: 9 },
  sellerMeta: { lineHeight: 1.5, fontSize: 9, marginTop: 6 },

  invoiceBlock: { width: '48%', alignItems: 'flex-end' },
  invoiceTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 18,
    marginBottom: 10,
    letterSpacing: 1,
  },
  detailRow: { flexDirection: 'row', marginBottom: 3 },
  detailLabel: { width: 140, color: '#666666', fontSize: 8 },
  detailValue: { fontFamily: 'Helvetica-Bold', fontSize: 9 },

  divider: { borderBottom: '0.5pt solid #cccccc', marginBottom: 16 },

  sectionLabel: {
    fontSize: 7,
    color: '#888888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  buyerName: { fontFamily: 'Helvetica-Bold', fontSize: 10, marginBottom: 2 },
  buyerLine: { lineHeight: 1.5, fontSize: 9 },

  // Service table
  table: { marginTop: 4, marginBottom: 20 },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderTop: '0.5pt solid #cccccc',
    borderBottom: '0.5pt solid #cccccc',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderBottom: '0.3pt solid #e8e8e8',
  },
  colH: { fontFamily: 'Helvetica-Bold', fontSize: 7.5 },
  colDesc: { flex: 1 },
  colAmt: { width: 70, textAlign: 'right' },
  colVatPct: { width: 50, textAlign: 'right' },
  colVatAmt: { width: 60, textAlign: 'right' },
  colTotal: { width: 70, textAlign: 'right' },

  // Totals
  totalsBlock: { alignItems: 'flex-end', marginBottom: 14 },
  totalRow: { flexDirection: 'row', marginBottom: 3 },
  totalLabel: {
    width: 160,
    textAlign: 'right',
    paddingRight: 10,
    color: '#555555',
    fontSize: 9,
  },
  totalValue: { width: 68, textAlign: 'right', fontSize: 9 },
  grandTotalRow: {
    flexDirection: 'row',
    borderTop: '1pt solid #111111',
    marginTop: 4,
    paddingTop: 5,
  },
  grandTotalLabel: {
    width: 160,
    textAlign: 'right',
    paddingRight: 10,
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
  },
  grandTotalValue: {
    width: 68,
    textAlign: 'right',
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
  },

  paymentBox: {
    border: '0.8pt solid #cccccc',
    padding: 10,
    marginTop: 8,
  },
  paymentBoxTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    marginBottom: 6,
    borderBottom: '0.3pt solid #dddddd',
    paddingBottom: 4,
  },
  paymentRow: { flexDirection: 'row', marginBottom: 3 },
  paymentLabel: { width: 70, color: '#666666', fontSize: 8 },
  paymentValue: { fontFamily: 'Helvetica-Bold', fontSize: 9 },

  notesBox: { marginTop: 12 },
  notesLabel: { fontSize: 7, color: '#888888', textTransform: 'uppercase', marginBottom: 3 },
  notesText: { fontSize: 9, lineHeight: 1.5 },

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

function fmt(n: number) { return n.toFixed(2) }

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString('fi-FI', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

export function BookkeeperInvoicePDF({ invoice }: { invoice: BookkeeperInvoice }) {
  return (
    <Document
      title={`Lasku ${invoice.invoiceNumber}`}
      author={invoice.bkName}
      creator="Wolt Substitute Invoice Tool"
    >
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.headerRow}>
          <View style={s.sellerBlock}>
            <Text style={s.sellerName}>{invoice.bkName}</Text>
            <Text style={s.sellerLine}>{invoice.bkAddress}</Text>
            <Text style={s.sellerLine}>{invoice.bkPostalCode} {invoice.bkCity}</Text>
            {invoice.bkPhone ? <Text style={s.sellerLine}>Puh: {invoice.bkPhone}</Text> : null}
            {invoice.bkEmail ? <Text style={s.sellerLine}>{invoice.bkEmail}</Text> : null}
            <Text style={s.sellerMeta}>Y-tunnus: {invoice.bkBusinessId}</Text>
            <Text style={s.sellerMeta}>ALV-tunnus: {invoice.bkVatId}</Text>
          </View>

          <View style={s.invoiceBlock}>
            <Text style={s.invoiceTitle}>LASKU / INVOICE</Text>
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Laskunumero / Invoice No:</Text>
              <Text style={s.detailValue}>{invoice.invoiceNumber}</Text>
            </View>
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Päivämäärä / Date:</Text>
              <Text style={s.detailValue}>{fmtDate(invoice.issueDate)}</Text>
            </View>
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Eräpäivä / Due Date:</Text>
              <Text style={s.detailValue}>{fmtDate(invoice.dueDate)}</Text>
            </View>
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Maksuehto / Payment Terms:</Text>
              <Text style={s.detailValue}>{invoice.paymentTerms}</Text>
            </View>
          </View>
        </View>

        <View style={s.divider} />

        {/* Bill To */}
        <View style={{ marginBottom: 16 }}>
          <Text style={s.sectionLabel}>Laskutettava / Bill To</Text>
          <Text style={s.buyerName}>{invoice.clientName}</Text>
          {invoice.clientAddress ? <Text style={s.buyerLine}>{invoice.clientAddress}</Text> : null}
          {(invoice.clientPostalCode || invoice.clientCity) ? (
            <Text style={s.buyerLine}>{invoice.clientPostalCode} {invoice.clientCity}</Text>
          ) : null}
          {invoice.clientBusinessId ? <Text style={s.buyerLine}>Y-tunnus: {invoice.clientBusinessId}</Text> : null}
          {invoice.clientVatId ? <Text style={s.buyerLine}>ALV-tunnus: {invoice.clientVatId}</Text> : null}
          {invoice.clientEmail ? <Text style={s.buyerLine}>{invoice.clientEmail}</Text> : null}
        </View>

        <View style={s.divider} />

        {/* Service table */}
        <View style={s.table}>
          <View style={s.tableHeaderRow}>
            <Text style={[s.colH, s.colDesc]}>Palvelu / Service</Text>
            <Text style={[s.colH, s.colAmt]}>Veroton / Excl. VAT</Text>
            <Text style={[s.colH, s.colVatPct]}>ALV %</Text>
            <Text style={[s.colH, s.colVatAmt]}>ALV / VAT</Text>
            <Text style={[s.colH, s.colTotal]}>Yhteensä / Total</Text>
          </View>
          <View style={s.tableRow}>
            <Text style={s.colDesc}>{invoice.serviceDescription}</Text>
            <Text style={s.colAmt}>{fmt(invoice.amountExVat)} €</Text>
            <Text style={s.colVatPct}>{fmt(invoice.vatRate)} %</Text>
            <Text style={s.colVatAmt}>{fmt(invoice.vatAmount)} €</Text>
            <Text style={s.colTotal}>{fmt(invoice.totalIncVat)} €</Text>
          </View>
        </View>

        {/* Totals */}
        <View style={s.totalsBlock}>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Veroton myynti / Tax base:</Text>
            <Text style={s.totalValue}>{fmt(invoice.amountExVat)} €</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>ALV {fmt(invoice.vatRate)} % / VAT {fmt(invoice.vatRate)} %:</Text>
            <Text style={s.totalValue}>{fmt(invoice.vatAmount)} €</Text>
          </View>
          <View style={s.grandTotalRow}>
            <Text style={s.grandTotalLabel}>Maksettava yhteensä / Total due:</Text>
            <Text style={s.grandTotalValue}>{fmt(invoice.totalIncVat)} €</Text>
          </View>
        </View>

        {/* Payment details */}
        <View style={s.paymentBox}>
          <Text style={s.paymentBoxTitle}>Maksutiedot / Payment Details</Text>
          <View style={s.paymentRow}>
            <Text style={s.paymentLabel}>IBAN:</Text>
            <Text style={s.paymentValue}>{formatIban(invoice.bkIban)}</Text>
          </View>
          <View style={s.paymentRow}>
            <Text style={s.paymentLabel}>BIC/SWIFT:</Text>
            <Text style={s.paymentValue}>{invoice.bkBic}</Text>
          </View>
          <View style={s.paymentRow}>
            <Text style={s.paymentLabel}>Viite / Ref:</Text>
            <Text style={s.paymentValue}>{invoice.invoiceNumber}</Text>
          </View>
          <View style={s.paymentRow}>
            <Text style={s.paymentLabel}>Eräpäivä:</Text>
            <Text style={s.paymentValue}>{fmtDate(invoice.dueDate)}</Text>
          </View>
          <View style={s.paymentRow}>
            <Text style={s.paymentLabel}>Summa:</Text>
            <Text style={s.paymentValue}>{fmt(invoice.totalIncVat)} €</Text>
          </View>
        </View>

        {invoice.notes ? (
          <View style={s.notesBox}>
            <Text style={s.notesLabel}>Lisätiedot / Notes</Text>
            <Text style={s.notesText}>{invoice.notes}</Text>
          </View>
        ) : null}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text>{invoice.bkName} | Y-tunnus: {invoice.bkBusinessId}</Text>
          <Text>Lasku nro / Invoice No {invoice.invoiceNumber}</Text>
        </View>
      </Page>
    </Document>
  )
}
