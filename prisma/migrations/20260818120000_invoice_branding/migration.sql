-- Invoice branding: workspace logo (data-URI) + selected printable template.
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "logo" TEXT;
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "invoice_template" TEXT NOT NULL DEFAULT 'classic';
