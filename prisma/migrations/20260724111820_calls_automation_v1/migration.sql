-- CreateEnum
CREATE TYPE "CallDirection" AS ENUM ('inbound', 'outbound');

-- CreateTable
CREATE TABLE "calls" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "user_id" UUID,
    "provider" TEXT NOT NULL DEFAULT 'manual',
    "provider_call_id" TEXT,
    "direction" "CallDirection" NOT NULL DEFAULT 'outbound',
    "started_at" TIMESTAMP(3) NOT NULL,
    "duration_sec" INTEGER,
    "disposition" TEXT,
    "outcome_note" TEXT,
    "recording_file_id" UUID,
    "is_manual_log" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_escalations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "rule_ref" TEXT NOT NULL,
    "breached_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "escalated_to" JSONB NOT NULL DEFAULT '[]',
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "sla_escalations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_rules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "trigger_type" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "conditions" JSONB NOT NULL DEFAULT '[]',
    "actions" JSONB NOT NULL DEFAULT '[]',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "run_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_runs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "rule_id" UUID NOT NULL,
    "event_key" TEXT NOT NULL,
    "trigger_entity_type" TEXT NOT NULL,
    "trigger_entity_id" UUID NOT NULL,
    "actions_executed" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'success',
    "error" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calls_tenant_id_lead_id_started_at_idx" ON "calls"("tenant_id", "lead_id", "started_at");

-- CreateIndex
CREATE INDEX "sla_escalations_tenant_id_entity_type_entity_id_idx" ON "sla_escalations"("tenant_id", "entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_runs_tenant_id_rule_id_event_key_key" ON "automation_runs"("tenant_id", "rule_id", "event_key");

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "automation_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
