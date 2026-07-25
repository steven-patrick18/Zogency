-- Deep monitoring (consented): window titles on pings + periodic screen captures.
ALTER TABLE "activity_pings" ADD COLUMN "window_title" TEXT;

CREATE TABLE "screen_captures" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "app_name" TEXT,
    "image" TEXT NOT NULL,

    CONSTRAINT "screen_captures_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "screen_captures_tenant_id_user_id_at_idx" ON "screen_captures"("tenant_id", "user_id", "at");
