-- Additive only. No existing ledger, balance, reward, profile or subscription is rewritten.
CREATE VIEW passbook_gift_guardians AS
 SELECT m.group_id household_id,m.user_id FROM memberships m
 JOIN users u ON u.id=m.user_id AND u.active=1
 JOIN groups g ON g.id=m.group_id AND g.kind='household'
 JOIN group_apps ga ON ga.group_id=m.group_id AND ga.app_id='passbook'
 JOIN apps app ON app.id=ga.app_id AND app.enabled=1
 LEFT JOIN home_member_attributes a ON a.group_id=m.group_id AND a.user_id=m.user_id
 WHERE m.role IN ('owner','admin') AND COALESCE(a.age_kind,'unknown')!='child'
 AND NOT EXISTS(SELECT 1 FROM children c WHERE c.household_id=m.group_id AND c.user_id=m.user_id);
CREATE VIEW passbook_gift_senders AS
 SELECT m.group_id household_id,m.user_id FROM memberships m
 JOIN users u ON u.id=m.user_id AND u.active=1
 JOIN groups g ON g.id=m.group_id AND g.kind='household'
 LEFT JOIN home_member_attributes a ON a.group_id=m.group_id AND a.user_id=m.user_id
 WHERE a.age_kind='adult' AND NOT EXISTS(SELECT 1 FROM children c WHERE c.household_id=m.group_id AND c.user_id=m.user_id)
 UNION SELECT household_id,user_id FROM passbook_gift_guardians;
CREATE TABLE passbook_gift_permissions (
 household_id TEXT NOT NULL REFERENCES groups(id), child_id TEXT NOT NULL REFERENCES children(id),
 sender_id TEXT NOT NULL REFERENCES users(id), enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),
 changed_by TEXT NOT NULL REFERENCES users(id), updated_at INTEGER NOT NULL,
 PRIMARY KEY(household_id,child_id,sender_id)
);
CREATE TABLE passbook_gift_requests (
 id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES groups(id), child_id TEXT NOT NULL REFERENCES children(id),
 account_id TEXT NOT NULL, sender_id TEXT NOT NULL REFERENCES users(id), sender_name TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('points','cash')), destination TEXT NOT NULL CHECK(destination IN ('points','bank','wallet')),
 amount INTEGER NOT NULL CHECK(typeof(amount)='integer' AND amount BETWEEN 1 AND 10000000),
 reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 1 AND 500),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 event_id TEXT NOT NULL, requested_at INTEGER NOT NULL,
 resolved_by TEXT REFERENCES users(id), resolved_at INTEGER,
 UNIQUE(household_id,sender_id,event_id), UNIQUE(id,household_id),
 FOREIGN KEY(account_id,household_id) REFERENCES passbook_accounts(id,household_id)
);
CREATE INDEX passbook_gift_queue ON passbook_gift_requests(household_id,status,requested_at,id);
CREATE TABLE passbook_gift_notifications (
 id TEXT PRIMARY KEY, gift_id TEXT NOT NULL, household_id TEXT NOT NULL,
 recipient_id TEXT NOT NULL REFERENCES users(id), status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','cancelled')),
 created_at INTEGER NOT NULL, lease_until INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0,
 last_reason TEXT, delivered_at INTEGER, UNIQUE(gift_id,recipient_id),
 FOREIGN KEY(gift_id,household_id) REFERENCES passbook_gift_requests(id,household_id)
);
CREATE TRIGGER passbook_gift_permission_validate BEFORE INSERT ON passbook_gift_permissions
BEGIN
 SELECT RAISE(ABORT,'gift permission denied') WHERE NOT EXISTS(SELECT 1 FROM passbook_gift_guardians WHERE household_id=NEW.household_id AND user_id=NEW.changed_by)
 OR NOT EXISTS(SELECT 1 FROM children WHERE id=NEW.child_id AND household_id=NEW.household_id)
 OR NOT EXISTS(SELECT 1 FROM passbook_gift_senders WHERE household_id=NEW.household_id AND user_id=NEW.sender_id);
END;
CREATE TRIGGER passbook_gift_permission_update BEFORE UPDATE ON passbook_gift_permissions
BEGIN
 SELECT RAISE(ABORT,'gift permission denied') WHERE NEW.household_id<>OLD.household_id OR NEW.child_id<>OLD.child_id OR NEW.sender_id<>OLD.sender_id
 OR NOT EXISTS(SELECT 1 FROM passbook_gift_guardians WHERE household_id=NEW.household_id AND user_id=NEW.changed_by);
