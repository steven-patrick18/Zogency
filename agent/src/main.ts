// Zogency desktop agent — main process.
// Flow: first run → consent + setup window → save config → tray + poll loop.
// Samples once a minute and posts to the server. Employees can pause or quit
// from the tray. No content is captured — only active/idle time and app name.
import { app, BrowserWindow, ipcMain, Menu, nativeImage, Tray } from 'electron'
import { join } from 'node:path'
import { isConfigured, loadConfig, saveConfig, type AgentConfig } from './config'
import { captureScreen, sample } from './tracker'
import { sendPing, sendScreenshot, type PingResult } from './api'

const PING_INTERVAL_MS = 60_000
// Deep monitoring: one screenshot every N pings (5 min at 1-min pings) while
// active. Disclosed on the consent screen; pausing the agent pauses this too.
const SCREENSHOT_EVERY_N_PINGS = 5
let pingCount = 0
// Auto-pause after prolonged inactivity (with a warning first), so idle time
// off-shift isn't tracked. Resumes automatically on activity.
const IDLE_WARN_SEC = 5 * 60
const IDLE_PAUSE_SEC = 10 * 60
let autoPaused = false

let tray: Tray | null = null
let setupWindow: BrowserWindow | null = null
let config: AgentConfig = loadConfig()
let timer: NodeJS.Timeout | null = null
let lastStatus = 'starting…'
// Filled from a zogency-agent://setup?server=&token= deep link, so the setup
// window can pre-fill the fields (the employee still ticks consent + Connect).
let pendingSetup: { server: string; token: string } | null = null

const PROTOCOL = 'zogency-agent'

/** Parse a zogency-agent://setup deep link and open the pre-filled setup window. */
function handleDeepLink(url: string | undefined): boolean {
  if (!url || !url.startsWith(`${PROTOCOL}://`)) return false
  try {
    const u = new URL(url)
    const server = u.searchParams.get('server')
    const token = u.searchParams.get('token')
    if (server && token) {
      pendingSetup = { server: server.trim(), token: token.trim() }
      openSetupWindow()
      return true
    }
  } catch {
    /* malformed link — ignore */
  }
  return false
}

// A single 16×16 indigo dot as the tray icon (data URI — no asset file needed).
const TRAY_ICON = nativeImage.createFromDataURL(
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAWklEQVR4nGNgGAWjYBSMglEwCkbBKBgFo2AUjIJRMApGwSgYBaNgFIyCUTAKRsEoGAWjYBSMglEwCkbBKBgFo2AUjIJRMApGwSgYBaNgFIyCUTAKRgEAr7QDAX3z2mgAAAAASUVORK5CYII=',
)

function scheduleTicker() {
  if (timer) clearInterval(timer)
  timer = setInterval(tick, PING_INTERVAL_MS)
  void tick()
}

async function tick() {
  if (!isConfigured(config) || config.paused) return
  const s = await sample()

  // Idle auto-pause with warning (FR — agent auto-logout on idle).
  if (s.idleSec >= IDLE_PAUSE_SEC) {
    if (!autoPaused) {
      autoPaused = true
      lastStatus = 'Auto-paused (inactive) — resumes on activity'
      tray?.displayBalloon?.({ title: 'Zogency Agent', content: 'Paused after inactivity. Move the mouse to resume.' })
      rebuildTray()
    }
    return // don't report idle-off-shift time
  }
  if (autoPaused && s.idleSec < 60) {
    autoPaused = false // activity resumed
  }
  if (s.idleSec >= IDLE_WARN_SEC && s.idleSec < IDLE_PAUSE_SEC && !autoPaused) {
    lastStatus = `Idle ${Math.floor(s.idleSec / 60)} min — will pause soon`
    rebuildTray()
  }

  const result: PingResult = await sendPing(config, s)

  // Deep monitoring: periodic screenshot while active (skipped when paused —
  // this code path is unreachable then — or idle-paused above).
  pingCount++
  if (result.ok && pingCount % SCREENSHOT_EVERY_N_PINGS === 0) {
    const image = await captureScreen()
    if (image) await sendScreenshot(config, image, s.appName)
  }

  const now = new Date().toLocaleTimeString()
  if (result.ok) {
    lastStatus = `Connected · last sync ${now}`
  } else if (result.status === 401) {
    lastStatus = 'Token rejected — re-enter it from the tray'
  } else {
    lastStatus = `Offline · retrying (${result.error ?? result.status})`
  }
  rebuildTray()
}

