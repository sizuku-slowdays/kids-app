ALTER TABLE apps ADD COLUMN access_mode TEXT NOT NULL DEFAULT 'group' CHECK(access_mode IN ('group','personal'));
CREATE TABLE personal_app_access (
 user_id TEXT NOT NULL REFERENCES users(id),
 app_id TEXT NOT NULL REFERENCES apps(id),
 PRIMARY KEY(user_id,app_id)
);
INSERT INTO apps(id,name,icon,path,enabled,status,position,access_mode)
 VALUES('muscle-bank','筋肉貯金','💪','/apps/muscle-bank/',1,'ready',0,'personal');
-- The first registered account is the already-existing mother's account; role or display name alone grants nothing.
INSERT INTO personal_app_access(user_id,app_id)
 SELECT id,'muscle-bank' FROM users WHERE id='bootstrap-admin';
CREATE TABLE muscle_bank_states (
 owner_id TEXT PRIMARY KEY REFERENCES users(id),
 revision INTEGER NOT NULL,
 state_json TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
