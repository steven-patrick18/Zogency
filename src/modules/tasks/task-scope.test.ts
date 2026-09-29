import { describe, expect, it } from 'vitest'
import {
  canEditTask,
  canManageAnyTask,
  canReassignTask,
  ownsTask,
  type TaskActor,
  type TaskOwnership,
} from './task-scope'

const ALICE = 'a0000000-0000-0000-0000-000000000001'
const BOB = 'b0000000-0000-0000-0000-000000000002'
const CARA = 'c0000000-0000-0000-0000-000000000003'

const actor = (id: string, ...permissions: string[]): TaskActor => ({ id, permissions })
const task = (createdById: string | null, ...assigneeIds: string[]): TaskOwnership => ({
  createdById,
  assignees: assigneeIds.map((userId) => ({ userId })),
})

describe('canManageAnyTask', () => {
  it('is true only with tasks.manage', () => {
    expect(canManageAnyTask(actor(ALICE, 'tasks.manage'))).toBe(true)
    expect(canManageAnyTask(actor(ALICE, 'tasks.edit', 'tasks.view'))).toBe(false)
  })
})

describe('ownsTask', () => {
  it('counts the creator', () => {
    expect(ownsTask(actor(ALICE, 'tasks.edit'), task(ALICE, BOB))).toBe(true)
  })

  it('counts every assignee, not just the first', () => {
    expect(ownsTask(actor(CARA, 'tasks.edit'), task(ALICE, BOB, CARA))).toBe(true)
  })

  it('is false for an unrelated user', () => {
    expect(ownsTask(actor(CARA, 'tasks.edit'), task(ALICE, BOB))).toBe(false)
  })

  it('handles a task with no creator (pre-migration rows) and no assignees', () => {
    expect(ownsTask(actor(ALICE, 'tasks.edit'), task(null))).toBe(false)
  })

  it('counts the legacy assigneeId — handover tasks set it without a join row', () => {
    const handoverTask = { createdById: null, assignees: [], assigneeId: BOB }
    expect(ownsTask(actor(BOB, 'tasks.edit'), handoverTask)).toBe(true)
    expect(ownsTask(actor(CARA, 'tasks.edit'), handoverTask)).toBe(false)
  })
})

describe('canEditTask', () => {
  it('lets an assignee work on their own task — the common case', () => {
    expect(canEditTask(actor(BOB, 'tasks.edit'), task(ALICE, BOB))).toBe(true)
  })

  it("blocks editing someone else's task — BRB issue #3", () => {
    expect(canEditTask(actor(CARA, 'tasks.edit'), task(ALICE, BOB))).toBe(false)
  })

  it('lets a tasks.manage holder edit anything', () => {
    expect(canEditTask(actor(CARA, 'tasks.edit', 'tasks.manage'), task(ALICE, BOB))).toBe(true)
  })

  it('lets the creator edit a task they assigned to someone else', () => {
    expect(canEditTask(actor(ALICE, 'tasks.edit'), task(ALICE, BOB))).toBe(true)
  })

  it('leaves an orphaned task (no creator, unassigned) to managers only', () => {
    expect(canEditTask(actor(ALICE, 'tasks.edit'), task(null))).toBe(false)
    expect(canEditTask(actor(ALICE, 'tasks.edit', 'tasks.manage'), task(null))).toBe(true)
  })
})

describe('canReassignTask', () => {
  it('is stricter than editing: an assignee may not hand their task on', () => {
    const bob = actor(BOB, 'tasks.edit')
    const t = task(ALICE, BOB)
    expect(canEditTask(bob, t)).toBe(true)
    expect(canReassignTask(bob, t)).toBe(false)
  })

  it('allows the creator', () => {
    expect(canReassignTask(actor(ALICE, 'tasks.edit'), task(ALICE, BOB))).toBe(true)
  })

  it('allows a tasks.manage holder', () => {
    expect(canReassignTask(actor(CARA, 'tasks.manage'), task(ALICE, BOB))).toBe(true)
  })
})