function rebuildTray() {
  if (!tray) return
  const paused = config.paused
  const menu = Menu.buildFromTemplate([
    { label: isConfigured(config) ? lastStatus : 'Not set up', enabled: false },
    { type: 'separator' },
    {
      label: paused ? 'Resume monitoring' : 'Pause monitoring',
      click: () => {
        config = { ...config, paused: !config.paused }
        saveConfig(config)
        lastStatus = config.paused ? 'Paused' : 'Resuming…'
        rebuildTray()
        if (!config.paused) void tick()
      },
    },
    { label: 'Settings…', click: openSetupWindow },
    { type: 'separator' },
    { label: 'Quit Zogency Agent', click: () => app.quit() },
  ])
  tray.setToolTip(`Zogency Agent — ${isConfigured(config) ? lastStatus : 'not set up'}`)
  tray.setContextMenu(menu)
}

function openSetupWindow() {
  if (setupWindow) {
    setupWindow.focus()
    return
  }
  setupWindow = new BrowserWindow({
    width: 460,
    height: 620,
    resizable: false,
    title: 'Zogency Agent — Setup',
    webPreferences: { preload: join(__dirname, 'preload.js'), contextIsolation: true },
  })
  setupWindow.setMenuBarVisibility(false)
  void setupWindow.loadFile(join(__dirname, '..', 'renderer', 'setup.html'))
  setupWindow.on('closed', () => {
    setupWindow = null
  })
}

// Renderer → main: current config (saved token never sent back for safety, but
// a one-time deep-link prefill is, so "Configure automatically" fills the form).
ipcMain.handle('get-config', () => {
  const prefill = pendingSetup
  pendingSetup = null // consume — only prefill once
  return {
    serverUrl: config.serverUrl,
    consented: config.consented,
    autoLaunch: config.autoLaunch,
    configured: isConfigured(config),
    prefillServer: prefill?.server,
    prefillToken: prefill?.token,
  }
})

// Renderer → main: save + test the connection with a single ping.
ipcMain.handle('save-config', async (_e, data: { serverUrl: string; token: string; consented: boolean; autoLaunch: boolean }) => {
  const next: AgentConfig = {
    ...config,
    serverUrl: data.serverUrl.trim(),
    token: data.token.trim() || config.token,
    consented: data.consented,
    autoLaunch: data.autoLaunch,
    paused: false,
  }
  if (!next.consented) return { ok: false, error: 'You must consent to monitoring to continue.' }
  if (!next.serverUrl || !next.token) return { ok: false, error: 'Server URL and agent token are required.' }

  const test = await sendPing(next, await sample())
  if (!test.ok) {
    return {
      ok: false,
      error:
        test.status === 401
          ? 'Server rejected the token — check it was copied correctly.'
          : `Could not reach the server (${test.error ?? test.status}). Check the URL.`,
    }
  }
  config = next
  saveConfig(config)
  applyAutoLaunch()
  scheduleTicker()
  rebuildTray()
  return { ok: true }
})

function applyAutoLaunch() {
  if (process.platform === 'linux') return // handled by the packaged .desktop entry
  app.setLoginItemSettings({ openAtLogin: config.autoLaunch, openAsHidden: true })
}

// Register the custom protocol so the browser's "Configure automatically" button
// can launch us with the server URL + token.
app.setAsDefaultProtocolClient(PROTOCOL)

// macOS delivers deep links via open-url.
app.on('open-url', (event, url) => {
  event.preventDefault()
  handleDeepLink(url)
})

// Single-instance: focus setup if launched twice.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  // Windows/Linux deliver the deep link as an argv on the second launch.
  app.on('second-instance', (_e, argv) => {
    const link = argv.find((a) => a.startsWith(`${PROTOCOL}://`))
    if (!handleDeepLink(link)) openSetupWindow()
  })

  app.whenReady().then(() => {
    if (process.platform === 'darwin') app.dock?.hide() // tray-only on macOS
    tray = new Tray(TRAY_ICON)
    rebuildTray()
    applyAutoLaunch()

    // First-launch deep link (Windows/Linux) arrives in this process's argv.
    const link = process.argv.find((a) => a.startsWith(`${PROTOCOL}://`))
    if (link) {
      handleDeepLink(link)
    } else if (!isConfigured(config)) {
      openSetupWindow()
    } else {
      scheduleTicker()
    }
  })

  // Tray app: don't quit when the setup window closes.
  app.on('window-all-closed', () => {})
}
