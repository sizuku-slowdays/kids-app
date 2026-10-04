INSERT INTO apps(id,name,icon,path,enabled,status,position,access_mode) VALUES('kidney','食べる前チェック','🍴','/apps/kidney/',1,'ready',7,'group');
INSERT OR IGNORE INTO group_apps(group_id,app_id) SELECT id,'kidney' FROM groups WHERE kind='household';
CREATE TABLE kidney_settings (
 household_id TEXT PRIMARY KEY REFERENCES groups(id),
 settings_json TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1,
 updated_by TEXT NOT NULL REFERENCES users(id),
 updated_at TEXT NOT NULL
);
CREATE TABLE kidney_meals (
 id TEXT PRIMARY KEY,
 household_id TEXT NOT NULL REFERENCES groups(id),
 day TEXT NOT NULL,
 meal TEXT NOT NULL,
 items_json TEXT NOT NULL,
 created_by TEXT NOT NULL REFERENCES users(id),
 updated_by TEXT NOT NULL REFERENCES users(id),
 revision INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX kidney_meals_day ON kidney_meals(household_id,day,created_at);
-- Launcher only: the existing calendar keeps its own login and saved data.
UPDATE apps SET status='ready',path='/apps/calendar' WHERE id='calendar';
