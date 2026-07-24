import { requirePermission, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'
import { LeadForm } from './lead-form'

export default async function NewLeadPage() {
  await requirePermission('leads.create')
  const sources = await withTenant(() =>
    prisma.leadSource.findMany({ orderBy: { name: 'asc' } }),
  )
  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-slate-900">New lead</h1>
      <p className="mt-1 text-sm text-slate-500">
        Needs a phone or an email — duplicates are merged automatically, never re-created.
      </p>
      <LeadForm sources={sources.map((s) => ({ id: s.id, name: s.name }))} />
    </div>
  )
}
