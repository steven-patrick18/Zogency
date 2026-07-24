-- AlterTable
ALTER TABLE "vendor_clients" ADD COLUMN     "last_checkin_at" TIMESTAMP(3),
ADD COLUMN     "last_seen_version" TEXT;

-- CreateTable
CREATE TABLE "vendor_releases" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "ref" TEXT NOT NULL DEFAULT 'main',
    "notes" TEXT NOT NULL DEFAULT '',
    "published_by" UUID,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_releases_pkey" PRIMARY KEY ("id")
);

