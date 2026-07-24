-- AlterTable
ALTER TABLE "users" ADD COLUMN     "setup_token" TEXT;

-- CreateTable
CREATE TABLE "vendor_clients" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_name" TEXT NOT NULL,
    "contact_email" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "server_ip" TEXT NOT NULL,
    "ssh_user" TEXT NOT NULL DEFAULT 'root',
    "ssh_password_enc" TEXT,
    "license_key" TEXT NOT NULL,
    "license_expires_at" TIMESTAMP(3) NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'pro',
    "seats" INTEGER NOT NULL DEFAULT 15,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "install_log" TEXT NOT NULL DEFAULT '',
    "setup_link" TEXT,
    "installed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_clients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_setup_token_key" ON "users"("setup_token");

