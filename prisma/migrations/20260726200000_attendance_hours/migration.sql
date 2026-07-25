-- Attendance from agent activity: policy caps, computed productive minutes,
-- excess-hours credit approvals.
ALTER TABLE "tenant_settings"
  ADD COLUMN "min_productive_minutes" INTEGER NOT NULL DEFAULT 480,
  ADD COLUMN "half_day_minutes" INTEGER NOT NULL DEFAULT 240,
  ADD COLUMN "agent_idle_logout_min" INTEGER NOT NULL DEFAULT 10;

ALTER TABLE "attendance_records"
  ADD COLUMN "productive_minutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "credit_minutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "status" TEXT;

CREATE TABLE "attendance_adjustments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "minutes" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'pending',
    "requested_by" UUID,
    "approved_by" UUID,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attendance_adjustments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "attendance_adjustments_tenant_id_employee_id_date_idx" ON "attendance_adjustments"("tenant_id", "employee_id", "date");
