'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { audit } from '@/lib/audit'
import { requirePermission, requireSession, withTenant } from '@/lib/authz'
import { prisma, scoped } from '@/lib/db/prisma'
import { summarizeMeeting } from './service'

export type MeetingActionState = { error?: string; success?: string }

const schema = z.object({
  title: z.string().min(1),
  meetingAt: z.string().min(1),
  clientId: z.string().uuid().optional().or(z.literal('')),
  recordingUrl: z.string().url().optional().or(z.literal('')),
  transcript: z.string().optional().or(z.literal('')),
})

export async function createMeetingAction(_p: MeetingActionState, formData: FormData): Promise<MeetingActionState> {
  const session = await requireSession()
  await requirePermission('clients.edit')
  const parsed = schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  const d = parsed.data
  const id = await withTenant(async () => {
    const m = await prisma.meeting.create({
      data: scoped({
        title: d.title,
        meetingAt: new Date(d.meetingAt),
        clientId: d.clientId || null,
        recordingUrl: d.recordingUrl || null,
        transcript: d.transcript || null,
        createdBy: session.user.id,
      }),
    })
    await audit('meeting.create', 'meeting', m.id, null, { title: d.title })
    return m.id
  })
  // Kick off summary if a transcript was provided.
  if (d.transcript) {
    await withTenant(() => summarizeMeeting(id))
  }
  revalidatePath('/meetings')
  return { success: d.transcript ? 'Meeting saved — AI summary generating.' : 'Meeting saved.' }
}

export async function summarizeMeetingAction(formData: FormData) {
  await requirePermission('clients.edit')
  const meetingId = z.string().uuid().parse(formData.get('meetingId'))
  await withTenant(() => summarizeMeeting(meetingId))
  revalidatePath('/meetings')
}
