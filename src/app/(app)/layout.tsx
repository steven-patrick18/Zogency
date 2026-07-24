import Link from 'next/link'
import { requireSession, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'
import { logoutAction } from '@/modules/auth/actions'
import { getWorkspaceLicense } from '@/modules/settings/service'
import { vendorModeEnabled } from '@/modules/vendor/config'

// Module nav — items without an href ship in later sprints (doc 10).
const NAV: Array<{ label: string; href?: string; sprint?: string }> = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Leads', href: '/leads' },
  { label: 'Pipeline', href: '/pipeline' },
  { label: 'Clients', href: '/clients' },
  { label: 'Retention', href: '/retention' },
  { label: 'Campaigns', href: '/campaigns' },
  { label: 'Tasks', href: '/tasks' },
  { label: 'HR', href: '/hr' },
  { label: 'Invoices', href: '/invoices' },
  { label: 'Reports', href: '/reports' },
  { label: 'Settings', href: '/settings' },
]

const LICENSE_BANNERS: Record<string, { text: string; cls: string }> = {
  expiring: {
    text: 'The workspace license expires soon — renew from Settings → License.',
    cls: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  grace: {
    text: 'The workspace license has expired (grace period active) — install a new key in Settings → License.',
    cls: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  expired: {
    text: 'License expired — the workspace is read-only until a new key is installed in Settings → License.',
    cls: 'bg-red-50 text-red-800 border-red-200',
  },
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession()
  const [license, unreadCount, me] = await withTenant(async () =>
    Promise.all([
      getWorkspaceLicense(),
      prisma.notification.count({ where: { userId: session.user.id, readAt: null } }),
      prisma.user.findUnique({ where: { id: session.user.id }, select: { avatar: true } }),
    ]),
  )
  const banner = LICENSE_BANNERS[license.state]
  const sidebarAvatar = me?.avatar ?? null
  const nav = vendorModeEnabled()
    ? [...NAV, { label: 'Vendor', href: '/vendor' }]
    : NAV

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="flex w-56 flex-col border-r border-slate-200 bg-slate-950">
        <div className="border-b border-slate-800 px-5 py-4">
          <span className="text-lg font-bold text-white">Zogency</span>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {nav.map((item) =>
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
        <div className="flex items-start gap-3 border-t border-slate-800 px-5 py-4">
          {sidebarAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sidebarAvatar} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
              {session.user.name?.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{session.user.name}</p>
          <p className="truncate text-xs text-slate-400">{session.user.roles.join(', ')}</p>
          <form action={logoutAction} className="mt-3">
            <button className="text-xs font-medium text-slate-400 hover:text-white">Sign out</button>
          </form>
          </div>
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-end border-b border-slate-200 bg-white px-6 py-2">
          <Link
            href="/notifications"
            className="relative rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            🔔
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </Link>
        </header>
        {banner && (
          <div className={`border-b px-6 py-2 text-sm ${banner.cls}`}>{banner.text}</div>
        )}
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  )
}
