import { NextRequest, NextResponse } from 'next/server'
import React from 'react'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { getInvoice } from '@/actions/invoice'
import { InvoicePDF } from '@/lib/pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const invoice = await getInvoice(params.id)

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  // Cast required: createElement returns a generic ReactElement; renderToBuffer
  // expects ReactElement<DocumentProps> which InvoicePDF satisfies at runtime.
  const element = React.createElement(
    InvoicePDF,
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
