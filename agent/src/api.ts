// Posts activity pings to the Zogency server. Uses Node's global fetch
// (Electron 33 / Node 20+). Failures are swallowed — the next ping retries.
import type { AgentConfig } from './config'
import type { Sample } from './tracker'

export type PingResult = { ok: boolean; status?: number; error?: string }

/** Fetch HR-set runtime config (currently the idle auto-logout threshold). */
export async function fetchAgentConfig(config: AgentConfig): Promise<{ idleLogoutMin: number } | null> {
  const url = `${config.serverUrl.replace(/\/+$/, '')}/api/agent/config`
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15_000)
    const res = await fetch(url, {
      headers: { authorization: `Bearer ${config.token}` },
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) return null
    const body = (await res.json()) as { idleLogoutMin?: number }
    const min = Number(body.idleLogoutMin)
    return { idleLogoutMin: Number.isFinite(min) && min > 0 ? min : 10 }
  } catch {
    return null
  }
}

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
      body: JSON.stringify({
        appName: s.appName ?? undefined,
        windowTitle: s.windowTitle ?? undefined,
        windowUrl: s.windowUrl ?? undefined,
        idleSec: s.idleSec,
      }),
      signal: controller.signal,
    })
    clearTimeout(timer)
    return { ok: res.ok, status: res.status }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** Upload a periodic screen capture (deep monitoring, consented). Best-effort. */
export async function sendScreenshot(
  config: AgentConfig,
  image: string,
  appName: string | null,
): Promise<PingResult> {
  const url = `${config.serverUrl.replace(/\/+$/, '')}/api/agent/screenshot`
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20_000)
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify({ image, appName: appName ?? undefined }),
      signal: controller.signal,
    })
    clearTimeout(timer)
    return { ok: res.ok, status: res.status }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
