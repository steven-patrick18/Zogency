// Server status + monitoring-storage stats for the Settings → Server page.
// Host metrics come from Node's os/fs; capture storage is per-tenant (each
// agency sees only its own screenshots).
import os from 'node:os'
import { readFile, statfs } from 'node:fs/promises'
import { requireTenantContext } from '@/lib/db/context'
import { prisma, prismaUnscoped } from '@/lib/db/prisma'

export type ServerStatus = {
  hostname: string
  platform: string
  nodeVersion: string
  uptimeSec: number
  cpuCount: number
  loadAvg1: number // 0 on Windows (not reported by the OS)
  memTotal: number
  memFree: number
  memUsed: number
  disk: { total: number; free: number; used: number } | null
}

/** Host process/OS metrics (not tenant-scoped — it's the shared server). */
export async function getServerStatus(): Promise<ServerStatus> {
  const memTotal = os.totalmem()
  const memFree = os.freemem()
  let disk: ServerStatus['disk'] = null
  try {
    const s = await statfs(process.cwd())
    const total = s.blocks * s.bsize
    const free = s.bavail * s.bsize
    disk = { total, free, used: total - free }
  } catch {
    disk = null // statfs unsupported on some platforms
  }
  return {
    hostname: os.hostname(),
    platform: `${os.type()} ${os.release()} (${os.arch()})`,
    nodeVersion: process.version,
    uptimeSec: Math.floor(process.uptime()),
    cpuCount: os.cpus().length,
    loadAvg1: os.loadavg()[0] ?? 0,
    memTotal,
    memFree,
    memUsed: memTotal - memFree,
    disk,
  }
}

export type MaintenanceStatus = {
  scheduled: boolean // the weekly cleanup is wired (status file dir is mounted)
  ranAt: string | null
  freedBytes: number
  usedBytesAfter: number
}

/**
 * Host cleanup status, written weekly by deploy/cleanup.sh into a read-only
 * mount. The app itself has NO Docker access — it only reads this status file.
 */
export async function getMaintenanceStatus(): Promise<MaintenanceStatus> {
  try {
    const raw = await readFile('/maintenance/last-cleanup.json', 'utf-8')
    const j = JSON.parse(raw) as { ranAt?: string; freedBytes?: number; usedBytesAfter?: number }
    return {
      scheduled: true,
      ranAt: j.ranAt ?? null,
      freedBytes: Number(j.freedBytes) || 0,
      usedBytesAfter: Number(j.usedBytesAfter) || 0,
    }
  } catch {
    // No status file yet (never run) or the mount isn't present (e.g. dev).
    return { scheduled: false, ranAt: null, freedBytes: 0, usedBytesAfter: 0 }
  }
}

export type CaptureStorage = {
  count: number
  bytes: number // approx: sum of stored data-URI lengths
  oldest: Date | null
  retentionHours: number
  perUser: Array<{ userId: string; name: string; count: number; bytes: number }>
}

/** Screen-capture footprint for the current tenant. */
export async function getCaptureStorage(): Promise<CaptureStorage> {
  const { tenantId } = requireTenantContext()
  const settings = await prisma.tenantSettings.findFirst({ select: { captureRetentionHours: true } })

  // Raw aggregate (byte length of the stored image) — scoped explicitly by
  // tenant since $queryRaw bypasses the tenant guard.
  const totals = await prismaUnscoped.$queryRaw<Array<{ count: bigint; bytes: bigint | null; oldest: Date | null }>>`
    SELECT COUNT(*)::bigint AS count,
           COALESCE(SUM(LENGTH("image")), 0)::bigint AS bytes,
           MIN("at") AS oldest
    FROM "screen_captures"
    WHERE "tenant_id" = ${tenantId}::uuid`
  const perUserRaw = await prismaUnscoped.$queryRaw<Array<{ user_id: string; count: bigint; bytes: bigint | null }>>`
    SELECT "user_id", COUNT(*)::bigint AS count, COALESCE(SUM(LENGTH("image")), 0)::bigint AS bytes
    FROM "screen_captures"
    WHERE "tenant_id" = ${tenantId}::uuid
    GROUP BY "user_id"
    ORDER BY bytes DESC
    LIMIT 10`

  const userIds = perUserRaw.map((r) => r.user_id)
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
    : []
  const nameById = new Map(users.map((u) => [u.id, u.name]))

  const row = totals[0]
  return {
    count: Number(row?.count ?? 0),
    bytes: Number(row?.bytes ?? 0),
    oldest: row?.oldest ?? null,
    retentionHours: settings?.captureRetentionHours ?? 336,
    perUser: perUserRaw.map((r) => ({
      userId: r.user_id,
      name: nameById.get(r.user_id) ?? '—',
      count: Number(r.count),
      bytes: Number(r.bytes ?? 0),
    })),
  }
}
