CREATE TABLE dining_price_imports (
 household_id TEXT NOT NULL REFERENCES groups(id), source_id TEXT NOT NULL,
 created_at TEXT NOT NULL, PRIMARY KEY(household_id,source_id)
);
CREATE TABLE dining_price_backups (
 id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES groups(id),
 revision INTEGER NOT NULL, stores_json TEXT NOT NULL CHECK(json_valid(stores_json)), created_at TEXT NOT NULL
);
