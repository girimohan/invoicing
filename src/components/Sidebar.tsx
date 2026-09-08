'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavLink = { href: string; label: string; icon: React.ReactNode; hint?: string }

// ─── Icons ────────────────────────────────────────────────────────────────────
// Inline strokes rather than glyph characters: the old ✦ ◈ ⬡ symbols rendered
// at different weights and baselines depending on which font fell through.

const icon = (path: React.ReactNode) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round" className="w-[15px] h-[15px] shrink-0">
    {path}
  </svg>
)

const IconDashboard = icon(<><rect x="2.5" y="2.5" width="6" height="6" rx="1.5" /><rect x="11.5" y="2.5" width="6" height="6" rx="1.5" /><rect x="2.5" y="11.5" width="6" height="6" rx="1.5" /><rect x="11.5" y="11.5" width="6" height="6" rx="1.5" /></>)
const IconBooks     = icon(<><path d="M3 4.5A1.5 1.5 0 0 1 4.5 3H9v14H4.5A1.5 1.5 0 0 1 3 15.5v-11Z" /><path d="M17 4.5A1.5 1.5 0 0 0 15.5 3H11v14h4.5a1.5 1.5 0 0 0 1.5-1.5v-11Z" /></>)
const IconClients   = icon(<><circle cx="7.5" cy="7" r="2.8" /><path d="M2.5 16.5c0-2.5 2.2-4.2 5-4.2s5 1.7 5 4.2" /><path d="M13.5 8.2a2.6 2.6 0 0 0 0-4.9" /><path d="M15 16.5c0-1.9-.7-3.2-2-4" /></>)
const IconInvoice   = icon(<><path d="M5 2.5h10v15l-2.5-1.5L10 17.5 7.5 16 5 17.5v-15Z" /><path d="M8 7h4M8 10.5h4" /></>)
const IconVat       = icon(<><circle cx="10" cy="10" r="7.5" /><path d="M7 13 13 7" /><circle cx="7.6" cy="7.6" r="1.1" /><circle cx="12.4" cy="12.4" r="1.1" /></>)
const IconFiling    = icon(<><path d="M4 3.5h8.5L16 7v9.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-12a1 1 0 0 1 1-1Z" /><path d="M12 3.5V7h4" /><path d="m6.5 12 1.6 1.6L11.5 10" /></>)
const IconTools     = icon(<><path d="M12.6 3.4a3.9 3.9 0 0 0-5.2 4.8L3 12.6V17h4.4l4.4-4.4a3.9 3.9 0 0 0 4.8-5.2l-2.3 2.3-2.1-.6-.6-2.1 2.3-2.3Z" /></>)

const NAV: { section: string; links: NavLink[] }[] = [
  {
    section: 'Overview',
    links: [
      { href: '/',       label: 'Dashboard',    icon: IconDashboard },
      { href: '/filing', label: 'Filing Guide', icon: IconFiling },
    ],
  },
  {
    section: 'Clients',
    links: [
      { href: '/books',   label: 'Client Books', icon: IconBooks },
      { href: '/clients', label: 'Clients',      icon: IconClients },
    ],
  },
  {
    section: 'My Practice',
    links: [
      { href: '/bookkeeper', label: 'Service Invoices', icon: IconInvoice },
      { href: '/my-vat',     label: 'My VAT / OmaVero', icon: IconVat },
    ],
  },
  {
    section: 'Tools',
    links: [{ href: '/tools', label: 'Tools & Legacy', icon: IconTools }],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href))

  return (
    <aside className="w-56 bg-slate-900 text-slate-100 flex flex-col shrink-0 min-h-screen">
      {/* ── Brand ── */}
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center shrink-0">
            <span className="text-[13px] font-bold text-white leading-none">B</span>
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-[13px] text-white leading-tight truncate">Barmo Bookkeeping</div>
            <div className="text-[10px] text-slate-500 leading-tight">Client filing &amp; VAT</div>
          </div>
        </div>
      </div>

      {/* ── Primary action ──
          Issuing service-fee invoices is the practice's revenue step, so it
          gets a standing call to action rather than only a nav row. */}
      <div className="px-4 pb-4">
        <Link
          href="/bookkeeper"
          className="flex items-center justify-center gap-1.5 w-full rounded-lg bg-indigo-600 hover:bg-indigo-500
                     text-white text-[12px] font-semibold py-2 transition-colors duration-150 shadow-sm"
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            className="w-3.5 h-3.5">
            <path d="M10 4.5v11M4.5 10h11" />
          </svg>
          New Service Invoice
        </Link>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 px-3 pb-4 space-y-5 overflow-y-auto">
        {NAV.map((section) => (
          <div key={section.section}>
            <div className="text-[9px] font-semibold text-slate-600 uppercase tracking-[0.11em] px-2.5 mb-1.5">
              {section.section}
            </div>
            <div className="space-y-0.5">
              {section.links.map((link) => {
                const active = isActive(link.href)
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12.5px] font-medium
                                transition-colors duration-150 ${
                      active
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100'
                    }`}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-r bg-indigo-400" />
                    )}
                    <span className={active ? 'text-indigo-300' : 'text-slate-500'}>{link.icon}</span>
                    <span className="truncate">{link.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Footer ── */}
      <div className="px-4 py-3.5 border-t border-slate-800">
        <div className="text-[10px] text-slate-600 leading-relaxed">
          Finnish VAT &amp; income tax
          <br />
          bookkeeping for platform work
        </div>
      </div>
    </aside>
  )
}
