import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'

export const metadata: Metadata = {
  title: 'Wolt Substitute Invoice Generator',
  description: 'Finnish invoicing tool for Wolt self-billing invoices',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fi">
      <body className="bg-gray-100 text-gray-900 text-sm">
        <nav className="bg-gray-800 text-white px-5 py-2 flex items-center gap-6 text-xs font-medium shrink-0">
          <span className="font-bold text-sm mr-4">Wolt Invoice Tool</span>
          <Link href="/" className="hover:text-gray-300">
            New Invoice
          </Link>
          <Link href="/invoices" className="hover:text-gray-300">
            Invoice History
          </Link>
          <Link href="/clients" className="hover:text-gray-300">
            Clients
          </Link>
          <Link href="/bookkeeper" className="hover:text-gray-300">
            Bookkeeper Invoice
          </Link>
        </nav>
        {children}
      </body>
    </html>
  )
}
