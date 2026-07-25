'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

function Copy({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        } catch {
          /* clipboard blocked — user can select manually */
        }
      }}
      className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
    >
      {done ? 'Copied ✓' : `Copy ${label}`}
    </button>
  )
}

// "Configure automatically" — launches the installed agent via its custom
// protocol with the server URL + token pre-filled (one click, no pasting).
export function ConfigureButton({ serverUrl, token }: { serverUrl: string; token: string }) {
  const href = `zogency-agent://setup?server=${encodeURIComponent(serverUrl)}&token=${encodeURIComponent(token)}`
  return (
    <a
      href={href}
      className="inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
    >
      Configure the installed agent automatically
    </a>
  )
}

export function CredentialsBlock({ serverUrl, token }: { serverUrl: string; token: string }) {
  return (
    <div className="space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-slate-500">Server URL</span>
        <span className="flex items-center gap-2">
          <code className="font-mono text-slate-800">{serverUrl}</code>
          <Copy label="URL" value={serverUrl} />
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-slate-500">Agent token</span>
        <span className="flex items-center gap-2">
          <code className="max-w-[240px] truncate font-mono text-slate-800" title={token}>{token}</code>
          <Copy label="token" value={token} />
        </span>
      </div>
    </div>
  )
}

// Polls the page for live connection status so "not connected" flips to
// "monitoring active" a few seconds after the agent starts — no manual reload.
export function LiveStatusRefresher({ connected }: { connected: boolean }) {
  const router = useRouter()
  useEffect(() => {
    if (connected) return
    const t = setInterval(() => router.refresh(), 10_000)
    return () => clearInterval(t)
  }, [connected, router])
  return null
}
