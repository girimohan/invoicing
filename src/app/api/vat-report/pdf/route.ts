import { NextRequest, NextResponse } from 'next/server'
import React from 'react'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { getClient } from '@/actions/client'
import { getOwnerBooks } from '@/actions/owner-books'
import { computeMonths, computePeriods, type VatFilingFrequency } from '@/lib/vat-report'
import { VatReportPDF } from '@/lib/vat-report-pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const clientId = Number(params.get('clientId'))
  const year = Number(params.get('year'))
  const freq = params.get('freq') as VatFilingFrequency | null
  const key = params.get('key')

  if (!clientId || !year || !freq || !key) {
    return NextResponse.json({ error: 'Missing clientId, year, freq, or key' }, { status: 400 })
  }
  if (freq !== 'quarterly' && freq !== 'semiannual' && freq !== 'annual') {
    return NextResponse.json({ error: 'Invalid freq' }, { status: 400 })
  }

  const client = await getClient(clientId)
  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }
  const isAccountHolder = client.role !== 'SUBSTITUTE_WORKER'

  const books = await getOwnerBooks(clientId, year)
  const months = computeMonths(books, isAccountHolder)
  const periods = computePeriods(months, freq, year)
  const period = periods.find((p) => p.key === key)
  if (!period) {
    return NextResponse.json({ error: 'Period not found' }, { status: 404 })
  }

  const element = React.createElement(
    VatReportPDF,
    { client, period, year, isAccountHolder, generatedAt: new Date() }
  ) as unknown as React.ReactElement<DocumentProps>

  const buffer = await renderToBuffer(element)
  const uint8 = new Uint8Array(buffer)
  const filename = `vat-report-${client.displayId}-${year}-${key}.pdf`

  return new NextResponse(uint8, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(uint8.byteLength),
    },
  })
}
