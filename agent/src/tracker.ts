// Activity sampler. Idle time comes from Electron's powerMonitor (built-in,
// cross-platform, no native deps). The foreground app name + window title are
// best-effort via the optional active-win dependency — if it's unavailable the
// agent still reports active/idle time. Deep monitoring (window titles +
// periodic screenshots) is disclosed on the consent screen; no keystrokes or
// clipboard are ever captured.
import { desktopCapturer, powerMonitor, screen } from 'electron'

export type Sample = { idleSec: number; appName: string | null; windowTitle: string | null }

let activeWin: (() => Promise<{ owner?: { name?: string }; title?: string } | undefined>) | null = null
let activeWinTried = false

async function getActiveWindow(): Promise<{ app: string | null; title: string | null }> {
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
  if (!activeWin) return { app: null, title: null }
  try {
    const win = await activeWin()
    return { app: win?.owner?.name ?? null, title: win?.title ?? null }
  } catch {
    return { app: null, title: null }
  }
}

export async function sample(): Promise<Sample> {
  const idleSec = powerMonitor.getSystemIdleTime()
  const { app, title } = await getActiveWindow()
  return { idleSec, appName: app, windowTitle: title }
}

/**
 * Capture the primary screen as a downscaled JPEG data-URI (~≤300KB). Returns
 * null on failure (permission denied, headless, etc.) — capture is best-effort
 * and must never crash the tray app.
 */
export async function captureScreen(): Promise<string | null> {
  try {
    const { width, height } = screen.getPrimaryDisplay().size
    const scale = Math.min(1, 1024 / Math.max(width, height))
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: Math.round(width * scale), height: Math.round(height * scale) },
    })
    const thumb = sources[0]?.thumbnail
    if (!thumb || thumb.isEmpty()) return null
    return `data:image/jpeg;base64,${thumb.toJPEG(55).toString('base64')}`
  } catch {
    return null
  }
}
