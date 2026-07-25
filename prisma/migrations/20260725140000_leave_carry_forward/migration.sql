-- Year-end carry-forward. openingBalance separates the carried baseline from the
-- current-year accrual so the annual-quota cap doesn't clobber carried days.
ALTER TABLE "leave_balances" ADD COLUMN "opening_balance" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "tenant_settings" ADD COLUMN "leave_rollover_year" INTEGER NOT NULL DEFAULT 0;

-- Freeze existing balances for the current year: they were granted in full
-- upfront, so treat them as fully accrued (accrued_months = 12) with their
-- current value as the opening baseline. The accrual sweep then leaves them
-- untouched; only future hires accrue from zero.
UPDATE "leave_balances" SET "opening_balance" = "available", "accrued_months" = 12;
