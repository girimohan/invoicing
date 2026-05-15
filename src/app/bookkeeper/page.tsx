import { getNextBkInvoiceNumber } from '@/actions/bookkeeper-invoice'
import BookkeeperInvoiceApp from '@/components/BookkeeperInvoiceApp'

export default async function BookkeeperPage() {
  const initialInvoiceNumber = await getNextBkInvoiceNumber()
  return <BookkeeperInvoiceApp initialInvoiceNumber={initialInvoiceNumber} />
}
