// Desktop-agent status + setup helpers. "Connected" = this user's agent posted
// a ping recently, which is the only reliable browser-visible signal that the
// Electron app is installed and running.
import { prisma } from '@/lib/db/prisma'

const CONNECTED_WINDOW_MS = 5 * 60_000 // a ping within 5 min ⇒ running

export type AgentStatus = {
  hasToken: boolean
  connected: boolean
  lastSeen: Date | null
  token: string | null
}

export async function getAgentStatus(userId: string): Promise<AgentStatus> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { agentToken: true } })
  if (!user?.agentToken) return { hasToken: false, connected: false, lastSeen: null, token: null }
  const lastPing = await prisma.activityPing.findFirst({
    where: { userId },
    orderBy: { at: 'desc' },
    select: { at: true },
  })
  const lastSeen = lastPing?.at ?? null
  const connected = !!lastSeen && Date.now() - lastSeen.getTime() < CONNECTED_WINDOW_MS
  return { hasToken: true, connected, lastSeen, token: user.agentToken }
}

/** Where the desktop-agent installer lives (per-tenant configurable via env). */
export function agentDownloadUrl(): string | null {
  return process.env.ZOGENCY_AGENT_DOWNLOAD_URL || null
}
