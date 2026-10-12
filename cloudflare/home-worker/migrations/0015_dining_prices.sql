CREATE TABLE dining_price_states (
 household_id TEXT PRIMARY KEY REFERENCES groups(id),
 stores_json TEXT NOT NULL CHECK(json_valid(stores_json)),
 revision INTEGER NOT NULL DEFAULT 1,
 updated_by TEXT NOT NULL REFERENCES users(id),
 updated_at TEXT NOT NULL
);
INSERT INTO apps(id,name,icon,path,enabled,status,position,access_mode)
VALUES('dining-prices','外食料金','🍽️','/apps/dining-prices/',1,'ready',10,'group');
INSERT INTO group_apps(group_id,app_id)
SELECT id,'dining-prices' FROM groups WHERE kind='household';
