-- AlterTable
ALTER TABLE "client_contacts" ADD COLUMN     "portal_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "portal_invite_token" TEXT,
ADD COLUMN     "portal_password_hash" TEXT;

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "contact_id" UUID,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "assignee_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_messages" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "author_kind" TEXT NOT NULL,
    "author_id" UUID,
    "author_name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'general',
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "mentions" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "client_id" UUID,
    "campaign_id" UUID,
    "title" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'instagram',
    "scheduled_on" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'idea',
    "owner_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_campaigns" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scheduled_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_campaign_recipients" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sent_at" TIMESTAMP(3),

    CONSTRAINT "email_campaign_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_deliveries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "report_key" TEXT NOT NULL,
    "client_id" UUID,
    "channel" TEXT NOT NULL DEFAULT 'email',
    "recipient" TEXT NOT NULL,
    "cadence" TEXT NOT NULL DEFAULT 'weekly',
    "next_run_on" DATE NOT NULL,
    "last_sent_at" TIMESTAMP(3),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduled_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retainer_schedules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "project_id" UUID,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "billing_day" INTEGER NOT NULL DEFAULT 1,
    "next_invoice_on" DATE NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retainer_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "support_tickets_tenant_id_status_idx" ON "support_tickets"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "ticket_messages_tenant_id_ticket_id_created_at_idx" ON "ticket_messages"("tenant_id", "ticket_id", "created_at");

-- CreateIndex
CREATE INDEX "chat_messages_tenant_id_channel_created_at_idx" ON "chat_messages"("tenant_id", "channel", "created_at");

-- CreateIndex
CREATE INDEX "content_items_tenant_id_scheduled_on_idx" ON "content_items"("tenant_id", "scheduled_on");

-- CreateIndex
CREATE INDEX "scheduled_deliveries_tenant_id_next_run_on_enabled_idx" ON "scheduled_deliveries"("tenant_id", "next_run_on", "enabled");

-- CreateIndex
CREATE INDEX "retainer_schedules_tenant_id_next_invoice_on_active_idx" ON "retainer_schedules"("tenant_id", "next_invoice_on", "active");

-- CreateIndex
CREATE UNIQUE INDEX "client_contacts_portal_invite_token_key" ON "client_contacts"("portal_invite_token");

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_campaign_recipients" ADD CONSTRAINT "email_campaign_recipients_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "email_campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

