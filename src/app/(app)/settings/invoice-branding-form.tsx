'use client'

import { useActionState, useState } from 'react'
import { saveInvoiceBrandingAction, type BrandingState } from '@/modules/settings/actions'

const TEMPLATES = [
  { key: 'classic', name: 'Classic', desc: 'Traditional bordered layout, black & white.' },
  { key: 'modern', name: 'Modern', desc: 'Coloured header band in your brand colour.' },
  { key: 'minimal', name: 'Minimal', desc: 'Clean, lots of whitespace, subtle lines.' },
]

export function InvoiceBrandingForm({
  currentTemplate,
  currentLogo,
}: {
  currentTemplate: string
  currentLogo: string | null
}) {
  const [state, formAction, pending] = useActionState<BrandingState, FormData>(saveInvoiceBrandingAction, {})
  const [preview, setPreview] = useState<string | null>(currentLogo)
  const [remove, setRemove] = useState(false)

  return (
    <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-6">
      <div>
        <h2 className="font-semibold text-slate-900">Invoice branding</h2>
        <p className="text-xs text-slate-400">Your logo and template appear on printed / PDF invoices.</p>
      </div>
      <form action={formAction} className="space-y-5">
        {/* Logo */}
        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700">Logo</span>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-32 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
              {preview && !remove ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="logo" className="max-h-14 max-w-[7.5rem] object-contain" />
              ) : (
                <span className="text-xs text-slate-400">No logo</span>
              )}
            </div>
            <div className="space-y-1">
              <input
                name="logo"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) {
                    setRemove(false)
                    const r = new FileReader()
                    r.onload = () => setPreview(r.result as string)
                    r.readAsDataURL(f)
                  }
                }}
                className="block text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
              />
              <p className="text-xs text-slate-400">PNG/JPG/SVG, under 500 KB.</p>
              {currentLogo && (
                <label className="flex items-center gap-1.5 text-xs text-slate-500">
                  <input type="checkbox" name="removeLogo" value="1" checked={remove} onChange={(e) => setRemove(e.target.checked)} />
                  Remove current logo
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Template */}
        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700">Invoice template</span>
          <div className="grid gap-3 sm:grid-cols-3">
            {TEMPLATES.map((t) => (
              <label key={t.key} className="flex cursor-pointer flex-col gap-1 rounded-lg border border-slate-200 p-3 has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50">
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <input type="radio" name="template" value={t.key} defaultChecked={currentTemplate === t.key} className="accent-indigo-600" />
                  {t.name}
                </span>
                <span className="text-xs text-slate-500">{t.desc}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button disabled={pending} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
            {pending ? 'Saving…' : 'Save branding'}
          </button>
          {state.success && <span className="text-sm text-green-700">{state.success}</span>}
          {state.error && <span className="text-sm text-red-600">{state.error}</span>}
        </div>
      </form>
    </section>
  )
}
