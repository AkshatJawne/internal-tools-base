CREATE TRIGGER IF NOT EXISTS audit_event_no_update BEFORE UPDATE ON "AuditEvent"
BEGIN SELECT RAISE(ABORT, 'AuditEvent is append-only'); END;
CREATE TRIGGER IF NOT EXISTS audit_event_no_delete BEFORE DELETE ON "AuditEvent"
BEGIN SELECT RAISE(ABORT, 'AuditEvent is append-only'); END;
