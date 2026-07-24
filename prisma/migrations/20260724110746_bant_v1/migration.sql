-- CreateTable
CREATE TABLE "bant_qualifications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "budget_range" TEXT NOT NULL,
    "authority" TEXT NOT NULL,
    "need" TEXT NOT NULL,
    "timeline" TEXT NOT NULL,
    "qualified_by" UUID,
    "qualified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bant_qualifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bant_qualifications_lead_id_key" ON "bant_qualifications"("lead_id");
