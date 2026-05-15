import { getInvoices } from '@/actions/invoice'
import InvoiceHistoryApp from '@/components/InvoiceHistoryApp'

export default async function InvoicesPage() {
  const invoices = await getInvoices()
  return <InvoiceHistoryApp invoices={invoices as Parameters<typeof InvoiceHistoryApp>[0]['invoices']} />
}

