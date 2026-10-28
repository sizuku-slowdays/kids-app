-- Additive only. Existing day records, financial rows and triggers remain unchanged.
CREATE TABLE passbook_chore_records (
 id TEXT PRIMARY KEY, household_id TEXT NOT NULL, event_id TEXT NOT NULL,
 chore_id TEXT NOT NULL, day TEXT NOT NULL, targets_json TEXT NOT NULL CHECK(json_valid(targets_json)),
 count INTEGER NOT NULL CHECK(typeof(count)='integer' AND count BETWEEN 1 AND 100),
 points INTEGER NOT NULL CHECK(typeof(points)='integer' AND points BETWEEN 0 AND 10000000 AND points*count<=10000000),
 money INTEGER NOT NULL CHECK(typeof(money)='integer' AND money BETWEEN 0 AND 10000000 AND money*count<=10000000),
 point_unit_id TEXT NOT NULL, memo TEXT NOT NULL, revision INTEGER NOT NULL,
 actor TEXT NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL, error TEXT,
 UNIQUE(household_id,event_id), UNIQUE(id,household_id),
 FOREIGN KEY(chore_id,household_id) REFERENCES passbook_chores(id,household_id),
 FOREIGN KEY(point_unit_id,household_id) REFERENCES passbook_units(id,household_id)
);
CREATE INDEX passbook_chore_records_day ON passbook_chore_records(household_id,day,created_at);
CREATE TABLE passbook_chore_record_payments (
 record_id TEXT PRIMARY KEY, household_id TEXT NOT NULL,
 actor TEXT NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL,
 FOREIGN KEY(record_id,household_id) REFERENCES passbook_chore_records(id,household_id)
);
CREATE TRIGGER passbook_chore_record_validate BEFORE INSERT ON passbook_chore_records
BEGIN
 SELECT RAISE(ABORT,'chore record forbidden') WHERE NOT EXISTS(SELECT 1 FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.group_id=NEW.household_id AND m.user_id=NEW.actor AND m.role IN ('owner','admin') AND u.active=1);
 SELECT RAISE(ABORT,'chore record event reused') WHERE EXISTS(SELECT 1 FROM passbook_chore_days WHERE household_id=NEW.household_id AND event_id=NEW.event_id) OR EXISTS(SELECT 1 FROM passbook_chore_attempts WHERE household_id=NEW.household_id AND event_id=NEW.event_id);
 SELECT RAISE(ABORT,'chore record date invalid') WHERE length(NEW.day)<>10 OR NEW.day NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' OR date(NEW.day,'+0 days') IS NOT NEW.day OR NEW.day>date('now','+9 hours');
 SELECT RAISE(ABORT,'chore record changed') WHERE NOT EXISTS(SELECT 1 FROM passbook_chores c JOIN passbook_units u ON u.id=c.point_unit_id AND u.household_id=c.household_id WHERE c.id=NEW.chore_id AND c.household_id=NEW.household_id AND c.enabled=1 AND c.points=NEW.points AND c.money=NEW.money AND c.name=NEW.memo AND c.point_unit_id=NEW.point_unit_id AND u.kind='points' AND u.active=1);
 SELECT RAISE(ABORT,'chore record targets invalid') WHERE json_type(NEW.targets_json)<>'array' OR json_array_length(NEW.targets_json) NOT BETWEEN 1 AND 100 OR (SELECT COUNT(*) FROM json_each(NEW.targets_json))<>(SELECT COUNT(DISTINCT value) FROM json_each(NEW.targets_json)) OR EXISTS(SELECT 1 FROM json_each(NEW.targets_json) t WHERE t.type<>'text' OR NOT EXISTS(SELECT 1 FROM children c JOIN users u ON u.id=c.user_id JOIN memberships m ON m.user_id=u.id AND m.group_id=c.household_id WHERE c.household_id=NEW.household_id AND c.id=t.value AND u.active=1) AND NOT EXISTS(SELECT 1 FROM passbook_adult_accounts a JOIN users u ON u.id=a.owner_user_id JOIN memberships m ON m.user_id=u.id AND m.group_id=a.household_id WHERE a.household_id=NEW.household_id AND 'user:'||a.owner_user_id=t.value AND u.active=1));
