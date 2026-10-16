-- School preparation only. No existing records are updated or removed.
CREATE TABLE learning_school_versions (
 household_id TEXT NOT NULL REFERENCES groups(id), child_id TEXT NOT NULL REFERENCES children(id),
 school_day TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision>0),
 is_school_day INTEGER NOT NULL CHECK(is_school_day IN (0,1)),
 dismissal TEXT, tasks_json TEXT NOT NULL CHECK(json_valid(tasks_json)),
 source_file_id TEXT REFERENCES private_files(id), confirmed_by TEXT NOT NULL REFERENCES users(id), confirmed_at TEXT NOT NULL,
 PRIMARY KEY(household_id,child_id,school_day,revision)
);
CREATE TABLE learning_school_checks (
 household_id TEXT NOT NULL, child_id TEXT NOT NULL, school_day TEXT NOT NULL, revision INTEGER NOT NULL,
 task_id TEXT NOT NULL, phase TEXT NOT NULL CHECK(phase IN ('homework','night','morning')),
 done INTEGER NOT NULL CHECK(done IN (0,1)), changed_by TEXT NOT NULL REFERENCES users(id), updated_at TEXT NOT NULL,
 PRIMARY KEY(household_id,child_id,school_day,revision,task_id,phase),
 FOREIGN KEY(household_id,child_id,school_day,revision) REFERENCES learning_school_versions(household_id,child_id,school_day,revision)
);
-- Receipts make retries safe; the caller's request id must match the original payload.
CREATE TABLE learning_school_receipts (
 household_id TEXT NOT NULL REFERENCES groups(id), actor_id TEXT NOT NULL REFERENCES users(id), request_id TEXT NOT NULL,
 payload_json TEXT NOT NULL CHECK(json_valid(payload_json)), created_at TEXT NOT NULL,
 PRIMARY KEY(household_id,actor_id,request_id)
);
CREATE TRIGGER learning_school_receipt_applies_check AFTER INSERT ON learning_school_receipts
BEGIN
 INSERT INTO learning_school_checks(household_id,child_id,school_day,revision,task_id,phase,done,changed_by,updated_at)
 VALUES(NEW.household_id,json_extract(NEW.payload_json,'$.child'),json_extract(NEW.payload_json,'$.day'),json_extract(NEW.payload_json,'$.revision'),json_extract(NEW.payload_json,'$.task_id'),json_extract(NEW.payload_json,'$.phase'),json_extract(NEW.payload_json,'$.done'),NEW.actor_id,NEW.created_at)
 ON CONFLICT(household_id,child_id,school_day,revision,task_id,phase)
 DO UPDATE SET done=excluded.done,changed_by=excluded.changed_by,updated_at=excluded.updated_at;
END;

CREATE TABLE learning_school_preferences (
 household_id TEXT NOT NULL REFERENCES groups(id), user_id TEXT NOT NULL REFERENCES users(id),
 notify_enabled INTEGER NOT NULL DEFAULT 0 CHECK(notify_enabled IN (0,1)), updated_at TEXT NOT NULL,
 PRIMARY KEY(household_id,user_id)
);
CREATE TABLE learning_school_deliveries (
 id TEXT PRIMARY KEY, household_id TEXT NOT NULL, child_id TEXT NOT NULL, school_day TEXT NOT NULL, revision INTEGER NOT NULL,
 phase TEXT NOT NULL CHECK(phase IN ('homework','night','morning')), recipient_id TEXT NOT NULL REFERENCES users(id),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','cancelled')),
 attempts INTEGER NOT NULL DEFAULT 0, lease_until INTEGER NOT NULL DEFAULT 0, last_reason TEXT, created_at TEXT NOT NULL, delivered_at TEXT,
 UNIQUE(household_id,child_id,school_day,revision,phase,recipient_id),
 FOREIGN KEY(household_id,child_id,school_day,revision) REFERENCES learning_school_versions(household_id,child_id,school_day,revision)
);
CREATE TRIGGER learning_school_version_scope BEFORE INSERT ON learning_school_versions
WHEN NOT EXISTS(SELECT 1 FROM children WHERE id=NEW.child_id AND household_id=NEW.household_id)
BEGIN
 SELECT RAISE(ABORT,'school child scope mismatch');
END;
CREATE TRIGGER learning_school_version_no_update BEFORE UPDATE ON learning_school_versions
BEGIN
 SELECT RAISE(ABORT,'confirmed versions are immutable');
END;
CREATE TRIGGER learning_school_version_no_delete BEFORE DELETE ON learning_school_versions
BEGIN
 SELECT RAISE(ABORT,'confirmed versions are immutable');
END;
INSERT INTO apps(id,name,icon,path,enabled,status,position,access_mode)
VALUES('school-prep','学校じゅんび','🎒','/apps/school-prep/',1,'ready',13,'group');
INSERT INTO group_apps(group_id,app_id) SELECT id,'school-prep' FROM groups WHERE kind='household';
