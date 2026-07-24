'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requirePermission, withTenant } from '@/lib/authz'
import { createLead } from './service'
import { parseCsv } from './csv'

const manualLeadSchema = z.object({
  name: z.string().min(1).max(150),
  phone: z.string().max(20).optional().or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  company: z.string().max(150).optional().or(z.literal('')),
  city: z.string().max(80).optional().or(z.literal('')),
  industry: z.string().max(80).optional().or(z.literal('')),
  sourceName: z.string().min(1),
})

export type LeadFormState = { error?: string; success?: string }

export async function createLeadAction(_prev: LeadFormState, formData: FormData): Promise<LeadFormState> {
  await requirePermission('leads.create')
  const parsed = manualLeadSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  const d = parsed.data

  const result = await withTenant(() =>
    createLead({
      name: d.name,
      phone: d.phone || null,
      email: d.email || null,
      company: d.company || null,
      city: d.city || null,
      industry: d.industry || null,
      sourceName: d.sourceName,
    }),
  )
  revalidatePath('/leads')
  if (result.outcome === 'rejected') return { error: result.reason }
  if (result.outcome === 'merged') return { success: 'Matched an existing lead — details merged, no duplicate created.' }
  return { success: `Lead "${result.lead.name}" created and assigned.` }
}

export type ImportState = {
  done?: boolean
  created?: number
  merged?: number
  errors?: Array<{ row: number; reason: string }>
  error?: string
}

const CSV_COLUMNS = ['name', 'phone', 'email', 'company', 'city', 'industry'] as const

export async function importCsvAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  await requirePermission('leads.import')
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose a CSV file' }
  if (file.size > 5_000_000) return { error: 'File too large (max 5 MB)' }

  const text = await file.text()
  const { headers, rows } = parseCsv(text)
  const known = headers.filter((h) => (CSV_COLUMNS as readonly string[]).includes(h))
  if (!known.includes('name') || (!known.includes('phone') && !known.includes('email'))) {
    return { error: `CSV needs at least "name" plus "phone" or "email" columns. Found: ${headers.join(', ') || 'none'}` }
  }

  let created = 0
  let merged = 0
  const errors: Array<{ row: number; reason: string }> = []

  await withTenant(async () => {
    for (const [i, row] of rows.entries()) {
      const get = (col: string) => {
        const idx = headers.indexOf(col)
        return idx >= 0 ? row[idx]?.trim() || null : null
      }
      const result = await createLead({
        name: get('name') ?? '',
        phone: get('phone'),
        email: get('email'),
        company: get('company'),
        city: get('city'),
        industry: get('industry'),
        sourceName: 'CSV Import',
      })
      if (result.outcome === 'created') created++
      else if (result.outcome === 'merged') merged++
      else errors.push({ row: i + 2, reason: result.reason }) // +2: 1-based + header row
    }
  })

  revalidatePath('/leads')
  return { done: true, created, merged, errors: errors.slice(0, 50) }
}
