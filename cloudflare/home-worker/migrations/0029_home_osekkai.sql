CREATE TABLE home_osekkai_rules (
 id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES groups(id),
 recipient_id TEXT NOT NULL REFERENCES users(id),
 target TEXT NOT NULL, character TEXT NOT NULL, time TEXT NOT NULL,
 weekdays TEXT NOT NULL CHECK(json_valid(weekdays)),
 interval_min INTEGER NOT NULL CHECK(interval_min BETWEEN 10 AND 120),
 retries INTEGER NOT NULL CHECK(retries BETWEEN 0 AND 3),
 intensity INTEGER NOT NULL CHECK(intensity BETWEEN 0 AND 2),
 enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),
 confirmation TEXT NOT NULL, challenge TEXT NOT NULL DEFAULT '',
 guardian_id TEXT REFERENCES users(id),
 deleted INTEGER NOT NULL DEFAULT 0 CHECK(deleted IN (0,1))
);
CREATE INDEX home_osekkai_rules_target ON home_osekkai_rules(recipient_id, household_id);
CREATE UNIQUE INDEX home_osekkai_one_medication ON home_osekkai_rules(recipient_id)
 WHERE confirmation='medication' AND deleted=0;
CREATE TABLE home_osekkai_events (
 id TEXT PRIMARY KEY, rule_id TEXT NOT NULL REFERENCES home_osekkai_rules(id),
 day TEXT NOT NULL, target TEXT NOT NULL, character TEXT NOT NULL,
 confirmation TEXT NOT NULL, challenge TEXT NOT NULL DEFAULT '',
 is_test INTEGER NOT NULL DEFAULT 0 CHECK(is_test IN (0,1)),
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','done','declined')),
 next_at INTEGER, guardian_at INTEGER, responded_at INTEGER NOT NULL DEFAULT 0, sequence INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX home_osekkai_daily_event ON home_osekkai_events(rule_id,day) WHERE is_test=0;
CREATE INDEX home_osekkai_due ON home_osekkai_events(day,next_at) WHERE status='open';
CREATE TABLE home_osekkai_push (
 id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES home_osekkai_events(id),
 recipient_id TEXT NOT NULL REFERENCES users(id),
 bucket INTEGER NOT NULL, day TEXT NOT NULL, created_at INTEGER NOT NULL,
 delivered INTEGER, for_guardian INTEGER NOT NULL DEFAULT 0 CHECK(for_guardian IN (0,1)), UNIQUE(recipient_id,bucket)
);
CREATE INDEX home_osekkai_push_daily ON home_osekkai_push(recipient_id,day);
CREATE INDEX home_osekkai_guardian_due ON home_osekkai_events(day,guardian_at) WHERE status='open';
