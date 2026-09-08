import { getDashboardSummary } from '@/actions/dashboard'
import Dashboard from '@/components/Dashboard'

export const dynamic = 'force-dynamic'

export default async function Home({ searchParams }: { searchParams: { year?: string } }) {
  const currentYear = new Date().getFullYear()
  const year = parseInt(searchParams.year ?? '') || currentYear
  const years = Array.from({ length: 3 }, (_, i) => currentYear - i)
  const { clients } = await getDashboardSummary(year)

  return <Dashboard clients={clients} year={year} years={years} />
}
