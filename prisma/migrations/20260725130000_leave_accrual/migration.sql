-- Monthly leave accrual: track how many monthly grants have been applied this
-- year so the accrual sweep is idempotent.
ALTER TABLE "leave_balances" ADD COLUMN "accrued_months" INTEGER NOT NULL DEFAULT 0;