END;
CREATE TRIGGER passbook_chore_record_pay_validate BEFORE INSERT ON passbook_chore_record_payments
BEGIN
 SELECT RAISE(ABORT,'chore record forbidden') WHERE NOT EXISTS(SELECT 1 FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.group_id=NEW.household_id AND m.user_id=NEW.actor AND m.role IN ('owner','admin') AND u.active=1);
 SELECT RAISE(ABORT,'chore record targets invalid') WHERE EXISTS(SELECT 1 FROM passbook_chore_records r,json_each(r.targets_json) t WHERE r.id=NEW.record_id AND NOT EXISTS(SELECT 1 FROM children c JOIN users u ON u.id=c.user_id JOIN memberships m ON m.user_id=u.id AND m.group_id=c.household_id WHERE c.household_id=NEW.household_id AND c.id=t.value AND u.active=1) AND NOT EXISTS(SELECT 1 FROM passbook_adult_accounts a JOIN users u ON u.id=a.owner_user_id JOIN memberships m ON m.user_id=u.id AND m.group_id=a.household_id WHERE a.household_id=NEW.household_id AND 'user:'||a.owner_user_id=t.value AND u.active=1));
 SELECT RAISE(ABORT,'chore points wallet missing') WHERE EXISTS(SELECT 1 FROM passbook_chore_records r,json_each(r.targets_json) t WHERE r.id=NEW.record_id AND r.points>0 AND NOT EXISTS(SELECT 1 FROM passbook_accounts a JOIN passbook_units u ON u.id=a.unit_id AND u.household_id=a.household_id WHERE a.household_id=r.household_id AND a.child_id=t.value AND a.unit_id=r.point_unit_id AND u.kind='points' AND u.active=1) AND NOT EXISTS(SELECT 1 FROM passbook_adult_accounts a JOIN passbook_units u ON u.id=a.unit_id AND u.household_id=a.household_id WHERE a.household_id=r.household_id AND 'user:'||a.owner_user_id=t.value AND a.unit_id=r.point_unit_id AND u.kind='points' AND u.active=1));
 SELECT RAISE(ABORT,'chore cash wallet missing') WHERE EXISTS(SELECT 1 FROM passbook_chore_records r,json_each(r.targets_json) t WHERE r.id=NEW.record_id AND r.money>0 AND NOT EXISTS(SELECT 1 FROM passbook_accounts a JOIN passbook_units u ON u.id=a.unit_id AND u.household_id=a.household_id WHERE a.household_id=r.household_id AND a.child_id=t.value AND u.code='cash' AND u.kind='money' AND u.active=1) AND NOT EXISTS(SELECT 1 FROM passbook_adult_accounts a JOIN passbook_units u ON u.id=a.unit_id AND u.household_id=a.household_id WHERE a.household_id=r.household_id AND 'user:'||a.owner_user_id=t.value AND u.code='cash' AND u.kind='money' AND u.active=1));
