'use client'

import { useFormStatus } from 'react-dom'
import { portalApproveCampaignAction, portalRequestRevisionAction } from '@/modules/portal/actions'

function SubmitButton({ label, pendingLabel, className }: { label: string; pendingLabel: string; className: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingLabel : label}
    </button>
  )
}

export function ApproveButton({ campaignId }: { campaignId: string }) {
  return (
    <form action={portalApproveCampaignAction}>
      <input type="hidden" name="campaignId" value={campaignId} />
      <SubmitButton
        label="Approve"
        pendingLabel="Approving…"
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
      />
    </form>
  )
}

export function RequestChangesForm({ campaignId }: { campaignId: string }) {
  return (
    <form action={portalRequestRevisionAction} className="space-y-2">
      <input type="hidden" name="campaignId" value={campaignId} />
      <textarea
        name="feedback"
        rows={3}
        required
        placeholder="Describe the changes you'd like…"
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
      />
      <SubmitButton
        label="Request changes"
        pendingLabel="Sending…"
        className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
      />
    </form>
  )
}
