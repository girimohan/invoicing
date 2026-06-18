'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  {
    section: 'Invoicing',
    links: [
      { href: '/',         label: 'New Invoice',       icon: '✦' },
      { href: '/invoices', label: 'Invoice History',   icon: '≡' },
    ],
  },
  {
    section: 'Management',
    links: [
      { href: '/clients',     label: 'Clients',             icon: '◈' },
      { href: '/bookkeeper',  label: 'Bookkeeper Invoice',  icon: '⬡' },
      { href: '/books',       label: 'Client Books',        icon: '◫' },
    ],
  },
  {
    section: 'Tools',
    links: [
      { href: '/tools', label: 'YEL Calculator', icon: '⊕' },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-52 bg-gray-900 text-white flex flex-col shrink-0 min-h-screen">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-gray-700/60">
        <div className="font-extrabold text-sm tracking-tight text-white leading-tight">Barmo Bookkeeping</div>
        <div className="text-[10px] text-gray-400 mt-0.5 font-medium">Invoice Manager</div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-5">
        {NAV.map((section) => (
          <div key={section.section}>
            <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest px-2 mb-1.5">
              {section.section}
            </div>
            <div className="space-y-0.5">
              {section.links.map((link) => {
                const isActive =
                  link.href === '/'
                    ? pathname === '/'
                    : pathname.startsWith(link.href)
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    <span className="text-[13px] leading-none w-4 text-center shrink-0">{link.icon}</span>
                    <span>{link.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-gray-700/60">
        <div className="text-[9px] text-gray-500 font-medium">Finnish Wolt Courier Invoicing</div>
      </div>
    </aside>
  )
}
