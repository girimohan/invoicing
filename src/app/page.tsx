import { getDashboardSummary } from '@/actions/dashboard'
import { getClients, getNextClientDisplayId } from '@/actions/client'
import Dashboard from '@/components/Dashboard'
import type { EditableClient } from '@/components/ClientDialog'

export const dynamic = 'force-dynamic'

export default async function Home({ searchParams }: { searchParams: { year?: string } }) {
  const currentYear = new Date().getFullYear()
  const year = parseInt(searchParams.year ?? '') || currentYear
  const years = Array.from({ length: 3 }, (_, i) => currentYear - i)

  const [{ clients }, records, nextDisplayId] = await Promise.all([
    getDashboardSummary(year),
    getClients(),
    getNextClientDisplayId(),
  ])

  return (
    <Dashboard
      clients={clients}
      records={records as EditableClient[]}
      nextDisplayId={nextDisplayId}
      year={year}
      years={years}
    />
  )
}
