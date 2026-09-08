import Link from 'next/link'

export const dynamic = 'force-dynamic'

const TOOLS = [
  {
    href: '/tools/yel',
    icon: '⊕',
    title: 'YEL Calculator',
    description: 'Estimate self-employed pension insurance premiums from annual työtulo, including the new-entrepreneur discount.',
    legacy: false,
  },
  {
    href: '/tools/invoice-generator',
    icon: '✦',
    title: 'Substitute Worker Invoice Generator',
    description:
      'Create an invoice from a substitute worker to an account holder, with share splits, VAT breakdown and PDF output. No longer part of the daily workflow — every client is now a platform owner — but kept fully working for historical invoices.',
    legacy: true,
  },
  {
    href: '/invoices',
    icon: '≡',
    title: 'Invoice History',
    description: 'All substitute worker invoices ever issued, grouped by worker or account holder, with per-year VAT totals and PDFs.',
    legacy: true,
  },
]

export default function ToolsPage() {
  return (
    <div className="page max-w-3xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tools</h1>
          <p className="page-subtitle">Calculators and legacy workflows kept outside the daily bookkeeping flow</p>
        </div>
      </div>

      <div className="space-y-3">
        {TOOLS.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="card card-pad block hover:shadow-card-hover hover:border-indigo-300 transition-all duration-150 group"
          >
            <div className="flex items-start gap-4">
              <span className="text-lg text-slate-300 group-hover:text-indigo-500 shrink-0 leading-none mt-0.5 transition-colors">{tool.icon}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-slate-800 group-hover:text-indigo-700">{tool.title}</span>
                  {tool.legacy && (
                    <span className="pill-neutral">Legacy</span>
                  )}
                </div>
                <p className="text-[11.5px] text-slate-500 mt-1.5 leading-relaxed">{tool.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
