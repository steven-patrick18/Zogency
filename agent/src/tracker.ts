// Activity sampler. Idle time comes from Electron's powerMonitor (built-in,
// cross-platform, no native deps). The foreground app name is best-effort via
// the optional active-win dependency — if it's unavailable the agent still
// reports active/idle time. No keystrokes, screenshots, or content captured.
import { powerMonitor } from 'electron'

export type Sample = { idleSec: number; appName: string | null }

let activeWin: (() => Promise<{ owner?: { name?: string }; title?: string } | undefined>) | null = null
let activeWinTried = false

async function getActiveWindow(): Promise<string | null> {
  if (!activeWinTried) {
    activeWinTried = true
    try {
      // Optional dependency — may be absent or fail on locked-down machines.
      const mod = (await import('active-win')) as { default?: unknown } & unknown
      const fn = (mod as { default?: unknown }).default ?? mod
      if (typeof fn === 'function') activeWin = fn as typeof activeWin
    } catch {
      activeWin = null
    }
  }
  if (!activeWin) return null
  try {
    const win = await activeWin()
    return win?.owner?.name ?? null
  } catch {
    return null
  }
}

export async function sample(): Promise<Sample> {
  const idleSec = powerMonitor.getSystemIdleTime()
  const appName = await getActiveWindow()
  return { idleSec, appName }
}
