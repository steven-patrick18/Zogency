'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requirePermission, withTenant } from '@/lib/authz'
import { recordPayment } from './service'

export type InvoiceActionState = { error?: string; success?: string }

export async function recordPaymentAction(_p: InvoiceActionState, formData: FormData): Promise<InvoiceActionState> {
  await requirePermission('invoices.manage')
  const invoiceId = z.string().uuid().parse(formData.get('invoiceId'))
  const amount = z.coerce.number().positive().safeParse(formData.get('amount'))
  if (!amount.success) return { error: 'Enter a positive amount' }
  const reference = String(formData.get('reference') ?? '').trim()

  const result = await withTenant(() =>
    recordPayment(invoiceId, { amount: amount.data, reference: reference || null }),
  )
  revalidatePath('/invoices')
  return result.ok ? { success: `Payment recorded — invoice ${result.status}` } : { error: result.error }
}
