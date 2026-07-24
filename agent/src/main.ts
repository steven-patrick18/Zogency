// Zogency desktop agent — main process.
// Flow: first run → consent + setup window → save config → tray + poll loop.
// Samples once a minute and posts to the server. Employees can pause or quit
// from the tray. No content is captured — only active/idle time and app name.
import { app, BrowserWindow, ipcMain, Menu, nativeImage, Tray } from 'electron'
import { join } from 'node:path'
import { isConfigured, loadConfig, saveConfig, type AgentConfig } from './config'
import { sample } from './tracker'
import { sendPing, type PingResult } from './api'

const PING_INTERVAL_MS = 60_000

let tray: Tray | null = null
let setupWindow: BrowserWindow | null = null
let config: AgentConfig = loadConfig()
let timer: NodeJS.Timeout | null = null
let lastStatus = 'starting…'

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
  const result: PingResult = await sendPing(config, s)
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

// Renderer → main: current config (token never pre-filled back for safety).
ipcMain.handle('get-config', () => ({
  serverUrl: config.serverUrl,
  consented: config.consented,
  autoLaunch: config.autoLaunch,
  configured: isConfigured(config),
}))

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

// Single-instance: focus setup if launched twice.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => openSetupWindow())

  app.whenReady().then(() => {
    if (process.platform === 'darwin') app.dock?.hide() // tray-only on macOS
    tray = new Tray(TRAY_ICON)
    rebuildTray()
    applyAutoLaunch()

    if (!isConfigured(config)) {
      openSetupWindow()
    } else {
      scheduleTicker()
    }
  })

  // Tray app: don't quit when the setup window closes.
  app.on('window-all-closed', () => {})
}
