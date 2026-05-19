import { getClients } from '@/actions/client'
import BooksApp from '@/components/BooksApp'

export default async function BooksPage() {
  const clients = await getClients()
  return <BooksApp initialClients={clients as { id: number; displayId: string; name: string; role: string }[]} />
}
