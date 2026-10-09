import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePermission, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'
import { toggleOnboardingItemAction } from '@/modules/tasks/actions'
import { taskVisibilityWhere } from '@/modules/tasks/task-scope'
import { EditClientForm, EditContactForm } from './edit-forms'
import { InvitePortalButton } from './invite-button'

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission('clients.view')
  const canEdit = session.user.permissions.includes('clients.edit')
  const { id } = await params
  const data = await withTenant(async () => {
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        contacts: true,
        handovers: true,
        onboardingItems: { orderBy: { dueOn: 'asc' } },
        projects: {
          include: {
            tasks: {
              where: taskVisibilityWhere({ id: session.user.id, permissions: session.user.permissions }),
            },
          },
        },
        invoices: { orderBy: { createdAt: 'desc' } },
      },
    })
    if (!client) return null
    const owners = await prisma.user.findMany({
      where: { status: 'active' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
    return { client, owners }
  })
  if (!data) notFound()
  const { client, owners } = data
  const handover = client.handovers[0]

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{client.name}</h1>
        <p className="text-sm text-slate-500">
          Client since {client.createdAt.toDateString()}
          {' · '}<span className="capitalize">{client.status}</span>
          {client.gstin && <> · GSTIN {client.gstin}</>}
          {client.originLeadId && (
            <> · <Link href={`/leads/${client.originLeadId}`} className="text-indigo-600 hover:underline">origin lead</Link></>
          )}
        </p>
        {canEdit && (
          <div className="mt-3">
            <EditClientForm
              client={{
                id: client.id,
                name: client.name,
                legalName: client.legalName,
                gstin: client.gstin,
                status: client.status,
                ownerId: client.ownerId,
              }}
              owners={owners}
            />
          </div>
        )}
      </div>

      {handover && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm">
          <h2 className="font-semibold text-slate-900">Handover</h2>
          <p className="mt-2 text-slate-700"><span className="font-medium">Context:</span> {handover.accountContext}</p>
          <p className="mt-1 text-slate-700"><span className="font-medium">Commitments:</span> {handover.commitments}</p>
          {handover.kickoffScheduledAt && (
            <p className="mt-1 text-slate-500">Kickoff scheduled: {handover.kickoffScheduledAt.toDateString()}</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Onboarding checklist</h2>
          <ul className="mt-3 space-y-2">
            {client.onboardingItems.map((item) => (
              <li key={item.id} className="flex items-center gap-2 text-sm">
                <form action={toggleOnboardingItemAction}>
                  <input type="hidden" name="itemId" value={item.id} />
                  <input type="hidden" name="clientId" value={client.id} />
                  <button
                    className={`flex h-5 w-5 items-center justify-center rounded border text-xs ${
                      item.doneAt ? 'border-green-500 bg-green-500 text-white' : 'border-slate-300 bg-white'
                    }`}
                  >
                    {item.doneAt ? '✓' : ''}
                  </button>
                </form>
                <span className={item.doneAt ? 'text-slate-400 line-through' : 'text-slate-800'}>{item.title}</span>
                {item.dueOn && !item.doneAt && (
                  <span className="text-xs text-slate-400">due {item.dueOn.toDateString()}</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">Contacts</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {client.contacts.map((c) => (
                <li key={c.id}>
                  <p className="font-medium text-slate-900">{c.name} {c.isPrimary && <span className="text-xs text-indigo-600">primary</span>}</p>
                  <p className="text-xs text-slate-500">{[c.role, c.phone, c.email].filter(Boolean).join(' · ')}</p>
                  {c.email && <InvitePortalButton contactId={c.id} />}
                  {canEdit && (
                    <EditContactForm
                      contact={{ id: c.id, name: c.name, role: c.role, phone: c.phone, email: c.email, isPrimary: c.isPrimary }}
                      clientId={client.id}
                    />
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">Projects</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {client.projects.map((p) => (
                <li key={p.id} className="flex items-center justify-between">
                  <span className="text-slate-800">{p.name}</span>
                  <span className="text-xs text-slate-500">
                    {p.tasks.filter((t) => t.status === 'done').length}/{p.tasks.length} tasks done · {p.type}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">Invoices</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {client.invoices.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between">
                  <span className="text-slate-800">{inv.number}</span>
                  <span className="text-slate-600">₹{Number(inv.total).toLocaleString('en-IN')}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    inv.status === 'paid' ? 'bg-green-100 text-green-700'
                    : inv.status === 'overdue' ? 'bg-red-100 text-red-700'
                    : 'bg-amber-100 text-amber-700'
                  }`}>{inv.status}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
