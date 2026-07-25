'use client'

// Top-bar punch in/out + today's active (login) hours, for the current employee.
import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { punchAction, type HrActionState } from '@/modules/hr/actions'

export function PunchWidget({
  punchedIn,
  outAt,
  activeMinutes,
}: {
  punchedIn: boolean
  outAt: boolean // already punched out today
  activeMinutes: number
}) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState<HrActionState, FormData>(punchAction, {})
  useEffect(() => {
    if (state.success) router.refresh()
  }, [state.success, router])

  const hrs = `${Math.floor(activeMinutes / 60)}h ${activeMinutes % 60}m`
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-500" title="Active time reported by the desktop agent today">
        <span className="font-semibold text-slate-800">{hrs}</span> today
      </span>
      {!outAt && (
        <form action={formAction}>
          <input type="hidden" name="mode" value="office" />
          <button
            disabled={pending}
            className={`rounded-full px-3 py-1 text-xs font-semibold text-white disabled:opacity-50 ${
              punchedIn ? 'bg-slate-700 hover:bg-slate-600' : 'bg-emerald-600 hover:bg-emerald-500'
            }`}
          >
            {pending ? '…' : punchedIn ? 'Punch out' : 'Punch in'}
          </button>
        </form>
      )}
      {outAt && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">Punched out</span>}
    </div>
  )
}
