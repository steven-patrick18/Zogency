// CI gate (doc 02 §3.2): every model in schema.prisma must be classified in the
// tenancy registry. Fails the build when a new table skips the tenancy decision.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GLOBAL_MODELS, JOIN_MODELS, TENANT_SCOPED_MODELS } from './registry'

describe('tenancy registry', () => {
  const schema = readFileSync(join(process.cwd(), 'prisma', 'schema.prisma'), 'utf-8')
  const models = [...schema.matchAll(/^model\s+(\w+)\s+\{/gm)].map((m) => m[1])

  it('finds models in the schema', () => {
    expect(models.length).toBeGreaterThan(0)
  })

  it.each(models)('model %s is classified as scoped, global, or join', (model) => {
    const memberships = [
      TENANT_SCOPED_MODELS.has(model),
      GLOBAL_MODELS.has(model),
      JOIN_MODELS.has(model),
    ].filter(Boolean).length
    expect(memberships, `${model} must be in exactly one registry set`).toBe(1)
  })

  it.each([...TENANT_SCOPED_MODELS])('scoped model %s has a tenantId field', (model) => {
    const body = schema.match(new RegExp(`^model\\s+${model}\\s+\\{([\\s\\S]*?)^\\}`, 'm'))?.[1] ?? ''
    expect(body, `${model} declared tenant-scoped but has no tenantId field`).toMatch(/tenantId\s+String/)
  })
})
