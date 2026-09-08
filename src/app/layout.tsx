import type { Metadata } from 'next'
import Sidebar from '@/components/Sidebar'
import './globals.css'

export const metadata: Metadata = {
  title: 'Barmo Bookkeeping',
  description: 'Finnish VAT and income tax bookkeeping for platform-work sole traders',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fi">
      <body className="bg-canvas text-slate-800 text-sm font-sans flex min-h-screen antialiased">
        <Sidebar />
        <main className="flex-1 min-h-screen overflow-auto">
          {children}
        </main>
      </body>
    </html>
  )
}
