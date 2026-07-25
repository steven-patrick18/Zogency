-- HR-editable leave-policy prose. NULL = show the auto-generated document.
ALTER TABLE "tenant_settings" ADD COLUMN "leave_policy_doc" TEXT;
