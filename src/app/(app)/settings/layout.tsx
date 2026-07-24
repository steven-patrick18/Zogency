import Link from 'next/link'
import { requirePermission } from '@/lib/authz'

const TABS = [
  { label: 'General', href: '/settings' },
  { label: 'Users', href: '/settings/users' },
  { label: 'Departments', href: '/settings/departments' },
  { label: 'Roles', href: '/settings/roles' },
  { label: 'Automation', href: '/settings/automation' },
  { label: 'License', href: '/settings/license' },
]

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requirePermission('settings.manage')
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
      <nav className="mt-4 flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="rounded-t-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-white hover:text-slate-900"
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <div className="mt-6 max-w-3xl">{children}</div>
    </div>
  )
}
