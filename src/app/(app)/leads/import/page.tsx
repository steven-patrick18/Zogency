import { requirePermission } from '@/lib/authz'
import { ImportForm } from './import-form'

export default async function ImportLeadsPage() {
  await requirePermission('leads.import')
  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-slate-900">Import leads from CSV</h1>
      <p className="mt-1 text-sm text-slate-500">
        Columns: <code className="rounded bg-slate-100 px-1">name</code> (required),{' '}
        <code className="rounded bg-slate-100 px-1">phone</code> /{' '}
        <code className="rounded bg-slate-100 px-1">email</code> (one required),{' '}
        <code className="rounded bg-slate-100 px-1">company</code>,{' '}
        <code className="rounded bg-slate-100 px-1">city</code>,{' '}
        <code className="rounded bg-slate-100 px-1">industry</code>. Duplicates are merged, not
        re-created — safe to re-run. This is also the BRB legacy-data migration path.
      </p>
      <ImportForm />
    </div>
  )
}
