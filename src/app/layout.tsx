import type { Metadata } from 'next'
import Sidebar from '@/components/Sidebar'
import './globals.css'

export const metadata: Metadata = {
  title: 'Barmo Bookkeeping',
  description: 'Finnish invoicing tool for Wolt self-billing invoices',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fi">
      <body className="bg-gray-100 text-gray-900 text-sm flex min-h-screen">
        <Sidebar />
        <main className="flex-1 min-h-screen overflow-auto">
          {children}
        </main>
      </body>
    </html>
  )
}
