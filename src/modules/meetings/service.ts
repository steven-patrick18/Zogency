// Meetings module (Phase 3): recording/transcript upload + AI summary via the
// Claude API. Summary runs when ANTHROPIC_API_KEY is configured; otherwise the
// meeting is stored and the summary can be generated later.
import { audit } from '@/lib/audit'
import { prisma } from '@/lib/db/prisma'

const MODEL = 'claude-sonnet-5'

export async function summarizeMeeting(meetingId: string): Promise<{ ok: boolean; error?: string }> {
  const meeting = await prisma.meeting.findUniqueOrThrow({ where: { id: meetingId } })
  if (!meeting.transcript) return { ok: false, error: 'No transcript to summarize' }
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    await prisma.meeting.update({ where: { id: meetingId }, data: { summaryStatus: 'failed' } })
    return { ok: false, error: 'ANTHROPIC_API_KEY not configured on this server' }
  }

  await prisma.meeting.update({ where: { id: meetingId }, data: { summaryStatus: 'pending' } })
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `Summarize this client meeting for the account team. Give: a 2-line summary, key decisions, action items (with owners if mentioned), and any risks. Transcript:\n\n${meeting.transcript.slice(0, 40_000)}`,
          },
        ],
      }),
    })
    if (!res.ok) throw new Error(`Claude API ${res.status}`)
    const data = (await res.json()) as { content?: Array<{ text?: string }> }
    const summary = data.content?.map((c) => c.text ?? '').join('\n').trim() || 'No summary produced.'
    await prisma.meeting.update({
      where: { id: meetingId },
      data: { aiSummary: summary, summaryStatus: 'done' },
    })
    await audit('meeting.summarized', 'meeting', meetingId, null, { model: MODEL })
    return { ok: true }
  } catch (err) {
    await prisma.meeting.update({ where: { id: meetingId }, data: { summaryStatus: 'failed' } })
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