END;
CREATE TRIGGER passbook_gift_validate BEFORE INSERT ON passbook_gift_requests
BEGIN
 SELECT RAISE(ABORT,'gift sender denied') WHERE NOT EXISTS(SELECT 1 FROM passbook_gift_senders WHERE household_id=NEW.household_id AND user_id=NEW.sender_id)
 OR EXISTS(SELECT 1 FROM passbook_gift_permissions WHERE household_id=NEW.household_id AND child_id=NEW.child_id AND sender_id=NEW.sender_id AND enabled=0)
 OR NEW.sender_name IS NOT (SELECT display_name FROM users WHERE id=NEW.sender_id);
 SELECT RAISE(ABORT,'gift target denied') WHERE NOT EXISTS(
 SELECT 1 FROM passbook_accounts a JOIN children c ON c.id=a.child_id AND c.household_id=a.household_id
 JOIN users usr ON usr.id=c.user_id AND usr.active=1 JOIN memberships m ON m.group_id=c.household_id AND m.user_id=c.user_id
 JOIN passbook_units u ON u.id=a.unit_id AND u.household_id=a.household_id AND u.active=1
 JOIN passbook_activation act ON act.household_id=a.household_id
 WHERE a.id=NEW.account_id AND a.household_id=NEW.household_id AND c.id=NEW.child_id
 AND ((NEW.kind='cash' AND NEW.destination='bank' AND u.code='cash' AND u.kind='money') OR (NEW.kind='points' AND NEW.destination='points' AND u.code='chores' AND u.kind='points')));
 SELECT RAISE(ABORT,'gift approver missing') WHERE NOT EXISTS(SELECT 1 FROM passbook_gift_guardians WHERE household_id=NEW.household_id AND user_id<>NEW.sender_id);
 SELECT RAISE(ABORT,'gift initial state invalid') WHERE NEW.status<>'pending' OR NEW.resolved_by IS NOT NULL OR NEW.resolved_at IS NOT NULL;
END;
CREATE TRIGGER passbook_gift_enqueue AFTER INSERT ON passbook_gift_requests
BEGIN
 INSERT INTO passbook_gift_notifications(id,gift_id,household_id,recipient_id,created_at)
 SELECT 'gift:'||NEW.id||':'||user_id,NEW.id,NEW.household_id,user_id,NEW.requested_at FROM passbook_gift_guardians WHERE household_id=NEW.household_id AND user_id<>NEW.sender_id;
END;
CREATE TRIGGER passbook_gift_finalize BEFORE UPDATE ON passbook_gift_requests
BEGIN
 SELECT RAISE(ABORT,'gift request immutable') WHERE NEW.id<>OLD.id OR NEW.household_id<>OLD.household_id OR NEW.child_id<>OLD.child_id OR NEW.account_id<>OLD.account_id
 OR NEW.sender_id<>OLD.sender_id OR NEW.sender_name<>OLD.sender_name OR NEW.kind<>OLD.kind OR NEW.destination<>OLD.destination OR NEW.amount<>OLD.amount OR NEW.reason<>OLD.reason OR NEW.event_id<>OLD.event_id OR NEW.requested_at<>OLD.requested_at;
 SELECT RAISE(ABORT,'gift resolution denied') WHERE OLD.status<>'pending' OR NEW.status NOT IN ('approved','rejected') OR NEW.resolved_by IS NULL OR NEW.resolved_at IS NULL
 OR NEW.resolved_by=OLD.sender_id OR NOT EXISTS(SELECT 1 FROM passbook_gift_guardians WHERE household_id=OLD.household_id AND user_id=NEW.resolved_by);
 SELECT RAISE(ABORT,'gift target denied') WHERE NEW.status='approved' AND (NOT EXISTS(
 SELECT 1 FROM children c JOIN users u ON u.id=c.user_id AND u.active=1 JOIN memberships m ON m.group_id=c.household_id AND m.user_id=c.user_id
 WHERE c.id=OLD.child_id AND c.household_id=OLD.household_id)
 OR NOT EXISTS(SELECT 1 FROM passbook_gift_senders WHERE household_id=OLD.household_id AND user_id=OLD.sender_id)
 OR EXISTS(SELECT 1 FROM passbook_gift_permissions WHERE household_id=OLD.household_id AND child_id=OLD.child_id AND sender_id=OLD.sender_id AND enabled=0)
 OR NOT EXISTS(SELECT 1 FROM passbook_accounts a JOIN passbook_units u ON u.id=a.unit_id AND u.household_id=a.household_id WHERE a.id=OLD.account_id AND a.household_id=OLD.household_id AND u.active=1 AND ((OLD.kind='cash' AND OLD.destination='bank' AND u.code='cash' AND u.kind='money') OR (OLD.kind='points' AND OLD.destination='points' AND u.code='chores' AND u.kind='points'))));
 SELECT RAISE(ABORT,'gift balance limit') WHERE NEW.status='approved' AND COALESCE((SELECT SUM(delta) FROM passbook_entries WHERE account_id=OLD.account_id),0)>9007199254740991-OLD.amount;
END;
CREATE TRIGGER passbook_gift_credit AFTER UPDATE ON passbook_gift_requests WHEN NEW.status='approved'
BEGIN
 INSERT INTO passbook_entries(id,account_id,household_id,delta,memo,occurred_at,created_at,created_by,source_app,source_event)
 VALUES('gift:'||NEW.id,NEW.account_id,NEW.household_id,NEW.amount,'🎁 '||NEW.sender_name||'からのプレゼント：'||NEW.reason,strftime('%Y-%m-%dT%H:%M:%SZ',NEW.resolved_at,'unixepoch'),NEW.resolved_at,NEW.resolved_by,'gift',NEW.id);
END;
CREATE TRIGGER passbook_gift_no_delete BEFORE DELETE ON passbook_gift_requests
BEGIN
 SELECT RAISE(ABORT,'gift history is retained');
END;
