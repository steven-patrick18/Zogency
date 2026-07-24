-- AlterTable
ALTER TABLE "calls" ADD COLUMN     "recording_url" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "agent_token" TEXT;

-- CreateTable
CREATE TABLE "activity_pings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "app_name" TEXT,
    "idle_sec" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "activity_pings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_pings_tenant_id_user_id_at_idx" ON "activity_pings"("tenant_id", "user_id", "at");

-- CreateIndex
CREATE UNIQUE INDEX "users_agent_token_key" ON "users"("agent_token");

