// Self-service desktop-agent setup — the answer to "where do I enter the token".
// Each employee opens this, downloads the agent, and clicks "Configure
// automatically" (deep link with their own server URL + token pre-filled).
import { headers } from 'next/headers'
import { requireSession, withTenant } from '@/lib/authz'
import { agentDownloadUrl, getAgentStatus } from '@/modules/monitoring/agent-status'
import { CredentialsBlock, ConfigureButton, LiveStatusRefresher } from './agent-panels'

export default async function AgentSetupPage() {
  const session = await requireSession()
  const status = await withTenant(() => getAgentStatus(session.user.id))

  // Origin the agent should post to (this deployment).
  const h = await headers()
  const proto = h.get('x-forwarded-proto') ?? 'https'
  const host = h.get('host') ?? ''
  const serverUrl = `${proto}://${host}`
  const download = agentDownloadUrl()

  return (
    <div className="max-w-2xl">
      <LiveStatusRefresher connected={status.connected} />
      <h1 className="text-2xl font-bold text-slate-900">Desktop monitoring agent</h1>
      <p className="mt-1 text-sm text-slate-500">
        The agent reports your active/idle time, focused app + window title and periodic screenshots to
        your workspace (with your consent). Set it up once — it then starts automatically at login.
      </p>

      {/* Live status */}
      <div
        className={`mt-5 flex items-center gap-3 rounded-xl border p-4 ${
          status.connected
            ? 'border-green-200 bg-green-50'
            : status.hasToken
              ? 'border-amber-200 bg-amber-50'
              : 'border-slate-200 bg-white'
        }`}
      >
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            status.connected ? 'bg-green-500' : status.hasToken ? 'bg-amber-500' : 'bg-slate-300'
          }`}
        />
        <div className="text-sm">
          {status.connected ? (
            <p className="font-semibold text-green-800">Monitoring is active — the agent is running on this account.</p>
          ) : status.hasToken ? (
            <p className="font-semibold text-amber-800">Not connected yet — install &amp; configure the agent below.</p>
          ) : (
            <p className="font-semibold text-slate-700">Monitoring isn’t enabled for you yet — ask HR to issue your agent token.</p>
          )}
          {status.lastSeen && (
            <p className="text-xs text-slate-500">Last seen {status.lastSeen.toLocaleString('en-IN')}</p>
          )}
        </div>
      </div>

      {status.hasToken && status.token && (
        <div className="mt-6 space-y-6">
          {/* Step 1 — download */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">1 · Install the agent</h2>
            <p className="mt-1 text-xs text-slate-500">
              Download the zip, extract it anywhere, and run <code className="font-mono">Zogency Agent.exe</code>.
              Accept the consent screen — it then starts automatically at login.
            </p>
            {download ? (
              <a
                href={download}
                className="mt-3 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
              >
                Download the Zogency Agent (Windows)
              </a>
            ) : (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                The installer download isn’t published yet — ask your admin for the Zogency Agent installer
                (built with <code className="font-mono">npm run dist</code> in the agent project).
              </p>
            )}
          </div>

          {/* Step 2 — configure */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">2 · Connect it to your account</h2>
            <p className="mt-1 text-xs text-slate-500">
              Once installed, one click configures it automatically. If that doesn’t work, paste these into
              the agent’s Settings window.
            </p>
            <div className="mt-3">
              <ConfigureButton serverUrl={serverUrl} token={status.token} />
            </div>
            <div className="mt-3">
              <CredentialsBlock serverUrl={serverUrl} token={status.token} />
            </div>
          </div>

          <p className="text-xs text-slate-400">
            Keep this token private — it authenticates your machine. If it leaks, ask HR to re-issue it.
            You can pause or quit the agent any time from its tray icon.
          </p>
        </div>
      )}
    </div>
  )
}
