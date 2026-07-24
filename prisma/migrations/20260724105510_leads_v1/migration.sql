-- CreateTable
CREATE TABLE "lead_sources" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "campaign_ref" TEXT,
    "is_mql" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_statuses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "is_terminal" BOOLEAN NOT NULL DEFAULT false,
    "is_won" BOOLEAN NOT NULL DEFAULT false,
    "is_junk" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT NOT NULL DEFAULT '#64748b',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "city" TEXT,
    "industry" TEXT,
    "source_id" UUID NOT NULL,
    "status_id" UUID NOT NULL,
    "owner_id" UUID,
    "sla_due_at" TIMESTAMP(3),
    "first_contacted_at" TIMESTAMP(3),
    "junk_reason" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_status_history" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "from_status_id" UUID,
    "to_status_id" UUID NOT NULL,
    "comment_id" UUID NOT NULL,
    "actor_id" UUID,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_assignments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "assignee_id" UUID NOT NULL,
    "assigned_by" UUID,
    "rule_id" UUID,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_rules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "criteria" JSONB NOT NULL DEFAULT '{}',
    "target_user_ids" JSONB NOT NULL DEFAULT '[]',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignment_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lead_sources_tenant_id_name_key" ON "lead_sources"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "lead_statuses_tenant_id_name_key" ON "lead_statuses"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "leads_tenant_id_status_id_owner_id_idx" ON "leads"("tenant_id", "status_id", "owner_id");

-- CreateIndex
CREATE INDEX "leads_tenant_id_sla_due_at_idx" ON "leads"("tenant_id", "sla_due_at");

-- CreateIndex
CREATE UNIQUE INDEX "leads_tenant_id_phone_key" ON "leads"("tenant_id", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "leads_tenant_id_email_key" ON "leads"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "lead_status_history_tenant_id_lead_id_at_idx" ON "lead_status_history"("tenant_id", "lead_id", "at");

-- CreateIndex
CREATE INDEX "lead_assignments_tenant_id_lead_id_at_idx" ON "lead_assignments"("tenant_id", "lead_id", "at");

-- CreateIndex
CREATE INDEX "lead_assignments_tenant_id_assignee_id_at_idx" ON "lead_assignments"("tenant_id", "assignee_id", "at");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "lead_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "lead_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_status_history" ADD CONSTRAINT "lead_status_history_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
