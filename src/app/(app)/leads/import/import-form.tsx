'use client'

import { useActionState } from 'react'
import { importCsvAction, type ImportState } from '@/modules/leads/actions'

export function ImportForm() {
  const [state, formAction, pending] = useActionState<ImportState, FormData>(importCsvAction, {})

  return (
    <form action={formAction} className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <input
        type="file"
        name="file"
        accept=".csv,text/csv"
        required
        className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-indigo-500"
      />
      {state.error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}
      {state.done && (
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <p>
            <span className="font-semibold text-green-700">{state.created} created</span> ·{' '}
            <span className="font-semibold text-blue-700">{state.merged} merged (duplicates)</span> ·{' '}
            <span className="font-semibold text-red-600">{state.errors?.length ?? 0} errors</span>
          </p>
          {state.errors && state.errors.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-xs text-red-600">
              {state.errors.map((e) => (
                <li key={e.row}>Row {e.row}: {e.reason}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <button
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {pending ? 'Importing…' : 'Import'}
      </button>
    </form>
  )
}
