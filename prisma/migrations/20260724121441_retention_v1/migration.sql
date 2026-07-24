-- CreateTable
CREATE TABLE "renewals" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "contract_ref" TEXT,
    "renewal_on" DATE NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'upcoming',
    "triggers_fired" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "renewals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_checkins" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "held_at" TIMESTAMP(3),
    "notes" TEXT,
    "owner_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_checkins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_health_scores" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "band" TEXT NOT NULL,
    "components" JSONB NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_health_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "churn_flags" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'high',
    "escalated_to" JSONB NOT NULL DEFAULT '[]',
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "churn_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_catalog" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "price_band" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "service_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upsell_opportunities" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'idea',
    "value" DECIMAL(12,2),
    "owner_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "upsell_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "renewals_tenant_id_renewal_on_status_idx" ON "renewals"("tenant_id", "renewal_on", "status");

-- CreateIndex
CREATE INDEX "client_health_scores_tenant_id_client_id_computed_at_idx" ON "client_health_scores"("tenant_id", "client_id", "computed_at");

-- CreateIndex
CREATE UNIQUE INDEX "service_catalog_tenant_id_name_key" ON "service_catalog"("tenant_id", "name");

-- AddForeignKey
ALTER TABLE "upsell_opportunities" ADD CONSTRAINT "upsell_opportunities_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "service_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
