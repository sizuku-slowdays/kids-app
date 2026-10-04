-- Daily chore configuration is separate from append-only financial history.
CREATE TABLE passbook_chore_imports (
 household_id TEXT PRIMARY KEY REFERENCES groups(id), backup_key TEXT NOT NULL,
 imported_by TEXT NOT NULL REFERENCES users(id), imported_at INTEGER NOT NULL
);
CREATE TABLE passbook_chores (
 id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES groups(id),
 name TEXT NOT NULL, icon TEXT NOT NULL DEFAULT '🧹', points INTEGER NOT NULL CHECK(points>=0),
 money INTEGER NOT NULL CHECK(money>=0), point_unit_id TEXT NOT NULL,
 rotation_json TEXT NOT NULL CHECK(json_valid(rotation_json)), next_target TEXT,
 next_date TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
 sort_order INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT 1,
 UNIQUE(id,household_id), FOREIGN KEY(point_unit_id,household_id) REFERENCES passbook_units(id,household_id)
);
CREATE TABLE passbook_chore_days (
 id TEXT PRIMARY KEY, chore_id TEXT NOT NULL, household_id TEXT NOT NULL,
 day TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('complete','skip')),
 target TEXT, assigned_to TEXT, points INTEGER NOT NULL, money INTEGER NOT NULL,
 memo TEXT NOT NULL, occurred_at TEXT NOT NULL, created_at INTEGER NOT NULL,
 actor TEXT NOT NULL REFERENCES users(id), event_id TEXT NOT NULL,
 UNIQUE(chore_id,day), UNIQUE(household_id,event_id),
 FOREIGN KEY(chore_id,household_id) REFERENCES passbook_chores(id,household_id)
);
CREATE TRIGGER passbook_chore_day_valid BEFORE INSERT ON passbook_chore_days
BEGIN
 SELECT RAISE(ABORT,'chore changed') WHERE NOT EXISTS(SELECT 1 FROM passbook_chores c WHERE c.id=NEW.chore_id AND c.household_id=NEW.household_id AND c.next_date=NEW.day AND c.enabled=1 AND c.next_target IS NEW.assigned_to AND c.points=NEW.points AND c.money=NEW.money);
 SELECT RAISE(ABORT,'chore actor forbidden') WHERE NOT EXISTS(SELECT 1 FROM memberships WHERE group_id=NEW.household_id AND user_id=NEW.actor AND role IN ('owner','admin'));
 SELECT RAISE(ABORT,'chore points wallet missing') WHERE NEW.kind='complete' AND NEW.points>0 AND NOT EXISTS(SELECT 1 FROM passbook_chores c JOIN passbook_accounts a ON a.household_id=c.household_id AND a.unit_id=c.point_unit_id WHERE c.id=NEW.chore_id AND a.child_id=NEW.target) AND NOT EXISTS(SELECT 1 FROM passbook_chores c JOIN passbook_adult_accounts a ON a.household_id=c.household_id AND a.unit_id=c.point_unit_id WHERE c.id=NEW.chore_id AND 'user:'||a.owner_user_id=NEW.target);
 SELECT RAISE(ABORT,'chore cash wallet missing') WHERE NEW.kind='complete' AND NEW.money>0 AND NOT EXISTS(SELECT 1 FROM passbook_accounts a JOIN passbook_units u ON u.id=a.unit_id WHERE a.household_id=NEW.household_id AND a.child_id=NEW.target AND u.code='cash' AND u.kind='money');
END;
CREATE TRIGGER passbook_chore_day_apply AFTER INSERT ON passbook_chore_days
BEGIN
 INSERT INTO passbook_entries(id,account_id,household_id,delta,memo,occurred_at,created_at,created_by,source_app,source_event)
 SELECT NEW.id||':points',a.id,NEW.household_id,NEW.points,NEW.memo,NEW.occurred_at,NEW.created_at,NEW.actor,'chores',NEW.id FROM passbook_accounts a JOIN passbook_chores c ON c.id=NEW.chore_id WHERE NEW.kind='complete' AND NEW.points>0 AND a.household_id=NEW.household_id AND a.child_id=NEW.target AND a.unit_id=c.point_unit_id;
 INSERT INTO passbook_adult_entries(id,account_id,household_id,delta,memo,occurred_at,created_at,created_by,source_app,source_event)
 SELECT NEW.id||':points',a.id,NEW.household_id,NEW.points,NEW.memo,NEW.occurred_at,NEW.created_at,NEW.actor,'chores',NEW.id FROM passbook_adult_accounts a JOIN passbook_chores c ON c.id=NEW.chore_id WHERE NEW.kind='complete' AND NEW.points>0 AND a.household_id=NEW.household_id AND 'user:'||a.owner_user_id=NEW.target AND a.unit_id=c.point_unit_id;
 INSERT INTO passbook_entries(id,account_id,household_id,delta,memo,occurred_at,created_at,created_by,source_app,source_event)
 SELECT NEW.id||':cash',a.id,NEW.household_id,NEW.money,NEW.memo,NEW.occurred_at,NEW.created_at,NEW.actor,'chores',NEW.id FROM passbook_accounts a JOIN passbook_units u ON u.id=a.unit_id WHERE NEW.kind='complete' AND NEW.money>0 AND a.household_id=NEW.household_id AND a.child_id=NEW.target AND u.code='cash' AND u.kind='money';
 UPDATE passbook_chores SET next_date=date(NEW.day,'+1 day'),next_target=CASE WHEN json_array_length(rotation_json)=0 THEN NULL ELSE json_extract(rotation_json,'$['||((COALESCE((SELECT CAST(key AS INTEGER) FROM json_each(rotation_json) WHERE value=next_target),-1)+1)%json_array_length(rotation_json))||']') END,revision=revision+1 WHERE id=NEW.chore_id;
END;
CREATE TRIGGER passbook_chore_day_no_update BEFORE UPDATE ON passbook_chore_days
BEGIN
 SELECT RAISE(ABORT,'chore history immutable');
END;
CREATE TRIGGER passbook_chore_day_no_delete BEFORE DELETE ON passbook_chore_days
BEGIN
 SELECT RAISE(ABORT,'chore history immutable');
END;
