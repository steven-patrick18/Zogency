'use client'

import { useActionState, useState } from 'react'
import { recordPaymentAction, type InvoiceActionState } from '@/modules/invoices/actions'

export function PaymentForm({ invoiceId }: { invoiceId: string }) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<InvoiceActionState, FormData>(recordPaymentAction, {})

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs font-medium text-indigo-600 hover:underline">
        Record payment
      </button>
    )
  }
  return (
    <form action={formAction} className="flex items-center gap-1">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input name="amount" type="number" step="0.01" required placeholder="₹" className="w-24 rounded border border-slate-300 px-2 py-1 text-xs" />
      <input name="reference" placeholder="Ref" className="w-20 rounded border border-slate-300 px-2 py-1 text-xs" />
      <button disabled={pending} className="rounded bg-green-600 px-2 py-1 text-xs font-semibold text-white hover:bg-green-500">
        {pending ? '…' : 'Save'}
      </button>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
      {state.success && <span className="text-xs text-green-700">✓</span>}
    </form>
  )
}
