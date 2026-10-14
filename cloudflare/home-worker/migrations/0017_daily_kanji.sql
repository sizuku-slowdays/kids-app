CREATE TABLE kanji_school_profiles (
 user_id TEXT PRIMARY KEY REFERENCES users(id),
 household_id TEXT NOT NULL REFERENCES groups(id),
 base_grade INTEGER NOT NULL CHECK(base_grade BETWEEN 1 AND 9),
 base_school_year INTEGER NOT NULL,
 auto_advance INTEGER NOT NULL DEFAULT 1 CHECK(auto_advance IN (0,1)),
 changed_by TEXT NOT NULL REFERENCES users(id), updated_at TEXT NOT NULL
);
CREATE TABLE kanji_daily_sets (
 user_id TEXT NOT NULL REFERENCES users(id), study_day TEXT NOT NULL,
 grade INTEGER NOT NULL, curriculum_version TEXT NOT NULL,
 characters_json TEXT NOT NULL CHECK(json_valid(characters_json)),
 created_at TEXT NOT NULL, PRIMARY KEY(user_id,study_day)
);
CREATE TABLE kanji_mastery (
 user_id TEXT NOT NULL REFERENCES users(id), character TEXT NOT NULL,
 first_learned_day TEXT NOT NULL, last_confirmed_day TEXT NOT NULL,
 confirmations INTEGER NOT NULL DEFAULT 1,
 PRIMARY KEY(user_id,character)
);
CREATE TABLE kanji_learning_events (
 user_id TEXT NOT NULL REFERENCES users(id), study_day TEXT NOT NULL,
 character TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('daily_confirm','review')),
 created_at TEXT NOT NULL, PRIMARY KEY(user_id,study_day,character,kind)
);
INSERT INTO apps(id,name,icon,path,enabled,status,position,access_mode)
VALUES('daily-kanji','まいにち漢字3文字','🌱','/apps/daily-kanji/',1,'ready',11,'group');
INSERT INTO group_apps(group_id,app_id)
SELECT id,'daily-kanji' FROM groups WHERE kind='household';
