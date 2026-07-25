// Friendly access-denied page. requirePermission() redirects here when a user
// hits a module they lack the permission for (e.g. a direct URL).
import Link from 'next/link'

export default async function ForbiddenPage({
  searchParams,
}: {
  searchParams: Promise<{ need?: string }>
}) {
  const { need } = await searchParams
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-2xl">
        🔒
      </div>
      <h1 className="mt-4 text-xl font-bold text-slate-900">You don’t have access to this</h1>
      <p className="mt-2 text-sm text-slate-500">
        This area needs a permission your role doesn’t include
        {need ? <> (<code className="rounded bg-slate-100 px-1 py-0.5 text-xs">{need}</code>)</> : ''}.
        Ask an admin to grant it under Settings → Roles if you need it.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
      >
        Back to dashboard
      </Link>
    </div>
  )
}
