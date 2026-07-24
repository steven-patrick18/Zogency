-- Audit hardening: make the "at most once" sweeps idempotent at the DB level so
-- concurrent sweeps cannot create duplicate escalations / churn flags.

-- SLA escalations: one escalation per (tenant, entity, rule). Remove any existing
-- duplicates (keep the earliest by breached_at) before adding the unique index.
DELETE FROM "sla_escalations" a
USING "sla_escalations" b
WHERE a."tenant_id" = b."tenant_id"
  AND a."entity_type" = b."entity_type"
  AND a."entity_id" = b."entity_id"
  AND a."rule_ref" = b."rule_ref"
  AND a."breached_at" > b."breached_at";

CREATE UNIQUE INDEX "sla_escalations_tenant_id_entity_type_entity_id_rule_ref_key"
  ON "sla_escalations"("tenant_id", "entity_type", "entity_id", "rule_ref");

-- Churn flags: at most one UNRESOLVED flag per client (a partial unique index —
-- resolved flags may accumulate as history). Not expressible in the Prisma
-- schema DSL, so it lives here. Deduplicate open flags first.
DELETE FROM "churn_flags" a
USING "churn_flags" b
WHERE a."tenant_id" = b."tenant_id"
  AND a."client_id" = b."client_id"
  AND a."resolved_at" IS NULL
  AND b."resolved_at" IS NULL
  AND a."created_at" > b."created_at";

CREATE UNIQUE INDEX "churn_flags_open_per_client_key"
  ON "churn_flags"("tenant_id", "client_id")
  WHERE "resolved_at" IS NULL;
