-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('brief', 'planning', 'creative', 'approval', 'launched', 'monitoring', 'reporting', 'closed');

-- CreateTable
CREATE TABLE "campaigns" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "client_id" UUID,
    "name" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'brief',
    "manager_id" UUID,
    "account_owner_id" UUID,
    "revision_limit" INTEGER NOT NULL DEFAULT 2,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "briefs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "objectives" TEXT NOT NULL,
    "target_audience" TEXT NOT NULL,
    "deliverables" TEXT NOT NULL,
    "timeline" TEXT NOT NULL,
    "budget_estimate" TEXT,
    "kickoff_call_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "briefs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_strategies" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "approach" TEXT NOT NULL,
    "audience_segments" TEXT NOT NULL,
    "key_messages" TEXT NOT NULL,
    "channel_mix" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_strategies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_plans" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "timeline_start" DATE NOT NULL,
    "timeline_end" DATE NOT NULL,
    "resource_allocation" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_milestones" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "due_on" DATE NOT NULL,
    "owner_id" UUID,
    "done_at" TIMESTAMP(3),

    CONSTRAINT "plan_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "breakdown" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creative_concepts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "direction" TEXT,
    "author_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creative_concepts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creative_assets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "current_file_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creative_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revision_rounds" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "round_no" INTEGER NOT NULL,
    "feedback" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'client',
    "over_limit" BOOLEAN NOT NULL DEFAULT false,
    "logged_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revision_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_signoffs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'final',
    "method" TEXT NOT NULL DEFAULT 'logged_written',
    "evidence" TEXT NOT NULL,
    "signed_by" TEXT NOT NULL,
    "logged_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_signoffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "launch_checklist_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "checked_by" UUID,
    "checked_at" TIMESTAMP(3),

    CONSTRAINT "launch_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_channels" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "go_live_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'scheduled',

    CONSTRAINT "campaign_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_kpis" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "target" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_kpis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_snapshots" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "kpi_id" UUID NOT NULL,
    "value" DECIMAL(14,2) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpi_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "optimization_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "change_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "actor_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "optimization_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_reports" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "summary" TEXT NOT NULL,
    "kpi_results" JSONB NOT NULL,
    "presented_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_closures" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "learnings" TEXT NOT NULL,
    "closed_by" UUID,
    "closed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_closures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "campaigns_tenant_id_status_idx" ON "campaigns"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "briefs_campaign_id_key" ON "briefs"("campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_strategies_campaign_id_key" ON "campaign_strategies"("campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_plans_campaign_id_key" ON "campaign_plans"("campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_campaign_id_key" ON "budgets"("campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_reports_campaign_id_key" ON "campaign_reports"("campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_closures_campaign_id_key" ON "project_closures"("campaign_id");

-- AddForeignKey
ALTER TABLE "briefs" ADD CONSTRAINT "briefs_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_strategies" ADD CONSTRAINT "campaign_strategies_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_plans" ADD CONSTRAINT "campaign_plans_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_milestones" ADD CONSTRAINT "plan_milestones_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "campaign_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_concepts" ADD CONSTRAINT "creative_concepts_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_assets" ADD CONSTRAINT "creative_assets_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_rounds" ADD CONSTRAINT "revision_rounds_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_signoffs" ADD CONSTRAINT "client_signoffs_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "launch_checklist_items" ADD CONSTRAINT "launch_checklist_items_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_channels" ADD CONSTRAINT "campaign_channels_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_kpis" ADD CONSTRAINT "campaign_kpis_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_snapshots" ADD CONSTRAINT "kpi_snapshots_kpi_id_fkey" FOREIGN KEY ("kpi_id") REFERENCES "campaign_kpis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "optimization_logs" ADD CONSTRAINT "optimization_logs_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_reports" ADD CONSTRAINT "campaign_reports_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_closures" ADD CONSTRAINT "project_closures_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
