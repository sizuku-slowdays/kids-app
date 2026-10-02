-- No legacy balances are initialized by deployment. Activation requires reconciled migration.
CREATE TABLE passbook_activation (
 household_id TEXT PRIMARY KEY REFERENCES groups(id),
 activated_at INTEGER NOT NULL, activated_by TEXT NOT NULL REFERENCES users(id),
 backup_key TEXT NOT NULL
);
CREATE TABLE passbook_rewards (
 id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES groups(id),
 unit_id TEXT NOT NULL, name TEXT NOT NULL,
 cost INTEGER NOT NULL CHECK(typeof(cost)='integer' AND cost>0),
 stock INTEGER CHECK(stock IS NULL OR (typeof(stock)='integer' AND stock>=0)),
 enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
 UNIQUE(id,household_id),
 FOREIGN KEY(unit_id,household_id) REFERENCES passbook_units(id,household_id)
);
CREATE TABLE passbook_requests (
 id TEXT PRIMARY KEY, household_id TEXT NOT NULL, account_id TEXT NOT NULL,
 reward_id TEXT NOT NULL, reward_name TEXT NOT NULL,
 cost INTEGER NOT NULL CHECK(typeof(cost)='integer' AND cost>0),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 requested_by TEXT NOT NULL REFERENCES users(id), requested_at INTEGER NOT NULL,
 resolved_by TEXT REFERENCES users(id), resolved_at INTEGER,
 FOREIGN KEY(account_id,household_id) REFERENCES passbook_accounts(id,household_id),
 FOREIGN KEY(reward_id,household_id) REFERENCES passbook_rewards(id,household_id)
);
CREATE UNIQUE INDEX passbook_pending_reward ON passbook_requests(account_id,reward_id) WHERE status='pending';
CREATE TRIGGER passbook_request_validate BEFORE INSERT ON passbook_requests
BEGIN
 SELECT RAISE(ABORT,'invalid reward') WHERE NOT EXISTS(
 SELECT 1 FROM passbook_rewards r JOIN passbook_accounts a ON a.unit_id=r.unit_id
 WHERE r.id=NEW.reward_id AND a.id=NEW.account_id AND r.household_id=NEW.household_id
 AND r.enabled=1 AND r.name=NEW.reward_name AND r.cost=NEW.cost AND (r.stock IS NULL OR r.stock>0));
 SELECT RAISE(ABORT,'insufficient points') WHERE NEW.cost>(
 COALESCE((SELECT SUM(delta) FROM passbook_entries WHERE account_id=NEW.account_id),0)
 -COALESCE((SELECT SUM(cost) FROM passbook_requests WHERE account_id=NEW.account_id AND status='pending'),0));
END;
CREATE TRIGGER passbook_request_finalize BEFORE UPDATE ON passbook_requests
BEGIN
 SELECT RAISE(ABORT,'request already resolved') WHERE OLD.status<>'pending';
 SELECT RAISE(ABORT,'invalid resolution') WHERE NEW.status NOT IN ('approved','rejected') OR NEW.resolved_by IS NULL OR NEW.resolved_at IS NULL;
 SELECT RAISE(ABORT,'immutable request') WHERE NEW.account_id<>OLD.account_id OR NEW.household_id<>OLD.household_id OR NEW.reward_id<>OLD.reward_id OR NEW.cost<>OLD.cost OR NEW.reward_name<>OLD.reward_name OR NEW.requested_by<>OLD.requested_by OR NEW.requested_at<>OLD.requested_at OR NEW.id<>OLD.id;
 SELECT RAISE(ABORT,'reward unavailable') WHERE NEW.status='approved' AND NOT EXISTS(SELECT 1 FROM passbook_rewards WHERE id=OLD.reward_id AND enabled=1 AND (stock IS NULL OR stock>0));
 SELECT RAISE(ABORT,'insufficient points') WHERE NEW.status='approved' AND OLD.cost>COALESCE((SELECT SUM(delta) FROM passbook_entries WHERE account_id=OLD.account_id),0);
END;
CREATE TRIGGER passbook_request_credit AFTER UPDATE ON passbook_requests WHEN NEW.status='approved'
BEGIN
 UPDATE passbook_rewards SET stock=stock-1 WHERE id=NEW.reward_id AND stock IS NOT NULL;
 INSERT INTO passbook_entries(id,account_id,household_id,delta,memo,occurred_at,created_at,created_by,source_app,source_event)
 VALUES ('reward:'||NEW.id,NEW.account_id,NEW.household_id,-NEW.cost,NEW.reward_name,strftime('%Y-%m-%dT%H:%M:%SZ',NEW.resolved_at,'unixepoch'),NEW.resolved_at,NEW.resolved_by,'reward',NEW.id);
END;
CREATE TRIGGER passbook_account_immutable BEFORE UPDATE ON passbook_accounts
BEGIN
 SELECT RAISE(ABORT,'account is immutable');
END;
