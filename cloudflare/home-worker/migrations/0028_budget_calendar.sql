-- Development only: no grants, balances, legacy edits or notification deliveries.
CREATE TABLE budget_calendar_outbox (
 source_id TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL REFERENCES users(id),
 event_key TEXT NOT NULL,
 version INTEGER NOT NULL,
 payload_json TEXT CHECK(payload_json IS NULL OR json_valid(payload_json)),
 job_token TEXT NOT NULL UNIQUE,
 synced_version INTEGER NOT NULL DEFAULT 0,
 UNIQUE(owner_id,event_key)
);
CREATE INDEX budget_calendar_pending ON budget_calendar_outbox(synced_version,version);
