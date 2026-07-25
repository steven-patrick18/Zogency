-- Strict leave policy (2026): per-type rules, tenant-level caps, per-employee
-- weekly-offs and confirmation date.

-- Leave type rules
ALTER TABLE "leave_types"
  ADD COLUMN "code" TEXT,
  ADD COLUMN "accrual_per_month" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "carry_forward_max" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "max_consecutive" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "woff_adjacency" TEXT NOT NULL DEFAULT 'allowed',
  ADD COLUMN "standalone_only" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "clubbable_with_leave" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "encashable" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "requires_confirmation" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "lapses" BOOLEAN NOT NULL DEFAULT true;

-- Tenant-level leave caps
ALTER TABLE "tenant_settings"
  ADD COLUMN "max_continuous_absence_days" INTEGER NOT NULL DEFAULT 4,
  ADD COLUMN "planned_leave_notice_days" INTEGER NOT NULL DEFAULT 2;

-- Per-employee weekly offs + confirmation date
ALTER TABLE "employees"
  ADD COLUMN "confirmed_on" DATE,
  ADD COLUMN "weekly_off_days" INTEGER[] NOT NULL DEFAULT '{0,6}';
