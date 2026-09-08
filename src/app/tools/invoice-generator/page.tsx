import { getNextInvoiceNumber, getInvoice } from '@/actions/invoice'
import InvoiceApp from '@/components/InvoiceApp'

export const dynamic = 'force-dynamic'

// Legacy: invoices from a substitute worker to an account holder. That model
// wound down when every client became a platform owner, but the tool is kept
// intact — historical invoices remain editable and the workflow may return.
export default async function InvoiceGeneratorPage({ searchParams }: { searchParams: { edit?: string } }) {
  const editId = searchParams.edit ?? null
  const editInvoice = editId ? await getInvoice(editId) : null
  const initialInvoiceNumber = editInvoice?.invoiceNumber ?? await getNextInvoiceNumber()

  return <InvoiceApp initialInvoiceNumber={initialInvoiceNumber} editInvoice={editInvoice} />
}
