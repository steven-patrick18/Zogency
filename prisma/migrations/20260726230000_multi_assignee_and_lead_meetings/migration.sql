-- Multi-assignee tasks (BRB): a task can be assigned to several people.
CREATE TABLE IF NOT EXISTS "task_assignees" (
  "tenant_id" UUID NOT NULL,
  "task_id"   UUID NOT NULL,
  "user_id"   UUID NOT NULL,
  CONSTRAINT "task_assignees_pkey" PRIMARY KEY ("task_id", "user_id")
);
CREATE INDEX IF NOT EXISTS "task_assignees_tenant_user_idx" ON "task_assignees" ("tenant_id", "user_id");

ALTER TABLE "task_assignees"
  ADD CONSTRAINT "task_assignees_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_assignees"
  ADD CONSTRAINT "task_assignees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill existing single assignees as the first assignee.
INSERT INTO "task_assignees" ("tenant_id", "task_id", "user_id")
SELECT "tenant_id", "id", "assignee_id" FROM "tasks" WHERE "assignee_id" IS NOT NULL
ON CONFLICT DO NOTHING;

-- Meetings can belong to a prospect (lead), not only a client (BRB).
ALTER TABLE "meetings" ADD COLUMN IF NOT EXISTS "lead_id" UUID;
