// Strict leave-policy enforcement (BRB leave policy 2026). Pure functions — no
// DB — so they are unit-testable. requestLeave() assembles the context and calls
// assessLeave() before persisting.
//
// Rules enforced:
//  • per-type max consecutive leave days
//  • weekly-off (WOFF) adjacency: allowed | limited1 (max 1 day touching a WOFF)
//    | forbidden (may not touch a WOFF at all)
//  • standalone-only types (RH): a single day, never combined with other leave
//  • no clubbing of a non-clubbable type with a different leave type in the same
//    continuous-absence block
//  • absolute continuous-absence cap (CL+EL+RH+PH+WOFF), needs senior approval
//  • advance-notice for planned (non-emergency) leave

export type WoffAdjacency = 'allowed' | 'limited1' | 'forbidden'

export type LeaveRuleType = {
  id: string
  name: string
  maxConsecutive: number // 0 = unlimited
  woffAdjacency: WoffAdjacency
  standaloneOnly: boolean
  clubbableWithLeave: boolean
}

export type ExistingLeave = { fromOn: Date; toOn: Date; typeId: string; typeName: string }

export type LeaveContext = {
  weeklyOffDays: number[] // 0=Sun … 6=Sat
  holidays: Set<string> // 'YYYY-MM-DD' UTC keys
  existingLeaves: ExistingLeave[] // employee's approved + pending leaves (excluding this request)
  maxContinuousAbsenceDays: number
  plannedNoticeDays: number
  today: Date
}

export type LeaveAssessment = { ok: true; leaveDays: number } | { ok: false; error: string }

const DAY = 86_400_000
const key = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY)

const isWoff = (d: Date, ctx: LeaveContext) => ctx.weeklyOffDays.includes(d.getUTCDay())
const isHoliday = (d: Date, ctx: LeaveContext) => ctx.holidays.has(key(d))
const leaveOn = (d: Date, ctx: LeaveContext) =>
  ctx.existingLeaves.find((l) => d >= l.fromOn && d <= l.toOn)
/** A day that keeps a continuous-absence block going: WOFF, holiday, or leave. */
const isOffDay = (d: Date, ctx: LeaveContext) =>
  isWoff(d, ctx) || isHoliday(d, ctx) || !!leaveOn(d, ctx)

/** Actual leave days consumed in [from,to] — WOFFs and holidays don't spend balance. */
export function countLeaveDays(from: Date, to: Date, ctx: LeaveContext): number {
  let n = 0
  for (let cur = from; cur <= to; cur = addDays(cur, 1)) {
    if (!isWoff(cur, ctx) && !isHoliday(cur, ctx)) n++
  }
  return n
}

/** Working days strictly after `from`, up to and including `to`. */
function workingDaysUntil(from: Date, to: Date, ctx: LeaveContext): number {
  let n = 0
  for (let cur = addDays(from, 1); cur <= to; cur = addDays(cur, 1)) {
    if (!isWoff(cur, ctx) && !isHoliday(cur, ctx)) n++
  }
  return n
}

export function assessLeave(
  req: { fromOn: Date; toOn: Date; isEmergency?: boolean },
  type: LeaveRuleType,
  ctx: LeaveContext,
): LeaveAssessment {
  if (req.toOn < req.fromOn) return { ok: false, error: 'End date must be on or after the start date.' }
  const leaveDays = countLeaveDays(req.fromOn, req.toOn, ctx)
  if (leaveDays === 0) {
    return { ok: false, error: 'The selected range is entirely weekly-offs / holidays — no leave to apply.' }
  }

  // Overlap with an existing request.
  const overlap = ctx.existingLeaves.find((l) => req.fromOn <= l.toOn && req.toOn >= l.fromOn)
  if (overlap) return { ok: false, error: `Overlaps an existing ${overlap.typeName} leave.` }

  // Per-type consecutive cap.
  if (type.maxConsecutive > 0 && leaveDays > type.maxConsecutive) {
    return { ok: false, error: `${type.name}: at most ${type.maxConsecutive} day(s) may be availed at a time (requested ${leaveDays}).` }
  }

  // Standalone-only (RH): single day, never combined.
  if (type.standaloneOnly && leaveDays > 1) {
    return { ok: false, error: `${type.name} must be taken as a single standalone day.` }
  }

  // Advance notice for planned leave.
  if (!req.isEmergency) {
    const notice = workingDaysUntil(ctx.today, req.fromOn, ctx)
    if (notice < ctx.plannedNoticeDays) {
      return {
        ok: false,
        error: `Planned leave needs ${ctx.plannedNoticeDays} working day(s) advance notice (only ${notice}). If unavoidable, mark it as an emergency.`,
      }
    }
  }

  // WOFF adjacency — the day immediately before/after the leave.
  const touchesWoff = isWoff(addDays(req.fromOn, -1), ctx) || isWoff(addDays(req.toOn, 1), ctx)
  if (touchesWoff) {
    if (type.woffAdjacency === 'forbidden') {
      return { ok: false, error: `${type.name} may not be taken immediately before or after a weekly off.` }
    }
    if (type.woffAdjacency === 'limited1' && leaveDays > 1) {
      return { ok: false, error: `${type.name} adjacent to a weekly off is limited to 1 day.` }
    }
  }

  // Continuous-absence block: expand across contiguous off-days both sides.
  let blockStart = req.fromOn
  for (let i = 0; i < 366 && isOffDay(addDays(blockStart, -1), ctx); i++) blockStart = addDays(blockStart, -1)
  let blockEnd = req.toOn
  for (let i = 0; i < 366 && isOffDay(addDays(blockEnd, 1), ctx); i++) blockEnd = addDays(blockEnd, 1)
  const blockDays = Math.round((blockEnd.getTime() - blockStart.getTime()) / DAY) + 1
  if (blockDays > ctx.maxContinuousAbsenceDays) {
    return {
      ok: false,
      error: `This creates ${blockDays} continuous days away (weekly-offs/holidays included), above the ${ctx.maxContinuousAbsenceDays}-day cap. Requires prior senior-management approval.`,
    }
  }

  // Clubbing: a different leave type inside the same block.
  const otherType = ctx.existingLeaves.find(
    (l) => l.typeId !== type.id && l.fromOn <= blockEnd && l.toOn >= blockStart,
  )
  if (otherType) {
    if (type.standaloneOnly || !type.clubbableWithLeave) {
      return { ok: false, error: `${type.name} cannot be clubbed with ${otherType.typeName}.` }
    }
  }

  return { ok: true, leaveDays }
}
