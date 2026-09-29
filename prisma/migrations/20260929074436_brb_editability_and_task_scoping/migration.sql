-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "created_by_id" UUID;

-- RenameIndex
ALTER INDEX "task_assignees_tenant_user_idx" RENAME TO "task_assignees_tenant_id_user_id_idx";

-- RenameIndex
ALTER INDEX "task_attachments_tenant_task_idx" RENAME TO "task_attachments_tenant_id_task_id_idx";

-- Backfill the new creator column from the audit trail: every task created
-- through createTaskAction wrote a `task.create` row naming the actor.
UPDATE "tasks" t
SET "created_by_id" = a."actor_id"
FROM (
  SELECT DISTINCT ON ("entity_id") "entity_id", "actor_id"
  FROM "audit_logs"
  WHERE "action" = 'task.create' AND "entity_id" IS NOT NULL AND "actor_id" IS NOT NULL
  ORDER BY "entity_id", "at" ASC
) a
WHERE a."entity_id" = t."id" AND t."created_by_id" IS NULL;

-- New permission: edit/reassign ANY task, not just your own (BRB issue #3).
-- The deploy path runs `migrate deploy`, never the seed, so a permission added
-- to seed.ts must also be inserted here to reach already-seeded databases.
INSERT INTO "permissions" ("id", "key", "module", "description")
VALUES (gen_random_uuid(), 'tasks.manage', 'tasks', 'Edit, reassign and complete ANY task (not just your own)')
ON CONFLICT ("key") DO NOTHING;

-- Grant it to the full-access roles plus the team leads who need cross-team
-- reach. Everyone else keeps tasks.edit, which now only covers their own work.
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE p."key" = 'tasks.manage'
  AND r."name" IN ('Admin', 'Demo Admin', 'Marketing Manager')
ON CONFLICT DO NOTHING;
