'use client'

// Whole-row navigation for the productivity table (a <tr> can't be a <Link>).
import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { enableMonitoringForAllAction, type HrActionState } from '@/modules/hr/actions'

export function RowLink({ href, children }: { href: string; children: React.ReactNode }) {
  const router = useRouter()
  return (
    <tr
      onClick={() => router.push(href)}
      className="cursor-pointer hover:bg-indigo-50/50"
      title="View full activity"
    >
      {children}
    </tr>
  )
}

// Bulk-issue agent tokens for every active employee (hr.manage only).
export function EnableAllButton() {
  const [state, formAction, pending] = useActionState<HrActionState, FormData>(enableMonitoringForAllAction, {})
  return (
    <form action={formAction} className="flex items-center gap-2">
      <button
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {pending ? 'Enabling…' : 'Enable monitoring for everyone'}
      </button>
      {state.success && <span className="text-xs text-green-700">{state.success}</span>}
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  )
}
