-- Restricted (optional) holidays: employees pick from a published list via RH
-- leave, capped by the RH quota. Public holidays remain mandatory days off.
ALTER TABLE "holidays" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'public';
ALTER TABLE "leave_types" ADD COLUMN "requires_restricted_holiday" BOOLEAN NOT NULL DEFAULT false;

-- Link the seeded Restricted Holiday type to the restricted-holiday calendar.
UPDATE "leave_types" SET "requires_restricted_holiday" = true WHERE "code" = 'RH';
