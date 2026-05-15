import { NextRequest, NextResponse } from 'next/server'
import React from 'react'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { getBookkeeperInvoice } from '@/actions/bookkeeper-invoice'
import { BookkeeperInvoicePDF } from '@/lib/bookkeeper-pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const invoice = await getBookkeeperInvoice(params.id)

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  const element = React.createElement(
    BookkeeperInvoicePDF,
    { invoice }
  ) as unknown as React.ReactElement<DocumentProps>

  const buffer = await renderToBuffer(element)
  const uint8 = new Uint8Array(buffer)
  const filename = `invoice-${invoice.invoiceNumber}.pdf`

  return new NextResponse(uint8, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(uint8.byteLength),
    },
  })
}
