import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  type Styles,
} from '@react-pdf/renderer'
import type { Prisma } from '@prisma/client'
import { numberToWords } from './numberToWords'
import { formatIban, formatDateFromDate } from './calculations'

type InvoiceWithItems = Prisma.InvoiceGetPayload<{
  include: { lineItems: true; reference: true }
}>

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    paddingTop: 40,
    paddingBottom: 50,
    paddingHorizontal: 50,
    color: '#111111',
  },

  // ─── Header row ───────────────────────────────────────────────────────────
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },

  // Seller block (left)
  sellerBlock: { width: '48%' },
  sellerName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
    marginBottom: 3,
  },
  sellerLine: { lineHeight: 1.5, fontSize: 9 },
  sellerMeta: { lineHeight: 1.5, fontSize: 9, marginTop: 6 },

  // Invoice title + details (right)
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

  // ─── Divider ──────────────────────────────────────────────────────────────
  divider: { borderBottom: '0.5pt solid #cccccc', marginBottom: 16 },

  // ─── Buyer section ────────────────────────────────────────────────────────
  sectionLabel: {
    fontSize: 7,
    color: '#888888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  buyerName: { fontFamily: 'Helvetica-Bold', fontSize: 10, marginBottom: 2 },
  buyerLine: { lineHeight: 1.5, fontSize: 9 },

  // ─── Line items table ─────────────────────────────────────────────────────
  table: { marginTop: 4, marginBottom: 16 },
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
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottom: '0.3pt solid #e8e8e8',
  },
  tableRowAlt: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottom: '0.3pt solid #e8e8e8',
    backgroundColor: '#fafafa',
  },
  colH: { fontFamily: 'Helvetica-Bold', fontSize: 7.5 },
  colDesc: { flex: 1 },
  colEarned: { width: 58, textAlign: 'right' },
  colShare: { width: 40, textAlign: 'right' },
  colClaimed: { width: 58, textAlign: 'right' },
  colVatPct: { width: 36, textAlign: 'right' },
  colVatAmt: { width: 52, textAlign: 'right' },
  colTotal: { width: 58, textAlign: 'right' },

  // ─── Totals block ─────────────────────────────────────────────────────────
  totalsBlock: { alignItems: 'flex-end', marginBottom: 12 },
  totalRow: { flexDirection: 'row', marginBottom: 2 },
  totalLabel: {
    width: 160,
    textAlign: 'right',
    paddingRight: 10,
    color: '#555555',
    fontSize: 9,
  },
  totalValue: { width: 68, textAlign: 'right', fontSize: 9 },
  vatSubLabel: {
    width: 160,
    textAlign: 'right',
    paddingRight: 10,
    color: '#888888',
    fontSize: 8,
  },
  vatSubValue: { width: 68, textAlign: 'right', fontSize: 8, color: '#888888' },
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

  // ─── Amount in words ──────────────────────────────────────────────────────
  amountWords: {
    fontSize: 8,
    color: '#444444',
    marginBottom: 16,
    fontStyle: 'italic',
  },

  // ─── Payment box ──────────────────────────────────────────────────────────
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
  paymentLabel: { width: 130, color: '#666666', fontSize: 8 },
  paymentValue: { fontFamily: 'Helvetica-Bold', fontSize: 9 },
  paymentRefValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  paymentNote: {
    fontSize: 7.5,
    color: '#555555',
    marginTop: 6,
    fontStyle: 'italic',
  },

  // ─── Notes ────────────────────────────────────────────────────────────────
  notesBox: { marginTop: 12 },
  notesLabel: { fontSize: 7, color: '#888888', textTransform: 'uppercase', marginBottom: 3 },
  notesText: { fontSize: 9, lineHeight: 1.5 },

  // ─── Footer (fixed, every page) ───────────────────────────────────────────
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

function fmt(n: number): string {
  return n.toFixed(2)
}

