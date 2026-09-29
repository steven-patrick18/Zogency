'use client'

import { useActionState, useState } from 'react'
import { saveRoutingRuleAction, type RoutingActionState } from '@/modules/leads/routing-actions'

const field =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none'

export type RoutingUser = { id: string; name: string; isSalesRep: boolean }

export function LeadRoutingForm({
  rule,
  users,
}: {
  rule: { id: string; name: string; targetUserIds: string[] } | null
  users: RoutingUser[]
}) {
  const [selected, setSelected] = useState<string[]>(rule?.targetUserIds ?? [])
  const [state, formAction, pending] = useActionState<RoutingActionState, FormData>(
    saveRoutingRuleAction,
    {},
  )
  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const salesReps = users.filter((u) => u.isSalesRep)

  return (
    <form action={formAction} className="space-y-3">
      {rule && <input type="hidden" name="ruleId" value={rule.id} />}
      {selected.map((id) => (
        <input key={id} type="hidden" name="targetUserIds" value={id} />
      ))}

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="routing-name">
          Rule name
        </label>
        <input
          id="routing-name"
          name="name"
          defaultValue={rule?.name ?? 'Round-robin to Sales Reps'}
          required
          className={field}
        />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">
            Leads rotate between these people ({selected.length} selected)
          </span>
          {salesReps.length > 0 && (
            <button
              type="button"
              onClick={() => setSelected(salesReps.map((u) => u.id))}
              className="text-xs font-medium text-indigo-600 hover:underline"
            >
              Select all Sales Reps
            </button>
          )}
        </div>
        <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 p-1">
          {users.map((u) => (
            <label
              key={u.id}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50"
            >
              <input type="checkbox" checked={selected.includes(u.id)} onChange={() => toggle(u.id)} />
              <span className="text-slate-800">{u.name}</span>
              {u.isSalesRep && (
                <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">
                  Sales Rep
                </span>
              )}
            </label>
          ))}
          {users.length === 0 && <p className="px-2 py-3 text-sm text-slate-400">No active users.</p>}
        </div>
      </div>

      {selected.length === 0 && (
        <p className="text-xs text-amber-600">
          With nobody selected the rule is skipped and new leads arrive unassigned.
        </p>
      )}
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-green-600">{state.success}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Save lead routing'}
      </button>
    </form>
  )
}
