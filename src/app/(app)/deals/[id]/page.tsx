import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePermission, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'
import { esignEnabled } from '@/modules/deals/esign'
import {
  ContractPanel,
  DealStageActions,
  DiscoveryPanel,
  ApprovalsPanel,
  ProposalPanel,
  SowPanel,
} from './panels'

const STAGE_STYLES: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700',
  verbal_commit: 'bg-amber-100 text-amber-700',
  won: 'bg-green-100 text-green-700',
  lost: 'bg-slate-200 text-slate-600',
}

export default async function DealRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission('deals.view')
  const { id } = await params

  const data = await withTenant(async () => {
    const deal = await prisma.deal.findUnique({
      where: { id },
      include: {
        lead: { include: { status: true } },
        discoveryNotes: { orderBy: { createdAt: 'desc' } },
        proposals: { include: { versions: { orderBy: { versionNo: 'desc' } } } },
        contract: true,
      },
    })
    if (!deal) return null
    const sow = await prisma.sowDeliverable.findMany({ where: { dealId: id }, orderBy: { createdAt: 'asc' } })
    const [templates, approvals, users, esign] = await Promise.all([
      prisma.proposalTemplate.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
      prisma.approvalRequest.findMany({
        where: { entityType: 'proposal_version', entityId: { in: deal.proposals.map((p) => p.id) } },
        orderBy: { requestedAt: 'desc' },
      }),
      prisma.user.findMany({ select: { id: true, name: true } }),
      esignEnabled(),
    ])
    return { deal, sow, templates, approvals, users, esign }
  })
  if (!data) notFound()
  const { deal, sow, templates, approvals, users, esign } = data
  const userName = new Map(users.map((u) => [u.id, u.name]))
  const proposal = deal.proposals[0]
  const canApprove = session.user.permissions.includes('deals.approve_discount')

  return (
    <div className="max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Deal room</p>
          <h1 className="text-2xl font-bold text-slate-900">{deal.lead.name}</h1>
          <p className="text-sm text-slate-500">
            {deal.lead.company ?? '—'} ·{' '}
            <Link href={`/leads/${deal.leadId}`} className="text-indigo-600 hover:underline">
              lead record
            </Link>{' '}
            · owner {deal.ownerId ? (userName.get(deal.ownerId) ?? '—') : '—'}
          </p>
        </div>
        <div className="text-right">
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${STAGE_STYLES[deal.stage]}`}>
            {deal.stage.replace('_', ' ')}
          </span>
          <p className="mt-1 text-lg font-bold text-slate-900">
            {deal.value ? `₹${Number(deal.value).toLocaleString('en-IN')}` : 'No value yet'}
          </p>
          {deal.lostReason && <p className="text-xs text-red-600">Lost: {deal.lostReason}</p>}
        </div>
      </div>

      <div className="mt-4">
        <DealStageActions dealId={deal.id} stage={deal.stage} />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-6">
        <div className="space-y-6">
          <DiscoveryPanel
            dealId={deal.id}
            notes={deal.discoveryNotes.map((n) => ({
              id: n.id,
              businessChallenges: n.businessChallenges,
              requirements: n.requirements,
              budgetNotes: n.budgetNotes,
              decisionTimeline: n.decisionTimeline,
              author: n.authorId ? (userName.get(n.authorId) ?? '') : '',
              at: n.createdAt.toLocaleString(),
            }))}
            readOnly={deal.stage === 'won' || deal.stage === 'lost'}
          />
          <ApprovalsPanel
            dealId={deal.id}
            canApprove={canApprove}
            approvals={approvals.map((a) => ({
              id: a.id,
              summary: a.summary,
              state: a.state,
              requestedBy: userName.get(a.requestedBy) ?? '',
              decisionNote: a.decisionNote,
              at: a.requestedAt.toLocaleString(),
            }))}
          />
        </div>
        <div className="space-y-6">
          <SowPanel
            dealId={deal.id}
            readOnly={deal.stage === 'won' || deal.stage === 'lost'}
            deliverables={sow.map((d) => ({
              id: d.id,
              serviceName: d.serviceName,
              description: d.description,
              quantity: d.quantity,
              frequency: d.frequency,
              deadline: d.deadline ? d.deadline.toDateString() : null,
              status: d.status,
            }))}
          />
          <ProposalPanel
            dealId={deal.id}
            templates={templates.map((t) => ({ id: t.id, name: t.name }))}
            proposalStatus={proposal?.status ?? null}
            versions={(proposal?.versions ?? []).map((v) => ({
              versionNo: v.versionNo,
              amount: Number(v.amount),
              listAmount: v.listAmount ? Number(v.listAmount) : null,
              changeNote: v.changeNote,
              sentAt: v.sentAt ? v.sentAt.toLocaleString() : null,
            }))}
            readOnly={deal.stage === 'won' || deal.stage === 'lost'}
          />
          <ContractPanel
            dealId={deal.id}
            contract={
              deal.contract
                ? { status: deal.contract.status, signedAt: deal.contract.signedAt?.toLocaleString() ?? null, evidenceNote: deal.contract.evidenceNote }
                : null
            }
            stage={deal.stage}
            esignEnabled={esign}
          />
        </div>
      </div>
    </div>
  )
}
