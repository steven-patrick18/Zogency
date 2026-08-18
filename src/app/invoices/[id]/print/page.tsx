// Printable / PDF invoice (outside the app shell for a clean page). Uses the
// tenant's logo + selected template (Settings → General → Invoice branding).
import { notFound } from 'next/navigation'
import { requirePermission, withTenant } from '@/lib/authz'
import { prisma, prismaUnscoped } from '@/lib/db/prisma'
import { PrintButton } from './print-button'

const inr = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const d = (x: Date) => x.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission('invoices.view')
  const { id } = await params

  const tenant = await prismaUnscoped.tenant.findUnique({ where: { id: session.user.tenantId } })
  const data = await withTenant(async () => {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        client: { include: { contacts: { where: { isPrimary: true } } } },
        lineItems: true,
        payments: true,
      },
    })
    if (!invoice) return null
    const settings = await prisma.tenantSettings.findFirst()
    return { invoice, settings }
  })
  if (!data) notFound()
  const { invoice, settings } = data

  const subtotal = Number(invoice.subtotal)
  const gst = Number(invoice.gstAmount)
  const total = Number(invoice.total)
  const paid = invoice.payments.reduce((s, p) => s + Number(p.amount), 0)
  const balance = total - paid
  const template = settings?.invoiceTemplate ?? 'classic'
  const accent = settings?.primaryColor ?? '#4f46e5'
  const contact = invoice.client.contacts[0]

  const agencyLines = [
    settings?.addressLine,
    [settings?.city, settings?.stateRegion, settings?.postalCode].filter(Boolean).join(', '),
    settings?.country,
  ].filter(Boolean) as string[]
  const agencyName = tenant?.name ?? settings?.emailSenderName ?? 'Your Agency'

  // Shared line-item table.
  const itemsTable = (
    <table className="mt-6 w-full border-collapse text-sm">
      <thead>
        <tr className={template === 'modern' ? 'text-white' : 'border-b-2 border-slate-800 text-slate-700'} style={template === 'modern' ? { background: accent } : undefined}>
          <th className="px-3 py-2 text-left">Description</th>
          <th className="px-3 py-2 text-right">Qty</th>
          <th className="px-3 py-2 text-right">Rate</th>
          <th className="px-3 py-2 text-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        {invoice.lineItems.map((li) => (
          <tr key={li.id} className="border-b border-slate-200">
            <td className="px-3 py-2 text-slate-800">{li.description}</td>
            <td className="px-3 py-2 text-right text-slate-600">{li.qty}</td>
            <td className="px-3 py-2 text-right text-slate-600">{inr(Number(li.rate))}</td>
            <td className="px-3 py-2 text-right text-slate-800">{inr(Number(li.amount))}</td>
          </tr>
        ))}
        {invoice.lineItems.length === 0 && (
          <tr className="border-b border-slate-200">
            <td className="px-3 py-2 text-slate-800">Services rendered</td>
            <td className="px-3 py-2 text-right text-slate-600">1</td>
            <td className="px-3 py-2 text-right text-slate-600">{inr(subtotal)}</td>
            <td className="px-3 py-2 text-right text-slate-800">{inr(subtotal)}</td>
          </tr>
        )}
      </tbody>
    </table>
  )

  const totals = (
    <div className="mt-4 ml-auto w-64 text-sm">
      <div className="flex justify-between py-1"><span className="text-slate-500">Subtotal</span><span className="text-slate-800">{inr(subtotal)}</span></div>
      <div className="flex justify-between py-1"><span className="text-slate-500">GST ({Number(invoice.gstRate)}%)</span><span className="text-slate-800">{inr(gst)}</span></div>
      <div className="mt-1 flex justify-between border-t-2 py-2 text-base font-bold" style={{ borderColor: accent }}><span>Total</span><span>{inr(total)}</span></div>
      {paid > 0 && <div className="flex justify-between py-1 text-green-700"><span>Paid</span><span>−{inr(paid)}</span></div>}
      {balance > 0.001 && <div className="flex justify-between py-1 font-semibold"><span>Balance due</span><span>{inr(balance)}</span></div>}
    </div>
  )

  const logo = settings?.logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={settings.logo} alt={agencyName} className="max-h-16 max-w-[180px] object-contain" />
  ) : (
    <div className="text-xl font-bold" style={{ color: template === 'modern' ? '#fff' : accent }}>{agencyName}</div>
  )

  const agencyBlock = (light = false) => (
    <div className={`text-xs ${light ? 'text-white/90' : 'text-slate-500'}`}>
      <p className={`text-sm font-semibold ${light ? 'text-white' : 'text-slate-800'}`}>{agencyName}</p>
      {agencyLines.map((l, i) => <p key={i}>{l}</p>)}
      {settings?.phone && <p>{settings.phone}</p>}
      {settings?.websiteUrl && <p>{settings.websiteUrl}</p>}
      {settings?.taxId && <p>GSTIN: {settings.taxId}</p>}
    </div>
  )

  const billTo = (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Bill to</p>
      <p className="mt-1 text-sm font-semibold text-slate-800">{invoice.client.name}</p>
      {contact && <p className="text-xs text-slate-500">{contact.name}{contact.email ? ` · ${contact.email}` : ''}{contact.phone ? ` · ${contact.phone}` : ''}</p>}
    </div>
  )

  const meta = (
    <div className="text-sm">
      <p className="text-xs uppercase tracking-wide text-slate-400">Invoice</p>
      <p className="font-bold text-slate-900">{invoice.number}</p>
      <p className="mt-1 text-xs text-slate-500">Issued: {d(invoice.issueOn)}</p>
      <p className="text-xs text-slate-500">Due: {d(invoice.dueOn)}</p>
      <p className="mt-1 text-xs font-semibold capitalize" style={{ color: invoice.status === 'paid' ? '#15803d' : invoice.status === 'overdue' ? '#b91c1c' : '#b45309' }}>
        {invoice.status}
      </p>
    </div>
  )

  return (
    <main className="mx-auto max-w-3xl bg-white p-10 text-slate-900">
      <PrintButton />

      {template === 'modern' ? (
        <div className="-mx-10 -mt-10 mb-6 flex items-center justify-between px-10 py-8" style={{ background: accent }}>
          <div>{logo}</div>
          <div className="text-right text-white">
            <p className="text-2xl font-bold">INVOICE</p>
            <p className="text-sm text-white/90">{invoice.number}</p>
          </div>
        </div>
      ) : (
        <div className={`flex items-start justify-between ${template === 'classic' ? 'border-b-2 border-slate-800 pb-4' : 'pb-4'}`}>
          <div>{logo}</div>
          <div className="text-right">
            <p className="text-2xl font-bold tracking-tight text-slate-900">{template === 'classic' ? 'TAX INVOICE' : 'Invoice'}</p>
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-between gap-8">
        {template === 'modern' ? agencyBlock(false) : agencyBlock(false)}
        {meta}
      </div>

      <div className="mt-6">{billTo}</div>

      {itemsTable}
      {totals}

      {balance > 0.001 && (
        <p className="mt-8 text-xs text-slate-500">Please make payment by {d(invoice.dueOn)}. Thank you for your business.</p>
      )}
      <div className="mt-10 border-t border-slate-200 pt-3 text-center text-[10px] text-slate-400">
        {agencyName}{settings?.taxId ? ` · GSTIN ${settings.taxId}` : ''} — generated by Zogency
      </div>
    </main>
  )
}
