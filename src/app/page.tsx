import { getNextInvoiceNumber, getInvoice } from '@/actions/invoice'
import InvoiceApp from '@/components/InvoiceApp'

export default async function Home({ searchParams }: { searchParams: { edit?: string } }) {
  const editId = searchParams.edit ?? null
  const editInvoice = editId ? await getInvoice(editId) : null
  const initialInvoiceNumber = editInvoice?.invoiceNumber ?? await getNextInvoiceNumber()

  return <InvoiceApp initialInvoiceNumber={initialInvoiceNumber} editInvoice={editInvoice} />
}
