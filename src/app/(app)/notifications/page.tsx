import { requireSession, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'
import { renderNotification } from '@/lib/notify'
import { markAllRead } from '@/modules/notifications/actions'

export default async function NotificationsPage() {
  const session = await requireSession()
  const notifications = await withTenant(() =>
    prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  )

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
        <form action={markAllRead}>
          <button className="text-sm font-medium text-indigo-600 hover:underline">
            Mark all read
          </button>
        </form>
      </div>
      <ul className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {notifications.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-slate-400">Nothing yet.</li>
        )}
        {notifications.map((n) => (
          <li key={n.id} className="flex items-start gap-3 px-4 py-3">
            <span
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? 'bg-slate-200' : 'bg-indigo-500'}`}
            />
            <div>
              <p className="text-sm text-slate-800">
                {renderNotification(n.templateKey, n.payload as Record<string, unknown>)}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">{n.createdAt.toLocaleString()}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
