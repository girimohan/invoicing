import { getNextBkInvoiceNumber } from '@/actions/bookkeeper-invoice'
import BookkeeperInvoiceApp from '@/components/BookkeeperInvoiceApp'

export const dynamic = 'force-dynamic'

export default async function BookkeeperPage({
  searchParams,
}: {
  searchParams: { client?: string }
}) {
  const initialInvoiceNumber = await getNextBkInvoiceNumber()
  const requested = parseInt(searchParams.client ?? '', 10)
  const initialClientId = Number.isFinite(requested) ? requested : null

  return (
    <BookkeeperInvoiceApp
      initialInvoiceNumber={initialInvoiceNumber}
      initialClientId={initialClientId}
    />
  )
}