END;
CREATE TRIGGER passbook_chore_record_pay_apply AFTER INSERT ON passbook_chore_record_payments
BEGIN
 INSERT INTO passbook_entries(id,account_id,household_id,delta,memo,occurred_at,created_at,created_by,source_app,source_event)
 SELECT r.id||':'||a.id,a.id,r.household_id,CASE WHEN u.kind='money' THEN r.money ELSE r.points END*r.count,r.day||' お手伝い：'||r.memo||'（'||r.count||'回）',strftime('%Y-%m-%dT%H:%M:%SZ',NEW.created_at,'unixepoch'),NEW.created_at,NEW.actor,'chores-repeat',r.id FROM passbook_chore_records r,json_each(r.targets_json) t JOIN passbook_accounts a ON a.child_id=t.value AND a.household_id=r.household_id JOIN passbook_units u ON u.id=a.unit_id AND u.household_id=a.household_id WHERE r.id=NEW.record_id AND ((u.code='cash' AND u.kind='money' AND r.money>0) OR (u.id=r.point_unit_id AND u.kind='points' AND r.points>0));
 INSERT INTO passbook_adult_entries(id,account_id,household_id,delta,memo,occurred_at,created_at,created_by,source_app,source_event)
 SELECT r.id||':'||a.id,a.id,r.household_id,CASE WHEN u.kind='money' THEN r.money ELSE r.points END*r.count,r.day||' お手伝い：'||r.memo||'（'||r.count||'回）',strftime('%Y-%m-%dT%H:%M:%SZ',NEW.created_at,'unixepoch'),NEW.created_at,NEW.actor,'chores-repeat',r.id FROM passbook_chore_records r,json_each(r.targets_json) t JOIN passbook_adult_accounts a ON 'user:'||a.owner_user_id=t.value AND a.household_id=r.household_id JOIN passbook_units u ON u.id=a.unit_id AND u.household_id=a.household_id WHERE r.id=NEW.record_id AND ((u.code='cash' AND u.kind='money' AND r.money>0) OR (u.id=r.point_unit_id AND u.kind='points' AND r.points>0));
 -- Only the first actual completion today advances today's rotation, once per activity.
 -- Backdated work and further repetitions never alter the current day's assignment.
 UPDATE passbook_chores SET next_date=date(next_date,'+1 day'),next_target=CASE WHEN json_array_length(rotation_json)=0 THEN NULL ELSE json_extract(rotation_json,'$['||((COALESCE((SELECT CAST(key AS INTEGER) FROM json_each(rotation_json) WHERE value=next_target),-1)+1)%json_array_length(rotation_json))||']') END,revision=revision+1 WHERE id=(SELECT chore_id FROM passbook_chore_records WHERE id=NEW.record_id) AND household_id=NEW.household_id AND enabled=1 AND next_date=(SELECT day FROM passbook_chore_records WHERE id=NEW.record_id) AND next_date=date(NEW.created_at,'unixepoch','+9 hours');
 UPDATE passbook_chore_records SET error=NULL WHERE id=NEW.record_id;
END;
CREATE TRIGGER passbook_chore_record_no_edit BEFORE UPDATE ON passbook_chore_records
BEGIN
 SELECT RAISE(ABORT,'chore record immutable') WHERE NEW.id IS NOT OLD.id OR NEW.household_id IS NOT OLD.household_id OR NEW.event_id IS NOT OLD.event_id OR NEW.chore_id IS NOT OLD.chore_id OR NEW.day IS NOT OLD.day OR NEW.targets_json IS NOT OLD.targets_json OR NEW.count IS NOT OLD.count OR NEW.points IS NOT OLD.points OR NEW.money IS NOT OLD.money OR NEW.point_unit_id IS NOT OLD.point_unit_id OR NEW.memo IS NOT OLD.memo OR NEW.revision IS NOT OLD.revision OR NEW.actor IS NOT OLD.actor OR NEW.created_at IS NOT OLD.created_at;
END;
CREATE TRIGGER passbook_chore_record_no_delete BEFORE DELETE ON passbook_chore_records
BEGIN
 SELECT RAISE(ABORT,'chore record immutable');
END;
CREATE TRIGGER passbook_chore_record_pay_no_edit BEFORE UPDATE ON passbook_chore_record_payments
BEGIN
 SELECT RAISE(ABORT,'financial history immutable');
END;
CREATE TRIGGER passbook_chore_record_pay_no_delete BEFORE DELETE ON passbook_chore_record_payments
BEGIN
 SELECT RAISE(ABORT,'financial history immutable');
END;

-- Old clients and pending-payment retries must not pay an operation that the new API owns.
CREATE TRIGGER passbook_chore_record_old_attempt_guard BEFORE INSERT ON passbook_chore_attempts
BEGIN
 SELECT RAISE(ABORT,'chore record event reused') WHERE EXISTS(SELECT 1 FROM passbook_chore_records WHERE household_id=NEW.household_id AND event_id=NEW.event_id);
END;
CREATE TRIGGER passbook_chore_record_old_day_guard BEFORE INSERT ON passbook_chore_days WHEN NEW.kind='complete'
BEGIN
 SELECT RAISE(ABORT,'chore record event reused') WHERE EXISTS(SELECT 1 FROM passbook_chore_records WHERE household_id=NEW.household_id AND event_id=NEW.event_id);
END;
