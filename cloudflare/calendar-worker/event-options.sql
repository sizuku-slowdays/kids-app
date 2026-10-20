-- Reference only. calendar-worker creates this idempotently with the existing ACL tables.
-- Do not run separately before the verified pre-deployment backups.
CREATE TABLE IF NOT EXISTS home_event_options (
 event_id TEXT PRIMARY KEY REFERENCES calendar_events(id) ON DELETE CASCADE,
 notify_befores_json TEXT NOT NULL CHECK(json_valid(notify_befores_json)),
 subject_user_ids_json TEXT NOT NULL CHECK(json_valid(subject_user_ids_json)),
 updated_at TEXT NOT NULL
);
