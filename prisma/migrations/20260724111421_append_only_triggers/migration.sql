-- Append-only backstop (doc 03 §3): the domain layer never updates/deletes
-- these tables; this trigger makes the database enforce it too.
-- webhook_events and notifications are excluded — they carry mutable
-- processing-state pointer fields (status/processed_at, read_at).

CREATE OR REPLACE FUNCTION zgy_forbid_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only — corrections create new rows (supersedes_id), never edits', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lead_status_history_append_only
  BEFORE UPDATE OR DELETE ON lead_status_history
  FOR EACH ROW EXECUTE FUNCTION zgy_forbid_mutation();

CREATE TRIGGER lead_assignments_append_only
  BEFORE UPDATE OR DELETE ON lead_assignments
  FOR EACH ROW EXECUTE FUNCTION zgy_forbid_mutation();

CREATE TRIGGER comments_append_only
  BEFORE UPDATE OR DELETE ON comments
  FOR EACH ROW EXECUTE FUNCTION zgy_forbid_mutation();

CREATE TRIGGER audit_logs_append_only
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION zgy_forbid_mutation();
