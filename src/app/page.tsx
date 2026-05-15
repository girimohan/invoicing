import { getNextInvoiceNumber } from '@/actions/invoice'
import InvoiceApp from '@/components/InvoiceApp'

export default async function Home() {
  const initialInvoiceNumber = await getNextInvoiceNumber()

  return <InvoiceApp initialInvoiceNumber={initialInvoiceNumber} />
}
