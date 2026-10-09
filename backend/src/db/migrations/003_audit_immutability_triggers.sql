-- 003_audit_immutability_triggers.sql
-- Enforce append-only immutability on audit_logs at the SQLite engine level

CREATE TRIGGER IF NOT EXISTS prevent_audit_logs_update
BEFORE UPDATE ON audit_logs
BEGIN
    SELECT RAISE(FAIL, 'Audit log records are immutable and cannot be modified');
END;

CREATE TRIGGER IF NOT EXISTS prevent_audit_logs_delete
BEFORE DELETE ON audit_logs
BEGIN
    SELECT RAISE(FAIL, 'Audit log records are append-only and cannot be deleted');
END;
