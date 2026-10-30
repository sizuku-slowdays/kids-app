-- Additive. No existing period users, records, requests or inventory are modified.
CREATE TABLE home_karada_links (
 home_user_id TEXT PRIMARY KEY, household_id TEXT NOT NULL,
 period_user_id INTEGER NOT NULL UNIQUE REFERENCES period_users(id),
 created_by TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE home_karada_inventory (
 household_id TEXT NOT NULL,item_key TEXT NOT NULL,item_name TEXT NOT NULL,
 quantity INTEGER NOT NULL CHECK(typeof(quantity)='integer' AND quantity BETWEEN 0 AND 100000),
 low_threshold INTEGER NOT NULL DEFAULT 3,updated_at TEXT NOT NULL,
 PRIMARY KEY(household_id,item_key)
);
CREATE TABLE home_karada_operations (
 household_id TEXT NOT NULL,actor TEXT NOT NULL,event_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('records','requests')),body_hash TEXT NOT NULL,
 result_id INTEGER NOT NULL,created_at TEXT NOT NULL,
 PRIMARY KEY(household_id,actor,event_id), UNIQUE(kind,result_id)
);
CREATE TABLE home_karada_changes (
 id TEXT PRIMARY KEY,household_id TEXT NOT NULL,actor TEXT NOT NULL,
 action TEXT NOT NULL,target TEXT NOT NULL,created_at TEXT NOT NULL
);
CREATE TABLE home_karada_link_attempts (
 actor TEXT NOT NULL,bucket INTEGER NOT NULL,count INTEGER NOT NULL,
 PRIMARY KEY(actor,bucket)
);
CREATE TABLE home_karada_record_trash (
 record_id INTEGER PRIMARY KEY,household_id TEXT NOT NULL,period_user_id INTEGER NOT NULL,
 original_json TEXT NOT NULL,deleted_by TEXT NOT NULL,deleted_at TEXT NOT NULL
);
CREATE TRIGGER home_karada_link_immutable BEFORE UPDATE ON home_karada_links BEGIN SELECT RAISE(ABORT,'body link immutable'); END;
CREATE TRIGGER home_karada_link_no_delete BEFORE DELETE ON home_karada_links BEGIN SELECT RAISE(ABORT,'body link immutable'); END;
CREATE TRIGGER home_karada_operation_immutable BEFORE UPDATE ON home_karada_operations BEGIN SELECT RAISE(ABORT,'body operation immutable'); END;
CREATE TRIGGER home_karada_operation_no_delete BEFORE DELETE ON home_karada_operations BEGIN SELECT RAISE(ABORT,'body operation immutable'); END;
CREATE TRIGGER home_karada_changes_immutable BEFORE UPDATE ON home_karada_changes BEGIN SELECT RAISE(ABORT,'body audit immutable'); END;
CREATE TRIGGER home_karada_changes_no_delete BEFORE DELETE ON home_karada_changes BEGIN SELECT RAISE(ABORT,'body audit immutable'); END;
