CREATE TABLE IF NOT EXISTS home_calendar_acl (
 calendar_id TEXT PRIMARY KEY, owner_home_id TEXT NOT NULL, household_id TEXT NOT NULL,
 mode TEXT NOT NULL CHECK(mode IN ('all','household','members','self')),
 members_json TEXT NOT NULL CHECK(json_valid(members_json)), editors_json TEXT NOT NULL CHECK(json_valid(editors_json)),
 revision INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS home_calendar_participation (
 calendar_id TEXT NOT NULL, group_id TEXT NOT NULL, offered_by TEXT NOT NULL,
 accepted_by TEXT, accepted_at TEXT, revoked_at TEXT, PRIMARY KEY(calendar_id,group_id)
);
CREATE TABLE IF NOT EXISTS home_event_visibility (
 event_id TEXT PRIMARY KEY, owner_home_id TEXT NOT NULL,
 audience TEXT NOT NULL CHECK(audience IN ('inherit','adults','members','self')),
 members_json TEXT NOT NULL CHECK(json_valid(members_json)), subject_user_id TEXT,
 updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS home_calendar_policy_backups (
 id TEXT PRIMARY KEY, calendar_id TEXT NOT NULL, actor_home_id TEXT NOT NULL,
 calendar_json TEXT NOT NULL, events_json TEXT NOT NULL, policies_json TEXT NOT NULL,
 calendar_count INTEGER NOT NULL, event_count INTEGER NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS home_calendar_notification_locks (
 calendar_id TEXT PRIMARY KEY, token TEXT NOT NULL, created_at TEXT NOT NULL
);
