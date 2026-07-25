'use client'

import { Fragment, useState, type ReactNode } from 'react'
import { useActionState } from 'react'
import { saveLeavePolicyDocAction } from '@/modules/hr/actions'
import type { HrActionState } from '@/modules/hr/actions'

// ── Tiny, safe markdown renderer (no dangerouslySetInnerHTML) ───────────────
// Supports: # / ## / ### headings, "- " bullets, blank-line spacing, paragraphs,
// and **bold** inline. Enough for a policy document; anything unknown renders as
// plain text.
function inline(text: string, keyBase: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={`${keyBase}-${i}`}>{part.slice(2, -2)}</strong>
    ) : (
      <Fragment key={`${keyBase}-${i}`}>{part}</Fragment>
    ),
  )
}

export function PolicyMarkdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const out: ReactNode[] = []
  let bullets: string[] = []
  const flush = (key: string) => {
    if (bullets.length) {
      out.push(
        <ul key={key} className="mb-3 list-disc space-y-0.5 pl-5 text-slate-600">
          {bullets.map((b, i) => <li key={i}>{inline(b, `${key}-${i}`)}</li>)}
        </ul>,
      )
      bullets = []
    }
  }
  lines.forEach((raw, i) => {
    const line = raw.trimEnd()
    if (line.startsWith('- ')) { bullets.push(line.slice(2)); return }
    flush(`ul-${i}`)
    if (line.startsWith('### ')) out.push(<h4 key={i} className="mt-3 font-medium text-slate-800">{inline(line.slice(4), `h4-${i}`)}</h4>)
    else if (line.startsWith('## ')) out.push(<h3 key={i} className="mt-5 font-semibold text-slate-900">{inline(line.slice(3), `h3-${i}`)}</h3>)
    else if (line.startsWith('# ')) out.push(<h2 key={i} className="text-lg font-bold text-slate-900">{inline(line.slice(2), `h2-${i}`)}</h2>)
    else if (line.trim() === '') out.push(<div key={i} className="h-1" />)
    else out.push(<p key={i} className="text-slate-600">{inline(line, `p-${i}`)}</p>)
  })
  flush('ul-end')
  return <div className="space-y-1 text-sm leading-relaxed">{out}</div>
}

// ── Editor (HR managers) ─────────────────────────────────────────────────────
export function PolicyDocEditor({ initial, generated }: { initial: string; generated: string }) {
  const [state, formAction, pending] = useActionState<HrActionState, FormData>(saveLeavePolicyDocAction, {})
  const [text, setText] = useState(initial)
  const [preview, setPreview] = useState(false)

  return (
    <form action={formAction} className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setPreview((p) => !p)} className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100">
          {preview ? 'Edit' : 'Preview'}
        </button>
        <button type="button" onClick={() => { setText(generated); setPreview(false) }} className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100">
          Load the auto-generated policy
        </button>
        <span className="text-xs text-slate-400">Markdown: <code># Title</code>, <code>## Section</code>, <code>- bullet</code>, <code>**bold**</code></span>
      </div>

      {preview ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          {text.trim() ? <PolicyMarkdown text={text} /> : <p className="text-sm text-slate-400">Nothing to preview.</p>}
        </div>
      ) : (
        <textarea
          name="doc"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={18}
          placeholder="Write your agency's leave policy here, or click “Load the auto-generated policy” to start from the enforced rules."
          className="w-full rounded-lg border border-slate-300 bg-white p-3 font-mono text-xs leading-relaxed focus:border-indigo-500 focus:outline-none"
        />
      )}

      <div className="flex items-center gap-3">
        <button disabled={pending} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
          {pending ? 'Saving…' : 'Save policy'}
        </button>
        {/* Clearing saves an empty doc → reverts to the auto-generated one. */}
        <button
          type="button"
          onClick={() => { setText(''); const fd = new FormData(); fd.set('doc', ''); formAction(fd) }}
          className="text-xs font-medium text-red-500 hover:underline"
        >
          Reset to auto-generated
        </button>
        {state.success && <span className="text-xs text-green-700">{state.success}</span>}
        {state.error && <span className="text-xs text-red-600">{state.error}</span>}
      </div>
    </form>
  )
}