export function InvoicePDF({ invoice }: { invoice: InvoiceWithItems }) {
  // Build VAT breakdown from line items
  const vatMap = new Map<number, { base: number; vat: number }>()
  for (const item of invoice.lineItems) {
    const e = vatMap.get(item.vatRate) ?? { base: 0, vat: 0 }
    vatMap.set(item.vatRate, {
      base: Math.round((e.base + item.amountExVat) * 100) / 100,
      vat: Math.round((e.vat + item.vatAmount) * 100) / 100,
    })
  }
  const vatBreakdown = Array.from(vatMap.entries())
    .map(([rate, { base, vat }]) => ({ rate, base, vat }))
    .sort((a, b) => b.rate - a.rate)

  return (
    <Document
      title={`Lasku ${invoice.invoiceNumber}`}
      author={invoice.sellerName}
      creator="Wolt Substitute Invoice Tool"
    >
      <Page size="A4" style={s.page}>
        {/* ── Header: Seller (left) + Invoice title/details (right) ── */}
        <View style={s.headerRow}>
          {/* Seller block */}
          <View style={s.sellerBlock}>
            <Text style={s.sellerName}>{invoice.sellerName}</Text>
            <Text style={s.sellerLine}>{invoice.sellerAddress}</Text>
            <Text style={s.sellerLine}>
              {invoice.sellerPostalCode} {invoice.sellerCity}
            </Text>
            {invoice.sellerPhone ? (
              <Text style={s.sellerLine}>Puh: {invoice.sellerPhone}</Text>
            ) : null}
            {invoice.sellerEmail ? (
              <Text style={s.sellerLine}>{invoice.sellerEmail}</Text>
            ) : null}
            <Text style={s.sellerMeta}>Y-tunnus: {invoice.sellerBusinessId}</Text>
            <Text style={s.sellerMeta}>ALV-tunnus: {invoice.sellerVatId}</Text>
          </View>

          {/* Invoice title + details */}
          <View style={s.invoiceBlock}>
            <Text style={s.invoiceTitle}>LASKU / INVOICE</Text>

            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Laskunumero / Invoice No:</Text>
              <Text style={s.detailValue}>{invoice.invoiceNumber}</Text>
            </View>
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Päivämäärä / Date:</Text>
              <Text style={s.detailValue}>{formatDateFromDate(invoice.invoiceDate)}</Text>
            </View>
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Eräpäivä / Due Date:</Text>
              <Text style={s.detailValue}>{formatDateFromDate(invoice.dueDate)}</Text>
            </View>
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Maksuehto / Payment Terms:</Text>
              <Text style={s.detailValue}>{invoice.paymentTerms}</Text>
            </View>
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Laskutuskausi / Billing Period:</Text>
              <Text style={s.detailValue}>
                {formatDateFromDate(invoice.periodStart)} –{' '}
                {formatDateFromDate(invoice.periodEnd)}
              </Text>
            </View>
            {/* Wolt self-billing reference is internal only — not printed */}
          </View>
        </View>

        <View style={s.divider} />

        {/* ── Account Holder (Buyer) ── */}
        <View style={{ marginBottom: 16 }}>
          <Text style={s.sectionLabel}>Laskutettava / Account Holder (Bill To)</Text>
          <Text style={s.buyerName}>{invoice.buyerName}</Text>
          <Text style={s.buyerLine}>{invoice.buyerAddress}</Text>
          <Text style={s.buyerLine}>
            {invoice.buyerPostalCode} {invoice.buyerCity}
          </Text>
          <Text style={s.buyerLine}>Y-tunnus: {invoice.buyerBusinessId}</Text>
          <Text style={s.buyerLine}>ALV-tunnus: {invoice.buyerVatId}</Text>
        </View>

        <View style={s.divider} />

        {/* ── Line items table ── */}
        <View style={s.table}>
          {/* Header row */}
          <View style={s.tableHeaderRow}>
            <Text style={[s.colDesc, s.colH]}>Description / Kuvaus</Text>
            <Text style={[s.colEarned, s.colH]}>Earned{`\n`}(ex VAT) €</Text>
            <Text style={[s.colShare, s.colH]}>Share{`\n`}%</Text>
            <Text style={[s.colClaimed, s.colH]}>Claimed{`\n`}(ex VAT) €</Text>
            <Text style={[s.colVatPct, s.colH]}>VAT{`\n`}%</Text>
            <Text style={[s.colVatAmt, s.colH]}>VAT{`\n`}Amount €</Text>
            <Text style={[s.colTotal, s.colH]}>Total{`\n`}Amount €</Text>
          </View>

          {/* Data rows */}
          {invoice.lineItems.map((item, idx) => (
            <View
              key={item.id}
              style={idx % 2 === 0 ? s.tableRow : s.tableRowAlt}
            >
              <Text style={s.colDesc}>{item.description}</Text>
              <Text style={s.colEarned}>{fmt(item.earnedAmount)}</Text>
              <Text style={s.colShare}>{item.sharePercent}%</Text>
              <Text style={s.colClaimed}>{fmt(item.amountExVat)}</Text>
              <Text style={s.colVatPct}>{item.vatRate}%</Text>
              <Text style={s.colVatAmt}>{fmt(item.vatAmount)}</Text>
              <Text style={s.colTotal}>{fmt(item.totalAmount)}</Text>
            </View>
          ))}
        </View>

        {/* ── VAT breakdown + totals ── */}
        <View style={s.totalsBlock}>
          {/* Per-rate sub-totals */}
          {vatBreakdown.map((vb) => (
            <React.Fragment key={vb.rate}>
              <View style={s.totalRow}>
                <Text style={s.vatSubLabel}>
                  Veroton myynti / Tax base ALV {vb.rate}%:
                </Text>
                <Text style={s.vatSubValue}>{fmt(vb.base)} €</Text>
              </View>
              {vb.rate > 0 && (
                <View style={s.totalRow}>
                  <Text style={s.vatSubLabel}>ALV / VAT {vb.rate}%:</Text>
                  <Text style={s.vatSubValue}>{fmt(vb.vat)} €</Text>
                </View>
              )}
            </React.Fragment>
          ))}

          {/* Grand totals */}
          <View style={{ ...s.totalRow, marginTop: 4 }}>
            <Text style={s.totalLabel}>Yhteensä ilman ALV / Total excl. VAT:</Text>
            <Text style={s.totalValue}>{fmt(invoice.totalExVat)} €</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>ALV yhteensä / Total VAT:</Text>
            <Text style={s.totalValue}>{fmt(invoice.totalVat)} €</Text>
          </View>
          <View style={s.grandTotalRow}>
            <Text style={s.grandTotalLabel}>Maksettava yhteensä / Total due:</Text>
            <Text style={s.grandTotalValue}>{fmt(invoice.totalIncVat)} €</Text>
          </View>
        </View>

        {/* ── Amount in words ── */}
        <Text style={s.amountWords}>
          Summa sanoin / Amount in words: {numberToWords(invoice.totalIncVat)}
        </Text>

        {/* ── Payment information box ── */}
        <View style={s.paymentBox}>
          <Text style={s.paymentBoxTitle}>
            MAKSUTIEDOT / PAYMENT DETAILS
          </Text>
          <View style={s.paymentRow}>
            <Text style={s.paymentLabel}>Saajan nimi / Payee:</Text>
            <Text style={s.paymentValue}>{invoice.sellerName}</Text>
          </View>
          <View style={s.paymentRow}>
            <Text style={s.paymentLabel}>Tilinumero / IBAN:</Text>
            <Text style={s.paymentValue}>{formatIban(invoice.sellerIban)}</Text>
          </View>
          <View style={s.paymentRow}>
            <Text style={s.paymentLabel}>BIC / SWIFT:</Text>
            <Text style={s.paymentValue}>{invoice.sellerBic}</Text>
          </View>
          {invoice.reference ? (
            <View style={s.paymentRow}>
              <Text style={s.paymentLabel}>Viitenumero / Reference:</Text>
              <Text style={s.paymentRefValue}>{invoice.reference.formattedReference}</Text>
            </View>
          ) : null}
        </View>

        {/* ── Notes ── */}
        {invoice.notes ? (
          <View style={s.notesBox}>
            <Text style={s.notesLabel}>Huomiot / Notes</Text>
            <Text style={s.notesText}>{invoice.notes}</Text>
          </View>
        ) : null}

        {/* ── Fixed footer (every page) ── */}
        <View style={s.footer} fixed>
          <Text>
            {invoice.sellerName} | Y-tunnus: {invoice.sellerBusinessId} |{' '}
            {invoice.sellerVatId}
          </Text>
          <Text>Lasku nro / Invoice No {invoice.invoiceNumber}</Text>
        </View>
      </Page>
    </Document>
  )
}
