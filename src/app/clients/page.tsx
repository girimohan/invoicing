import { getClients, getNextClientDisplayId } from '@/actions/client'
import ClientsManager from '@/components/ClientsManager'

export const dynamic = 'force-dynamic'

export default async function ClientsPage() {
  const [clients, nextDisplayId] = await Promise.all([
    getClients(),
    getNextClientDisplayId(),
  ])

  return (
    <div className="max-w-4xl mx-auto px-6 py-6">
      <ClientsManager clients={clients} nextDisplayId={nextDisplayId} />
    </div>
  )
}
