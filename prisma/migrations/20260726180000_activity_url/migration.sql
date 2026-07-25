-- Capture the browser URL where the OS exposes it (deep monitoring).
ALTER TABLE "activity_pings" ADD COLUMN "window_url" TEXT;
