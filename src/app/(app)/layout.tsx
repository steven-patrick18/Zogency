import Link from 'next/link'
import { requireSession, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'
import { logoutAction } from '@/modules/auth/actions'
import { getAgentStatus } from '@/modules/monitoring/agent-status'
import { getSelfDaySummary } from '@/modules/hr/attendance'
import { getWorkspaceLicense } from '@/modules/settings/service'
import { vendorModeEnabled } from '@/modules/vendor/config'
import { PunchWidget } from './punch-widget'

// Module nav. `perm` mirrors each page's own requirePermission gate, so a user
// only sees links they can actually open (no perm = everyone). Keep these in
// sync with the page guards.
const NAV: Array<{ label: string; href: string; perm?: string }> = [
  { label: 'Dashboard', href: '/dashboard' }, // requireSession only
  { label: 'Leads', href: '/leads', perm: 'leads.view' },
  { label: 'Pipeline', href: '/pipeline', perm: 'leads.view' },
  { label: 'Clients', href: '/clients', perm: 'clients.view' },
  { label: 'Projects', href: '/projects', perm: 'tasks.view' },
  { label: 'Retention', href: '/retention', perm: 'clients.view' },
  { label: 'Campaigns', href: '/campaigns', perm: 'campaigns.view' },
  { label: 'Support', href: '/support', perm: 'clients.view' },
  { label: 'Meetings', href: '/meetings', perm: 'clients.view' },
  { label: 'Tasks', href: '/tasks', perm: 'tasks.view' },
  { label: 'HR', href: '/hr', perm: 'hr.view' },
  { label: 'Invoices', href: '/invoices', perm: 'invoices.view' },
  { label: 'Reports', href: '/reports', perm: 'reports.view' },
  { label: 'Productivity', href: '/productivity', perm: 'reports.view' },
  { label: 'Chat', href: '/chat' }, // requireSession only
  { label: 'Settings', href: '/settings', perm: 'settings.manage' },
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
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [license, unreadCount, me, agent, self] = await withTenant(async () =>
    Promise.all([
      getWorkspaceLicense(),
      prisma.notification.count({ where: { userId: session.user.id, readAt: null } }),
      prisma.user.findUnique({ where: { id: session.user.id }, select: { avatar: true } }),
      getAgentStatus(session.user.id),
      getSelfDaySummary(session.user.id, today),
    ]),
  )
  const banner = LICENSE_BANNERS[license.state]
  const sidebarAvatar = me?.avatar ?? null
  const perms = session.user.permissions
  // Show only the modules this user can open (menu mirrors the page guards).
  const nav = NAV.filter((item) => !item.perm || perms.includes(item.perm))
  if (vendorModeEnabled() && perms.includes('vendor.manage')) {
    nav.push({ label: 'Vendor', href: '/vendor' })
  }

  return (
    // Full-viewport shell: sidebar + topbar stay fixed, only <main> scrolls.
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-slate-950">
        <div className="border-b border-slate-800 px-5 py-4">
          <span className="text-lg font-bold text-white">Zogency</span>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {nav.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
            >
              {item.label}
            </Link>
          ))}
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
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-end gap-2 border-b border-slate-200 bg-white px-6 py-2">
          {/* Punch in/out + today's active hours — only for linked employees. */}
          {self && (
            <PunchWidget punchedIn={self.punchedIn} activeMinutes={self.activeMinutes} />
          )}
          {/* Desktop-agent status — only for users with monitoring enabled. */}
          {agent.hasToken && (
            <Link
              href="/agent"
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                agent.connected
                  ? 'bg-green-100 text-green-700'
                  : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
              }`}
              title={agent.connected ? 'Desktop monitoring is active' : 'Set up the desktop monitoring agent'}
            >
              <span className={`h-2 w-2 rounded-full ${agent.connected ? 'bg-green-500' : 'bg-amber-500'}`} />
              {agent.connected ? 'Monitoring on' : 'Set up monitoring'}
            </Link>
          )}
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
          <div className={`shrink-0 border-b px-6 py-2 text-sm ${banner.cls}`}>{banner.text}</div>
        )}
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  )
}
