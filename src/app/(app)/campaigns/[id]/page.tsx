import { notFound } from 'next/navigation'
import { requirePermission, withTenant } from '@/lib/authz'
import { prisma } from '@/lib/db/prisma'
import {
  ApprovalsListPanel,
  BriefPanel,
  ClientApprovalPanel,
  ClosurePanel,
  CreativePanel,
  LaunchPanel,
  MonitoringPanel,
  StageProgress,
  StrategyPlanPanel,
  type KpiResult,
} from './panels'

const STATUS_STYLES: Record<string, string> = {
  brief: 'bg-slate-100 text-slate-600',
  planning: 'bg-blue-100 text-blue-700',
  creative: 'bg-purple-100 text-purple-700',
  approval: 'bg-amber-100 text-amber-700',
  launched: 'bg-green-100 text-green-700',
  monitoring: 'bg-teal-100 text-teal-700',
  reporting: 'bg-indigo-100 text-indigo-700',
  closed: 'bg-slate-200 text-slate-600',
}

export default async function CampaignWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission('campaigns.view')
  const { id } = await params

  const data = await withTenant(async () => {
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        brief: true,
        strategy: true,
        plan: { include: { milestones: true } },
        budget: true,
        concepts: { orderBy: { createdAt: 'desc' } },
        assets: { orderBy: { createdAt: 'desc' } },
        revisionRounds: { orderBy: { roundNo: 'desc' } },
        signoffs: { orderBy: { createdAt: 'desc' } },
        checklistItems: true,
        channels: true,
        kpis: { include: { snapshots: { orderBy: { capturedAt: 'desc' }, take: 1 } } },
        optimizations: { orderBy: { createdAt: 'desc' } },
        report: true,
        closure: true,
      },
    })
    if (!campaign) return null
    const [approvals, users, client] = await Promise.all([
      prisma.approvalRequest.findMany({
        where: { entityType: 'campaign', entityId: id },
        orderBy: { requestedAt: 'desc' },
      }),
      prisma.user.findMany({ select: { id: true, name: true } }),
      campaign.clientId
        ? prisma.client.findUnique({ where: { id: campaign.clientId }, select: { name: true } })
        : Promise.resolve(null),
    ])
    return { campaign, approvals, users, client }
  })
  if (!data) notFound()
  const { campaign, approvals, users, client } = data
  const userName = new Map(users.map((u) => [u.id, u.name]))
  const canApprove = session.user.permissions.includes('campaigns.approve')

  const clientRoundsUsed = campaign.revisionRounds.filter((r) => r.source === 'client').length
  const briefApproval = approvals.find((a) => a.type === 'brief') ?? null
  const budgetApproval = approvals.find((a) => a.type === 'budget') ?? null

  return (
    <div className="max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Campaign workspace</p>
          <h1 className="text-2xl font-bold text-slate-900">{campaign.name}</h1>
          <p className="text-sm text-slate-500">
            {client?.name ?? 'Internal'} · manager{' '}
            {campaign.managerId ? (userName.get(campaign.managerId) ?? '—') : '—'}
          </p>
        </div>
        <div className="text-right">
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${STATUS_STYLES[campaign.status] ?? 'bg-slate-100 text-slate-600'}`}>
            {campaign.status}
          </span>
          <p className="mt-1 text-sm text-slate-500">
            Client revision rounds:{' '}
            <span className={clientRoundsUsed > campaign.revisionLimit ? 'font-semibold text-red-600' : 'font-semibold text-slate-900'}>
              {clientRoundsUsed} / {campaign.revisionLimit}
            </span>
          </p>
        </div>
      </div>

      <div className="mt-4">
        <StageProgress campaignId={campaign.id} status={campaign.status} />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-6">
        <div className="space-y-6">
          <BriefPanel
            campaignId={campaign.id}
            brief={
              campaign.brief
                ? {
                    objectives: campaign.brief.objectives,
                    targetAudience: campaign.brief.targetAudience,
                    deliverables: campaign.brief.deliverables,
                    timeline: campaign.brief.timeline,
                    budgetEstimate: campaign.brief.budgetEstimate,
                    kickoffCallAt: campaign.brief.kickoffCallAt
                      ? campaign.brief.kickoffCallAt.toISOString().slice(0, 16)
                      : null,
                  }
                : null
            }
            briefApproval={
              briefApproval ? { state: briefApproval.state, decisionNote: briefApproval.decisionNote } : null
            }
          />
          <ApprovalsListPanel
            campaignId={campaign.id}
            canApprove={canApprove}
            approvals={approvals.map((a) => ({
              id: a.id,
              type: a.type,
              summary: a.summary,
              state: a.state,
              requestedBy: userName.get(a.requestedBy) ?? '—',
              decisionNote: a.decisionNote,
              at: a.requestedAt.toLocaleString(),
            }))}
          />
          <CreativePanel
            campaignId={campaign.id}
            canApprove={canApprove}
            concepts={campaign.concepts.map((c) => ({
              id: c.id,
              title: c.title,
              concept: c.concept,
              direction: c.direction,
              at: c.createdAt.toLocaleString(),
            }))}
            assets={campaign.assets.map((a) => ({ id: a.id, title: a.title, type: a.type, status: a.status }))}
          />
          <LaunchPanel
            campaignId={campaign.id}
            items={campaign.checklistItems.map((i) => ({ id: i.id, title: i.title, checked: !!i.checkedAt }))}
            channels={campaign.channels.map((ch) => ({
              id: ch.id,
              channel: ch.channel,
              status: ch.status,
              goLiveAt: ch.goLiveAt ? ch.goLiveAt.toLocaleString() : null,
            }))}
          />
        </div>
        <div className="space-y-6">
          <StrategyPlanPanel
            campaignId={campaign.id}
            strategy={
              campaign.strategy
                ? {
                    approach: campaign.strategy.approach,
                    audienceSegments: campaign.strategy.audienceSegments,
                    keyMessages: campaign.strategy.keyMessages,
                    channelMix: campaign.strategy.channelMix,
                  }
                : null
            }
            plan={
              campaign.plan
                ? {
                    timelineStart: campaign.plan.timelineStart.toISOString().slice(0, 10),
                    timelineEnd: campaign.plan.timelineEnd.toISOString().slice(0, 10),
                    resourceAllocation: campaign.plan.resourceAllocation,
                  }
                : null
            }
            budget={campaign.budget ? { amount: Number(campaign.budget.amount), breakdown: campaign.budget.breakdown } : null}
            budgetApprovalState={budgetApproval?.state ?? null}
          />
          <ClientApprovalPanel
            campaignId={campaign.id}
            revisionLimit={campaign.revisionLimit}
            rounds={campaign.revisionRounds.map((r) => ({
              id: r.id,
              roundNo: r.roundNo,
              feedback: r.feedback,
              overLimit: r.overLimit,
              source: r.source,
              at: r.createdAt.toLocaleString(),
            }))}
            signoffs={campaign.signoffs.map((s) => ({
              id: s.id,
              signedBy: s.signedBy,
              evidence: s.evidence,
              scope: s.scope,
              at: s.createdAt.toLocaleString(),
            }))}
          />
          <MonitoringPanel
            campaignId={campaign.id}
            kpis={campaign.kpis.map((k) => ({
              id: k.id,
              name: k.name,
              target: Number(k.target),
              latest: k.snapshots[0]
                ? { value: Number(k.snapshots[0].value), at: k.snapshots[0].capturedAt.toLocaleString() }
                : null,
            }))}
            optimizations={campaign.optimizations.map((o) => ({
              id: o.id,
              changeType: o.changeType,
              description: o.description,
              reasoning: o.reasoning,
              at: o.createdAt.toLocaleString(),
            }))}
          />
          <ClosurePanel
            campaignId={campaign.id}
            canApprove={canApprove}
            report={
              campaign.report
                ? {
                    summary: campaign.report.summary,
                    kpiResults: (campaign.report.kpiResults as KpiResult[] | null) ?? [],
                  }
                : null
            }
            closure={
              campaign.closure
                ? { learnings: campaign.closure.learnings, at: campaign.closure.closedAt.toLocaleString() }
                : null
            }
          />
        </div>
      </div>
    </div>
  )
}
