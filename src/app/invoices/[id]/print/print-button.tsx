'use client'

export function PrintButton() {
  return (
    <div className="fixed right-4 top-4 flex gap-2 print:hidden">
      <button
        onClick={() => window.print()}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-500"
      >
        Print / Save PDF
      </button>
      <button
        onClick={() => window.close()}
        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
      >
        Close
      </button>
    </div>
  )
}
