-- PREPARATION ONLY. Outside Wrangler migrations; do not apply to production.
-- Number/reconcile this file only after PR #4 (0018) and PR #5 (0019) are reviewed.
PRAGMA foreign_keys=ON;
CREATE TABLE learning_english_profiles (
 household_id TEXT NOT NULL REFERENCES groups(id), user_id TEXT NOT NULL REFERENCES users(id),
 level TEXT NOT NULL CHECK(level IN ('alphabet','words')), daily_count INTEGER NOT NULL CHECK(daily_count BETWEEN 1 AND 10),
 changed_by TEXT NOT NULL REFERENCES users(id), updated_at TEXT NOT NULL,
 PRIMARY KEY(household_id,user_id)
);
CREATE TABLE learning_english_days (
 household_id TEXT NOT NULL, user_id TEXT NOT NULL, study_day TEXT NOT NULL,
 catalog_version TEXT NOT NULL, items_json TEXT NOT NULL CHECK(json_valid(items_json)), created_at TEXT NOT NULL,
 PRIMARY KEY(household_id,user_id,study_day),
 FOREIGN KEY(household_id,user_id) REFERENCES learning_english_profiles(household_id,user_id)
);
CREATE TABLE learning_english_events (
 household_id TEXT NOT NULL, user_id TEXT NOT NULL, study_day TEXT NOT NULL, item_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('remember','review')), created_at TEXT NOT NULL,
 PRIMARY KEY(household_id,user_id,study_day,item_id,kind),
 FOREIGN KEY(household_id,user_id) REFERENCES learning_english_profiles(household_id,user_id)
);
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
-- Provider/model, school-day/rank/point policy and recipient policy are deliberately unset.
CREATE TABLE learning_school_extraction_drafts (
 id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES groups(id), child_id TEXT NOT NULL REFERENCES children(id),
 source_file_id TEXT NOT NULL REFERENCES private_files(id), source_hash TEXT NOT NULL,
 result_json TEXT NOT NULL CHECK(json_valid(result_json)),
 status TEXT NOT NULL DEFAULT 'review' CHECK(status IN ('review','confirmed','discarded')),
 provider_version TEXT NOT NULL, requested_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL,
 UNIQUE(household_id,child_id,source_hash,provider_version)
);
CREATE TABLE learning_school_policies (
 household_id TEXT PRIMARY KEY REFERENCES groups(id),
 policy_json TEXT CHECK(policy_json IS NULL OR json_valid(policy_json)),
 notification_enabled INTEGER NOT NULL DEFAULT 0 CHECK(notification_enabled IN (0,1)),
 rewards_enabled INTEGER NOT NULL DEFAULT 0 CHECK(rewards_enabled IN (0,1))
);
-- No sender/credit consumer is installed in this preparation. No scheduled handler.
CREATE TABLE learning_school_outbox (
 id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES groups(id), child_id TEXT NOT NULL REFERENCES children(id),
 school_day TEXT NOT NULL, revision INTEGER NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('notification','reward')),
 source_key TEXT NOT NULL UNIQUE, payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
 state TEXT NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','ready','sent','cancelled')),
 created_at TEXT NOT NULL, delivered_at TEXT,
 FOREIGN KEY(household_id,child_id,school_day,revision) REFERENCES learning_school_versions(household_id,child_id,school_day,revision)
);
