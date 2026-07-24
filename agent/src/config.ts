// Agent configuration persisted in the OS user-data dir.
import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export type AgentConfig = {
  serverUrl: string // e.g. https://crm.agency.com
  token: string // agent token issued on the HR employee profile
  consented: boolean // employee accepted monitoring (DPDP)
  paused: boolean
  autoLaunch: boolean
}

const CONFIG_PATH = join(app.getPath('userData'), 'zogency-agent.json')

const DEFAULTS: AgentConfig = {
  serverUrl: '',
  token: '',
  consented: false,
  paused: false,
  autoLaunch: true,
}

export function loadConfig(): AgentConfig {
  try {
    if (existsSync(CONFIG_PATH)) {
      return { ...DEFAULTS, ...JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) }
    }
  } catch {
    // corrupt config → start fresh
  }
  return { ...DEFAULTS }
}

export function saveConfig(config: AgentConfig): void {
  mkdirSync(dirname(CONFIG_PATH), { recursive: true })
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
}

export function isConfigured(config: AgentConfig): boolean {
  return config.consented && !!config.serverUrl && !!config.token
}
