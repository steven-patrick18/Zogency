-- Task completion workflow gate (BRB: Review → approve → Done).
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "require_task_approval" BOOLEAN NOT NULL DEFAULT false;

-- Task tags.
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT '{}';

-- Task attachments (data-URIs; ≤2MB each).
CREATE TABLE IF NOT EXISTS "task_attachments" (
  "id"          UUID NOT NULL,
  "tenant_id"   UUID NOT NULL,
  "task_id"     UUID NOT NULL,
  "name"        TEXT NOT NULL,
  "mime_type"   TEXT NOT NULL,
  "data"        TEXT NOT NULL,
  "size"        INTEGER NOT NULL,
  "uploaded_by" UUID,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "task_attachments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "task_attachments_tenant_task_idx" ON "task_attachments" ("tenant_id", "task_id");
ALTER TABLE "task_attachments"
  ADD CONSTRAINT "task_attachments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
