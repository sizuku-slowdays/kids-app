-- Optional additive schema, development only. Existing rules/logs/subscriptions unchanged.
CREATE TABLE IF NOT EXISTS budget_notification_sources (
 source_id TEXT PRIMARY KEY,
 version INTEGER NOT NULL,
 job_token TEXT NOT NULL,
 rule_id INTEGER UNIQUE
);
