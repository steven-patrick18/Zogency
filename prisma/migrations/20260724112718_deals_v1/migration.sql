-- CreateEnum
CREATE TYPE "DealStage" AS ENUM ('open', 'verbal_commit', 'won', 'lost');

-- AlterTable
ALTER TABLE "tenant_settings" ADD COLUMN     "max_discount_percent" INTEGER NOT NULL DEFAULT 10;

-- CreateTable
CREATE TABLE "deals" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "owner_id" UUID,
    "stage" "DealStage" NOT NULL DEFAULT 'open',
    "value" DECIMAL(12,2),
    "currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "expected_close_on" DATE,
    "lost_reason" TEXT,
    "won_at" TIMESTAMP(3),
    "final_terms" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discovery_notes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "deal_id" UUID NOT NULL,
    "business_challenges" TEXT NOT NULL,
    "requirements" TEXT NOT NULL,
    "budget_notes" TEXT,
    "decision_timeline" TEXT,
    "author_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discovery_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_templates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "service_line" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "deal_id" UUID NOT NULL,
    "template_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "current_version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_versions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "proposal_id" UUID NOT NULL,
    "version_no" INTEGER NOT NULL,
    "list_amount" DECIMAL(12,2),
    "amount" DECIMAL(12,2) NOT NULL,
    "change_note" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3),
    "sent_by" UUID,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "requested_by" UUID NOT NULL,
    "approver_id" UUID,
    "state" TEXT NOT NULL DEFAULT 'pending',
    "decision_note" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "deal_id" UUID NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'logged',
    "envelope_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "signed_at" TIMESTAMP(3),
    "evidence_note" TEXT,
    "document_file_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "deals_lead_id_key" ON "deals"("lead_id");

-- CreateIndex
CREATE INDEX "deals_tenant_id_stage_idx" ON "deals"("tenant_id", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_templates_tenant_id_name_key" ON "proposal_templates"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_versions_tenant_id_proposal_id_version_no_key" ON "proposal_versions"("tenant_id", "proposal_id", "version_no");

-- CreateIndex
CREATE INDEX "approval_requests_tenant_id_state_type_idx" ON "approval_requests"("tenant_id", "state", "type");

-- CreateIndex
CREATE INDEX "approval_requests_tenant_id_entity_type_entity_id_idx" ON "approval_requests"("tenant_id", "entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_deal_id_key" ON "contracts"("deal_id");

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discovery_notes" ADD CONSTRAINT "discovery_notes_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_versions" ADD CONSTRAINT "proposal_versions_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
