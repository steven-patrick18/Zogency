# Zogency Desktop Agent

A lightweight system-tray app (Electron) that reports each employee's **active vs
idle time** and the **name of the app in focus** to their agency's Zogency server,
powering the **Productivity** page. It does **not** capture keystrokes, screenshots,
passwords, or content — only activity signals.

> ⚠️ Screen-time monitoring requires the employee's **signed consent** (DPDP Act).
> The agent shows a consent screen on first run and can be paused any time from the tray.

## How it connects

1. In Zogency: an admin opens the employee's **HR → profile → Desktop monitoring agent**
   and clicks **Issue agent token** (a `zga_…` token).
2. The employee installs this app, enters the **server URL** (e.g. `https://crm.agency.com`)
   and the **agent token**, and accepts the consent.
3. The agent posts a ping once a minute to `POST /api/agent/ping` with
   `Authorization: Bearer <token>` and `{ appName, idleSec }`.
4. Managers see live active/idle time and top apps on **/productivity**.

## Develop

```bash
cd agent
npm install
npm start        # builds TS and launches Electron
```

Config is stored per-user at `%APPDATA%/Zogency Agent/zogency-agent.json`
(macOS `~/Library/Application Support`, Linux `~/.config`).

## Build installers

```bash
npm run dist        # Windows NSIS installer  → agent/release/
npm run dist:mac    # macOS .dmg  (build on a Mac)
npm run dist:linux  # Linux AppImage
```

The Windows installer is what you hand employees. It auto-launches at login
(opt-out in the setup screen) and lives in the tray.

## Notes

- **Idle detection** uses Electron's built-in `powerMonitor` — no native
  dependencies, works everywhere.
- **Active-window name** uses the optional `active-win` dependency; if it's
  unavailable (locked-down machine, missing permission), the agent still reports
  active/idle time and simply omits the app name.
- macOS requires granting the app **Screen Recording** permission for the active
  window title (System Settings → Privacy & Security). Idle time works without it.
