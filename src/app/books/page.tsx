import { getClients } from '@/actions/client'
import BooksApp from '@/components/BooksApp'

export const dynamic = 'force-dynamic'

export default async function BooksPage({
  searchParams,
}: {
  searchParams: { client?: string; year?: string }
}) {
  const clients = await getClients()
  const requested = parseInt(searchParams.client ?? '', 10)
  // Only honour a client id that actually exists — a stale link should land on
  // the picker, not on an empty books view for a deleted client.
  const initialClientId = clients.some((c) => c.id === requested) ? requested : null
  const initialYear = parseInt(searchParams.year ?? '', 10) || new Date().getFullYear()

  return (
    <BooksApp
      initialClients={clients as { id: number; displayId: string; name: string; role: string; invoiceCount?: number; buyerInvoiceCount?: number }[]}
      initialClientId={initialClientId}
      initialYear={initialYear}
    />
  )
}
