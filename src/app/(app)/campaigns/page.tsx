import Link from 'next/link'
import { requirePermission, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'
import { NewCampaignForm } from './new-campaign-form'

const STATUS_STYLES: Record<string, string> = {
  brief: 'bg-slate-100 text-slate-600',
  planning: 'bg-blue-100 text-blue-700',
  creative: 'bg-purple-100 text-purple-700',
  approval: 'bg-amber-100 text-amber-700',
  launched: 'bg-green-100 text-green-700',
  monitoring: 'bg-teal-100 text-teal-700',
  reporting: 'bg-indigo-100 text-indigo-700',
  closed: 'bg-slate-200 text-slate-600',
}

export default async function CampaignsPage() {
  await requirePermission('campaigns.view')
  const { campaigns, clients, users } = await withTenant(async () => {
    const [campaigns, clients, users] = await Promise.all([
      prisma.campaign.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.client.findMany({
        where: { archivedAt: null },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      prisma.user.findMany({ select: { id: true, name: true } }),
    ])
    return { campaigns, clients, users }
  })
  const clientName = new Map(clients.map((c) => [c.id, c.name]))
  const userName = new Map(users.map((u) => [u.id, u.name]))

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Campaigns</h1>
      <p className="mt-1 text-sm text-slate-500">
        Brief-to-closure marketing workflow (FR-3.1–3.20) — stage gates enforced.
      </p>
      <div className="mt-4">
        <NewCampaignForm clients={clients} />
      </div>
      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Campaign</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Manager</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {campaigns.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                  No campaigns yet — create one above.
                </td>
              </tr>
            )}
            {campaigns.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/campaigns/${c.id}`} className="font-medium text-slate-900 hover:text-indigo-600">
                    {c.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {c.clientId ? (clientName.get(c.clientId) ?? '—') : 'Internal'}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[c.status] ?? 'bg-slate-100 text-slate-600'}`}>
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {c.managerId ? (userName.get(c.managerId) ?? '—') : '—'}
                </td>
                <td className="px-4 py-3 text-slate-600">{c.createdAt.toDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
