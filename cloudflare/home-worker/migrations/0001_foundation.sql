PRAGMA foreign_keys=ON;
CREATE TABLE users (
 id TEXT PRIMARY KEY, login_name TEXT NOT NULL UNIQUE COLLATE NOCASE,
 display_name TEXT NOT NULL, password_salt TEXT NOT NULL, password_hash TEXT NOT NULL,
 password_iterations INTEGER NOT NULL, platform_role TEXT NOT NULL DEFAULT 'user' CHECK(platform_role IN ('operator','user')),
 active INTEGER NOT NULL DEFAULT 1, invitation_id TEXT UNIQUE,
 created_at INTEGER NOT NULL
);
CREATE TABLE groups (
 id TEXT PRIMARY KEY, name TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('household','sharing')),
 created_by TEXT NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL
);
CREATE TABLE memberships (
 group_id TEXT NOT NULL REFERENCES groups(id), user_id TEXT NOT NULL REFERENCES users(id),
 role TEXT NOT NULL CHECK(role IN ('owner','admin','member')), PRIMARY KEY(group_id,user_id)
);
CREATE TABLE children (
 id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES groups(id),
 display_name TEXT NOT NULL, user_id TEXT UNIQUE REFERENCES users(id)
);
CREATE TABLE apps (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, icon TEXT NOT NULL, path TEXT,
 enabled INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','ready')),
 position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE group_apps (
 group_id TEXT NOT NULL REFERENCES groups(id), app_id TEXT NOT NULL REFERENCES apps(id),
 PRIMARY KEY(group_id,app_id)
);
CREATE TABLE user_apps (
 user_id TEXT NOT NULL REFERENCES users(id), app_id TEXT NOT NULL REFERENCES apps(id),
 visible INTEGER NOT NULL DEFAULT 1, position INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(user_id,app_id)
);
CREATE TABLE invitations (
 id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE,
 issued_by TEXT NOT NULL REFERENCES users(id), group_id TEXT NOT NULL REFERENCES groups(id),
 expires_at INTEGER NOT NULL, consumed_by TEXT REFERENCES users(id), revoked_at INTEGER,
 child_id TEXT REFERENCES children(id),
 created_at INTEGER NOT NULL
);
CREATE TABLE sessions (
 id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL REFERENCES users(id),
 device_name TEXT NOT NULL, created_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL, revoked_at INTEGER
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE resources (
 id TEXT PRIMARY KEY, app_id TEXT NOT NULL REFERENCES apps(id),
 owner_user_id TEXT REFERENCES users(id), owner_group_id TEXT REFERENCES groups(id),
 kind TEXT NOT NULL, title TEXT NOT NULL,
 CHECK((owner_user_id IS NULL) <> (owner_group_id IS NULL))
);
CREATE TABLE resource_grants (
 id TEXT PRIMARY KEY, resource_id TEXT NOT NULL REFERENCES resources(id),
 target_user_id TEXT REFERENCES users(id), target_group_id TEXT REFERENCES groups(id),
 permission TEXT NOT NULL CHECK(permission IN ('read','write')),
 offered_by TEXT NOT NULL REFERENCES users(id), accepted_by TEXT REFERENCES users(id),
 accepted_at INTEGER, revoked_at INTEGER,
 CHECK((target_user_id IS NULL) <> (target_group_id IS NULL))
);
CREATE INDEX grants_resource ON resource_grants(resource_id);
CREATE TABLE private_files (
 id TEXT PRIMARY KEY, resource_id TEXT NOT NULL REFERENCES resources(id),
 object_key TEXT NOT NULL UNIQUE, content_type TEXT NOT NULL, filename TEXT NOT NULL
);
CREATE TABLE timetables (
 child_id TEXT NOT NULL REFERENCES children(id), week_start TEXT NOT NULL,
 file_id TEXT NOT NULL REFERENCES private_files(id), PRIMARY KEY(child_id,week_start)
);
CREATE TABLE legacy_links (
 user_id TEXT NOT NULL REFERENCES users(id), provider TEXT NOT NULL, legacy_id TEXT NOT NULL,
 PRIMARY KEY(provider,legacy_id)
);
CREATE TABLE auth_attempts (bucket TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at INTEGER NOT NULL);
INSERT INTO apps(id,name,icon,position) VALUES
 ('calendar','カレンダー','📅',1),('notification','通知','🔔',2),
 ('passbook','つうちょう','📒',3),('album','アルバム','🖼️',4),
 ('timetable','時間割','🎒',5),('learning','けいさん・ことば','✏️',6);
