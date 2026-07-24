import { requirePermission, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'
import { deleteContentAction, moveContentStatusAction } from '@/modules/content/actions'
import { ContentForm } from './content-form'

const COLUMNS: Array<{ key: string; label: string }> = [
  { key: 'idea', label: 'Idea' },
  { key: 'drafting', label: 'Drafting' },
  { key: 'review', label: 'Review' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'published', label: 'Published' },
]

const CHANNEL_STYLES: Record<string, string> = {
  instagram: 'bg-pink-100 text-pink-700',
  facebook: 'bg-blue-100 text-blue-700',
  blog: 'bg-amber-100 text-amber-700',
  email: 'bg-purple-100 text-purple-700',
  youtube: 'bg-red-100 text-red-700',
  other: 'bg-slate-100 text-slate-600',
}

export default async function ContentPage() {
  const session = await requirePermission('campaigns.view')
  const [rawItems, clients] = await withTenant(() =>
    Promise.all([
      prisma.contentItem.findMany({ orderBy: { scheduledOn: 'asc' } }),
      prisma.client.findMany({ select: { id: true, name: true } }),
    ]),
  )
  const clientName = new Map(clients.map((c) => [c.id, c.name]))
  const canManage = session.user.permissions.includes('campaigns.edit')

  const items = rawItems.map((it) => ({
    id: it.id,
    title: it.title,
    channel: it.channel,
    status: it.status,
    scheduledOn: it.scheduledOn.toISOString().slice(0, 10),
    client: it.clientId ? (clientName.get(it.clientId) ?? null) : null,
  }))

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Content calendar</h1>
      <p className="mt-1 text-sm text-slate-500">
        Plan and track content across channels from idea to published.
      </p>
      {canManage && <ContentForm clients={clients.map((c) => ({ id: c.id, name: c.name }))} />}

      <div className="mt-6 flex gap-3 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const column = items.filter((it) => it.status === col.key)
          return (
            <div key={col.key} className="w-64 shrink-0 rounded-xl bg-slate-200/60 p-2">
              <div className="flex items-center justify-between px-2 py-1">
                <span className="text-sm font-semibold text-slate-700">{col.label}</span>
                <span className="text-xs text-slate-500">{column.length}</span>
              </div>
              <div className="mt-1 space-y-2">
                {column.map((it) => (
                  <div key={it.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900">{it.title}</p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${CHANNEL_STYLES[it.channel] ?? CHANNEL_STYLES.other}`}
                      >
                        {it.channel}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {it.scheduledOn}
                      {it.client ? ` · ${it.client}` : ''}
                    </p>
                    {canManage && (
                      <>
                        <form action={moveContentStatusAction} className="mt-2 flex flex-wrap gap-1">
                          <input type="hidden" name="id" value={it.id} />
                          {COLUMNS.filter((c) => c.key !== it.status).map((c) => (
                            <button
                              key={c.key}
                              name="status"
                              value={c.key}
                              className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-indigo-100 hover:text-indigo-700"
                            >
                              {c.label}
                            </button>
                          ))}
                        </form>
                        <form action={deleteContentAction} className="mt-1">
                          <input type="hidden" name="id" value={it.id} />
                          <button className="text-[10px] font-medium text-red-500 hover:underline">
                            Delete
                          </button>
                        </form>
                      </>
                    )}
                  </div>
                ))}
                {column.length === 0 && (
                  <p className="px-2 py-3 text-center text-xs text-slate-400">Empty</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
