import Link from 'next/link'
import { prismaUnscoped } from '@/lib/db/prisma'
import { getPortalSession } from '@/lib/portal-session'
import { portalLogoutAction } from '@/modules/portal/actions'

const NAV = [
  { label: 'Overview', href: '/portal' },
  { label: 'Approvals', href: '/portal/approvals' },
  { label: 'Invoices', href: '/portal/invoices' },
  { label: 'Support', href: '/portal/support' },
]

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getPortalSession()

  // /portal/login and /portal/setup/[token] have no session — they render their
  // own full-screen forms without the portal chrome. Protected pages guard
  // themselves (getPortalSession + redirect), so no redirect loop here.
  if (!session) return <>{children}</>

  const client = await prismaUnscoped.client.findFirst({
    where: { id: session.clientId, tenantId: session.tenantId },
    select: { name: true },
  })
  const clientName = client?.name ?? 'Client'

  return (
    <div className="min-h-full bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600">Client Portal</p>
            <h1 className="text-lg font-bold text-slate-900">{clientName}</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-slate-500 sm:inline">{session.name}</span>
            <form action={portalLogoutAction}>
              <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
                Log out
              </button>
            </form>
          </div>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 px-4">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-t-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  )
}
