-- CreateTable
CREATE TABLE "chat_reads" (
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "last_read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_reads_pkey" PRIMARY KEY ("user_id","channel")
);

-- CreateIndex
CREATE INDEX "chat_reads_tenant_id_user_id_idx" ON "chat_reads"("tenant_id", "user_id");
