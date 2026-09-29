-- The handover chain creates delivery tasks with the legacy assignee_id column
-- but never wrote a task_assignees row, so those tasks render as "Unassigned"
-- on the board and (with task ownership now enforced) would belong to nobody.
-- Backfill the join rows for every such task.
INSERT INTO "task_assignees" ("tenant_id", "task_id", "user_id")
SELECT t."tenant_id", t."id", t."assignee_id"
FROM "tasks" t
WHERE t."assignee_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "task_assignees" a WHERE a."task_id" = t."id" AND a."user_id" = t."assignee_id"
  )
  AND EXISTS (SELECT 1 FROM "users" u WHERE u."id" = t."assignee_id")
ON CONFLICT DO NOTHING;
