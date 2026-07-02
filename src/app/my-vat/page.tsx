import { getBookkeeperVatSummary } from '@/actions/bookkeeper-invoice'
import { getGigVatSummary } from '@/actions/owner-books'
import { getClients } from '@/actions/client'
import MyVatApp from '@/components/MyVatApp'

export const dynamic = 'force-dynamic'

export default async function MyVatPage({
  searchParams,
}: {
  searchParams: { year?: string; clientId?: string }
}) {
  const year     = parseInt(searchParams.year ?? '') || new Date().getFullYear()
  const clientId = searchParams.clientId ? parseInt(searchParams.clientId, 10) : null

  const [bkSummary, clients, gigData] = await Promise.all([
    getBookkeeperVatSummary(year),
    getClients(),
    clientId ? getGigVatSummary(clientId, year) : Promise.resolve(null),
  ])

  return (
    <MyVatApp
      year={year}
      bkQuarters={bkSummary.quarters}
      bkAnnualExVat={bkSummary.annualExVat}
      bkAnnualVat={bkSummary.annualVat}
      bkAnnualIncVat={bkSummary.annualIncVat}
      bkInvoiceCount={bkSummary.invoiceCount}
      gigQuarters={gigData?.quarters ?? null}
      gigClientName={gigData?.clientName ?? null}
      gigAnnualOutputVat={gigData?.annualGigOutputVat ?? 0}
      gigAnnualSubsOutputVat={gigData?.annualSubsOutputVat ?? 0}
      gigAnnualWorkerInputVat={gigData?.annualWorkerInputVat ?? 0}
      gigAnnualExpenseInputVat={gigData?.annualExpenseInputVat ?? 0}
      clients={(clients as { id: number; displayId: string; name: string }[])}
      selectedClientId={clientId}
    />
  )
}
