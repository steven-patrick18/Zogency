import Link from 'next/link'
import { requireSession } from '@/lib/authz'
import { logoutAction } from '@/modules/auth/actions'

// Module nav — items without an href ship in later sprints (doc 10).
const NAV: Array<{ label: string; href?: string; sprint?: string }> = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Leads', sprint: 'S2' },
  { label: 'Pipeline', sprint: 'S3' },
  { label: 'Clients', sprint: 'S6' },
  { label: 'Campaigns', sprint: 'P2' },
  { label: 'Tasks', sprint: 'S6' },
  { label: 'HR', sprint: 'P2' },
  { label: 'Invoices', sprint: 'S6' },
  { label: 'Reports', sprint: 'S6' },
  { label: 'Settings', sprint: 'S1' },
]

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession()

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="flex w-56 flex-col border-r border-slate-200 bg-slate-950">
        <div className="border-b border-slate-800 px-5 py-4">
          <span className="text-lg font-bold text-white">Zogency</span>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {NAV.map((item) =>
            item.href ? (
              <Link
                key={item.label}
                href={item.href}
                className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
              >
                {item.label}
              </Link>
            ) : (
              <span
                key={item.label}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-600"
                title={`Ships in ${item.sprint}`}
              >
                {item.label}
                <span className="text-[10px] uppercase tracking-wide">{item.sprint}</span>
              </span>
            ),
          )}
        </nav>
        <div className="border-t border-slate-800 px-5 py-4">
          <p className="truncate text-sm font-medium text-white">{session.user.name}</p>
          <p className="truncate text-xs text-slate-400">{session.user.roles.join(', ')}</p>
          <form action={logoutAction} className="mt-3">
            <button className="text-xs font-medium text-slate-400 hover:text-white">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  )
}
