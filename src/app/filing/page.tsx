import { getClients } from '@/actions/client'
import FilingGuide from '@/components/FilingGuide'

export const dynamic = 'force-dynamic'

export default async function FilingPage({ searchParams }: { searchParams: { year?: string } }) {
  const currentYear = new Date().getFullYear()
  const year = parseInt(searchParams.year ?? '') || currentYear
  const years = Array.from({ length: 3 }, (_, i) => currentYear - i)
  const clients = await getClients()

  return (
    <FilingGuide
      clients={clients as { id: number; displayId: string; name: string }[]}
      year={year}
      years={years}
    />
  )
}
