// Job queue abstraction (doc 02 §6.1). With REDIS_URL set, jobs go to BullMQ
// and run in the worker process; without it (dev on this machine has no Redis),
// the processor runs inline on a microtask so webhook handlers still return
// fast and the call-site contract is identical.
import { runWithTenant } from '@/lib/db/context'

export type JobPayload = { tenantId: string; [key: string]: unknown }
type Processor = (payload: JobPayload) => Promise<void>

const processors = new Map<string, Processor>()

export function registerProcessor(queue: string, processor: Processor) {
  processors.set(queue, processor)
}

export async function enqueue(queue: string, payload: JobPayload): Promise<void> {
  if (process.env.REDIS_URL) {
    // BullMQ path — added when Redis is provisioned (docker compose / DO).
    // const q = getBullQueue(queue); await q.add(queue, payload)
    throw new Error('BullMQ transport not wired yet — unset REDIS_URL')
  }
  const processor = processors.get(queue)
  if (!processor) throw new Error(`No processor registered for queue "${queue}"`)
  // Inline dev transport: fire on a microtask; errors are logged, and the
  // webhook_events row keeps failed payloads replayable (doc 02 §6.1).
  queueMicrotask(() => {
    runWithTenant({ tenantId: payload.tenantId }, () => processor(payload))?.catch?.((err: unknown) =>
      console.error(`[queue:${queue}] processor failed`, err),
    )
  })
}
