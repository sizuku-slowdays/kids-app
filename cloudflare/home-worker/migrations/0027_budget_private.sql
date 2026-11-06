-- DEVELOPMENT ONLY. Requires reviewed backups and explicit production approval.
-- No legacy app_data, passbook, account balance, or existing personal grants are changed.
CREATE TABLE IF NOT EXISTS budget_states (
 owner_id TEXT PRIMARY KEY REFERENCES users(id), revision INTEGER NOT NULL DEFAULT 0,
 data_json TEXT NOT NULL CHECK(json_valid(data_json)), last_op TEXT,
 updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS budget_operations (
 owner_id TEXT NOT NULL REFERENCES users(id), event_id TEXT NOT NULL,
 request_hash TEXT NOT NULL, command_type TEXT NOT NULL,
 command_json TEXT NOT NULL CHECK(json_valid(command_json)),
 before_hash TEXT NOT NULL, after_hash TEXT NOT NULL, as_of TEXT NOT NULL,
 before_revision INTEGER NOT NULL, after_revision INTEGER NOT NULL,
 created_at TEXT NOT NULL, PRIMARY KEY(owner_id,event_id),
 UNIQUE(owner_id,after_revision)
);
CREATE TRIGGER IF NOT EXISTS budget_operation_no_update BEFORE UPDATE ON budget_operations BEGIN
 SELECT RAISE(ABORT,'budget audit immutable');
END;
CREATE TRIGGER IF NOT EXISTS budget_operation_no_delete BEFORE DELETE ON budget_operations BEGIN
 SELECT RAISE(ABORT,'budget audit immutable');
END;
CREATE TRIGGER IF NOT EXISTS budget_state_guard BEFORE UPDATE ON budget_states WHEN NEW.owner_id<>OLD.owner_id OR NEW.revision<>OLD.revision+1 BEGIN
 SELECT RAISE(ABORT,'budget revision invalid');
END;
INSERT INTO apps(id,name,icon,path,enabled,status,position,access_mode)
VALUES('household-budget','家計管理','👛','/apps/household-budget/',1,'ready',19,'personal') ON CONFLICT(id) DO NOTHING;
-- Deliberately NO personal_app_access grants and NO real owner/account initialization.
