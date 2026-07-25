import Link from 'next/link'
import { requirePermission } from '@/lib/authz'

const TABS = [
  { label: 'General', href: '/settings' },
  { label: 'Users', href: '/settings/users' },
  { label: 'Departments', href: '/settings/departments' },
  { label: 'Roles', href: '/settings/roles' },
  { label: 'Automation', href: '/settings/automation' },
  { label: 'Integrations', href: '/settings/integrations' },
  { label: 'License', href: '/settings/license' },
  { label: 'Server', href: '/settings/server', perm: 'system.manage' },
  { label: 'Security', href: '/settings/security' },
]

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePermission('settings.manage')
  const perms = session.user.permissions
  const tabs = TABS.filter((t) => !t.perm || perms.includes(t.perm))
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
      <nav className="mt-4 flex flex-wrap gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="rounded-t-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-white hover:text-slate-900"
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <div className="mt-6 max-w-5xl">{children}</div>
    </div>
  )
}
