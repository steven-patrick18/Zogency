import Link from 'next/link'
import { requireSession } from '@/lib/authz'

// requireSession (not hr.view): attendance & leave self-service must work for
// every signed-in user — manage-only tabs gate themselves inside their pages.
const TABS = [
  { label: 'Recruitment', href: '/hr' },
  { label: 'Employees', href: '/hr/employees' },
  { label: 'Attendance & Leave', href: '/hr/attendance' },
  { label: 'Performance', href: '/hr/performance' },
  { label: 'Policy & Calendar', href: '/hr/policy' },
  { label: 'Payroll', href: '/hr/payroll' },
  { label: 'Capacity', href: '/hr/capacity' },
]

export default async function HrLayout({ children }: { children: React.ReactNode }) {
  await requireSession()
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">HR &amp; Team</h1>
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
      <div className="mt-6">{children}</div>
    </div>
  )
}
