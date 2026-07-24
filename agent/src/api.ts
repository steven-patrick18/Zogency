// Posts activity pings to the Zogency server. Uses Node's global fetch
// (Electron 33 / Node 20+). Failures are swallowed — the next ping retries.
import type { AgentConfig } from './config'
import type { Sample } from './tracker'

export type PingResult = { ok: boolean; status?: number; error?: string }

export async function sendPing(config: AgentConfig, s: Sample): Promise<PingResult> {
  const url = `${config.serverUrl.replace(/\/+$/, '')}/api/agent/ping`
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15_000)
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify({ appName: s.appName ?? undefined, idleSec: s.idleSec }),
      signal: controller.signal,
    })
    clearTimeout(timer)
    return { ok: res.ok, status: res.status }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
