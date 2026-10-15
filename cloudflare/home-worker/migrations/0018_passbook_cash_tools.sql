-- Additive cash tools. No balances are initialized and no historic payments are made.
CREATE TABLE passbook_allowance_plans (
 id TEXT PRIMARY KEY, household_id TEXT NOT NULL, account_id TEXT NOT NULL,
 amount INTEGER NOT NULL CHECK(amount BETWEEN 1 AND 10000000),
 start_month TEXT NOT NULL, eligible_month TEXT NOT NULL, total_payments INTEGER NOT NULL CHECK(total_payments BETWEEN 1 AND 120),
 enabled INTEGER NOT NULL CHECK(enabled IN (0,1)), revision INTEGER NOT NULL DEFAULT 1,
 created_by TEXT NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL,
 FOREIGN KEY(account_id,household_id) REFERENCES passbook_accounts(id,household_id)
);
CREATE UNIQUE INDEX passbook_allowance_active ON passbook_allowance_plans(account_id) WHERE enabled=1;
CREATE TABLE passbook_allowance_payments (
 plan_id TEXT NOT NULL REFERENCES passbook_allowance_plans(id), target_month TEXT NOT NULL,
 account_id TEXT NOT NULL, household_id TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount>0),
 plan_revision INTEGER NOT NULL, actor TEXT NOT NULL REFERENCES users(id), processed_at INTEGER NOT NULL,
 PRIMARY KEY(plan_id,target_month), UNIQUE(account_id,target_month),
 FOREIGN KEY(account_id,household_id) REFERENCES passbook_accounts(id,household_id)
);
CREATE TRIGGER passbook_allowance_validate BEFORE INSERT ON passbook_allowance_payments
BEGIN
 SELECT RAISE(ABORT,'allowance changed') WHERE NOT EXISTS(SELECT 1 FROM passbook_allowance_plans p JOIN passbook_accounts a ON a.id=p.account_id JOIN passbook_units u ON u.id=a.unit_id WHERE p.id=NEW.plan_id AND p.household_id=NEW.household_id AND p.account_id=NEW.account_id AND p.amount=NEW.amount AND p.revision=NEW.plan_revision AND p.enabled=1 AND p.start_month<=NEW.target_month AND p.eligible_month<=NEW.target_month AND u.code='cash' AND u.kind='money' AND (SELECT COUNT(*) FROM passbook_allowance_payments x WHERE x.plan_id=p.id)<p.total_payments);
END;
CREATE TRIGGER passbook_allowance_apply AFTER INSERT ON passbook_allowance_payments
BEGIN
 INSERT INTO passbook_entries(id,account_id,household_id,delta,memo,occurred_at,created_at,created_by,source_app,source_event)
 VALUES('allowance:'||NEW.plan_id||':'||NEW.target_month,NEW.account_id,NEW.household_id,NEW.amount,substr(NEW.target_month,1,4)||'年'||CAST(substr(NEW.target_month,6,2) AS INTEGER)||'月分 お小遣い',strftime('%Y-%m-%dT%H:%M:%SZ',NEW.processed_at,'unixepoch'),NEW.processed_at,NEW.actor,'allowance',NEW.plan_id||':'||NEW.target_month);
 UPDATE passbook_allowance_plans SET enabled=0 WHERE id=NEW.plan_id AND (SELECT COUNT(*) FROM passbook_allowance_payments WHERE plan_id=NEW.plan_id)>=total_payments;
END;
CREATE TABLE passbook_interest_accounts (
 account_id TEXT PRIMARY KEY, household_id TEXT NOT NULL, started_day TEXT NOT NULL,
 started_at INTEGER NOT NULL, opening_balance INTEGER NOT NULL, carry_ticks TEXT NOT NULL DEFAULT '0',
 FOREIGN KEY(account_id,household_id) REFERENCES passbook_accounts(id,household_id)
);
CREATE TABLE passbook_interest_policies (
 account_id TEXT NOT NULL REFERENCES passbook_interest_accounts(account_id), effective_day TEXT NOT NULL,
 rate_bps INTEGER NOT NULL CHECK(rate_bps BETWEEN 0 AND 10000), annual_cap INTEGER NOT NULL CHECK(annual_cap BETWEEN 0 AND 10000000),
 enabled INTEGER NOT NULL CHECK(enabled IN (0,1)), created_by TEXT NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL,
 PRIMARY KEY(account_id,effective_day)
);
CREATE TABLE passbook_interest_payments (
 account_id TEXT NOT NULL, household_id TEXT NOT NULL, target_month TEXT NOT NULL, payment_year INTEGER NOT NULL,
 earned_ticks TEXT NOT NULL, carry_before TEXT NOT NULL, carry_after TEXT NOT NULL,
 paid INTEGER NOT NULL CHECK(paid>=0), annual_cap INTEGER NOT NULL, year_paid_before INTEGER NOT NULL,
 calculation_json TEXT NOT NULL CHECK(json_valid(calculation_json)), actor TEXT NOT NULL REFERENCES users(id), processed_at INTEGER NOT NULL,
 PRIMARY KEY(account_id,target_month), FOREIGN KEY(account_id,household_id) REFERENCES passbook_accounts(id,household_id)
);
CREATE TRIGGER passbook_interest_validate BEFORE INSERT ON passbook_interest_payments
BEGIN
 SELECT RAISE(ABORT,'interest changed') WHERE NOT EXISTS(SELECT 1 FROM passbook_interest_accounts i JOIN passbook_accounts a ON a.id=i.account_id JOIN passbook_units u ON u.id=a.unit_id WHERE i.account_id=NEW.account_id AND i.household_id=NEW.household_id AND i.carry_ticks=NEW.carry_before AND u.code='cash' AND u.kind='money');
 SELECT RAISE(ABORT,'interest cap changed') WHERE NEW.year_paid_before<>COALESCE((SELECT SUM(paid) FROM passbook_interest_payments WHERE account_id=NEW.account_id AND payment_year=NEW.payment_year),0) OR NEW.paid+NEW.year_paid_before>MAX(NEW.annual_cap,NEW.year_paid_before);
END;
CREATE TRIGGER passbook_interest_apply AFTER INSERT ON passbook_interest_payments
BEGIN
 INSERT INTO passbook_entries(id,account_id,household_id,delta,memo,occurred_at,created_at,created_by,source_app,source_event)
 SELECT 'interest:'||NEW.account_id||':'||NEW.target_month,NEW.account_id,NEW.household_id,NEW.paid,NEW.target_month||'分 利息',strftime('%Y-%m-%dT%H:%M:%SZ',NEW.processed_at,'unixepoch'),NEW.processed_at,NEW.actor,'interest',NEW.target_month WHERE NEW.paid>0;
 UPDATE passbook_interest_accounts SET carry_ticks=NEW.carry_after WHERE account_id=NEW.account_id;
END;
CREATE TABLE passbook_cash_operations (
 id TEXT PRIMARY KEY, household_id TEXT NOT NULL, account_id TEXT NOT NULL, other_account_id TEXT,
 kind TEXT NOT NULL CHECK(kind IN ('adjust','transfer')), amount INTEGER NOT NULL CHECK(amount>=0),
 memo TEXT NOT NULL, actor TEXT NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL,
 FOREIGN KEY(account_id,household_id) REFERENCES passbook_accounts(id,household_id),
 FOREIGN KEY(other_account_id,household_id) REFERENCES passbook_accounts(id,household_id)
);
CREATE TRIGGER passbook_cash_operation_validate BEFORE INSERT ON passbook_cash_operations
BEGIN
 SELECT RAISE(ABORT,'cash operation forbidden') WHERE NOT EXISTS(SELECT 1 FROM memberships WHERE group_id=NEW.household_id AND user_id=NEW.actor AND role IN ('owner','admin'));
 SELECT RAISE(ABORT,'wallet required') WHERE NEW.kind='adjust' AND (NEW.other_account_id IS NOT NULL OR NOT EXISTS(SELECT 1 FROM passbook_accounts a JOIN passbook_units u ON u.id=a.unit_id WHERE a.id=NEW.account_id AND a.household_id=NEW.household_id AND u.code='wallet' AND u.kind='money'));
 SELECT RAISE(ABORT,'invalid cash transfer') WHERE NEW.kind='transfer' AND (NEW.amount<=0 OR NOT EXISTS(SELECT 1 FROM passbook_accounts a JOIN passbook_units u ON u.id=a.unit_id JOIN passbook_accounts b ON b.child_id=a.child_id AND b.household_id=a.household_id JOIN passbook_units v ON v.id=b.unit_id WHERE a.id=NEW.account_id AND b.id=NEW.other_account_id AND a.household_id=NEW.household_id AND u.kind='money' AND v.kind='money' AND ((u.code='cash' AND v.code='wallet') OR (u.code='wallet' AND v.code='cash'))) OR COALESCE((SELECT SUM(delta) FROM passbook_entries WHERE account_id=NEW.account_id),0)<NEW.amount);
END;
CREATE TRIGGER passbook_cash_operation_apply AFTER INSERT ON passbook_cash_operations
BEGIN
 INSERT INTO passbook_entries(id,account_id,household_id,delta,memo,occurred_at,created_at,created_by,source_app,source_event)
 SELECT NEW.id||':adjust',NEW.account_id,NEW.household_id,NEW.amount-COALESCE((SELECT SUM(delta) FROM passbook_entries WHERE account_id=NEW.account_id),0),'残高調整：'||NEW.memo,strftime('%Y-%m-%dT%H:%M:%SZ',NEW.created_at,'unixepoch'),NEW.created_at,NEW.actor,'wallet-adjust',NEW.id WHERE NEW.kind='adjust' AND NEW.amount<>COALESCE((SELECT SUM(delta) FROM passbook_entries WHERE account_id=NEW.account_id),0);
 INSERT INTO passbook_entries(id,account_id,household_id,delta,memo,occurred_at,created_at,created_by,source_app,source_event)
 SELECT NEW.id||':out',NEW.account_id,NEW.household_id,-NEW.amount,'振替：'||NEW.memo,strftime('%Y-%m-%dT%H:%M:%SZ',NEW.created_at,'unixepoch'),NEW.created_at,NEW.actor,'cash-transfer',NEW.id WHERE NEW.kind='transfer';
 INSERT INTO passbook_entries(id,account_id,household_id,delta,memo,occurred_at,created_at,created_by,source_app,source_event)
 SELECT NEW.id||':in',NEW.other_account_id,NEW.household_id,NEW.amount,'振替：'||NEW.memo,strftime('%Y-%m-%dT%H:%M:%SZ',NEW.created_at,'unixepoch'),NEW.created_at,NEW.actor,'cash-transfer',NEW.id WHERE NEW.kind='transfer';
END;
CREATE TABLE passbook_automation_logs (
 id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES groups(id), account_id TEXT,
 kind TEXT NOT NULL, target_month TEXT NOT NULL, status TEXT NOT NULL, detail TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE passbook_chore_attempts (
 household_id TEXT NOT NULL, chore_id TEXT NOT NULL, day TEXT NOT NULL, event_id TEXT NOT NULL,
 target TEXT NOT NULL, points INTEGER NOT NULL, money INTEGER NOT NULL, point_unit_id TEXT NOT NULL, memo TEXT NOT NULL, revision INTEGER NOT NULL,
 actor TEXT NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
 error TEXT, PRIMARY KEY(household_id,event_id), UNIQUE(chore_id,day),
 FOREIGN KEY(chore_id,household_id) REFERENCES passbook_chores(id,household_id)
);
CREATE TABLE passbook_chore_cash_repairs (
 day_id TEXT PRIMARY KEY REFERENCES passbook_chore_days(id), household_id TEXT NOT NULL REFERENCES groups(id),
 account_id TEXT NOT NULL, actor TEXT NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL
);
CREATE TRIGGER passbook_chore_cash_repair_validate BEFORE INSERT ON passbook_chore_cash_repairs
BEGIN
 SELECT RAISE(ABORT,'repair requires recorded completion') WHERE NOT EXISTS(SELECT 1 FROM passbook_chore_days d JOIN passbook_adult_accounts a ON 'user:'||a.owner_user_id=d.target JOIN passbook_units u ON u.id=a.unit_id WHERE d.id=NEW.day_id AND d.household_id=NEW.household_id AND a.household_id=d.household_id AND a.id=NEW.account_id AND d.kind='complete' AND d.money>0 AND u.kind='money' AND u.code='cash');
 SELECT RAISE(ABORT,'repair forbidden') WHERE NOT EXISTS(SELECT 1 FROM memberships WHERE group_id=NEW.household_id AND user_id=NEW.actor AND role IN ('owner','admin'));
END;
CREATE TRIGGER passbook_chore_cash_repair_apply AFTER INSERT ON passbook_chore_cash_repairs
BEGIN
 INSERT INTO passbook_adult_entries(id,account_id,household_id,delta,memo,occurred_at,created_at,created_by,source_app,source_event)
 SELECT d.id||':cash',NEW.account_id,NEW.household_id,d.money,'未払い精算：'||d.memo,strftime('%Y-%m-%dT%H:%M:%SZ',NEW.created_at,'unixepoch'),NEW.created_at,NEW.actor,'chores',d.id FROM passbook_chore_days d WHERE d.id=NEW.day_id ON CONFLICT(account_id,source_app,source_event) DO NOTHING;
END;
-- Extend the two existing chore triggers to accept adult cash wallets. Keep all other checks.
DROP TRIGGER passbook_chore_day_valid;
DROP TRIGGER passbook_chore_day_apply;
CREATE TRIGGER passbook_chore_day_valid BEFORE INSERT ON passbook_chore_days
BEGIN
 SELECT RAISE(ABORT,'chore changed') WHERE NOT EXISTS(SELECT 1 FROM passbook_chores c WHERE c.id=NEW.chore_id AND c.household_id=NEW.household_id AND c.next_date=NEW.day AND c.enabled=1 AND c.next_target IS NEW.assigned_to AND c.points=NEW.points AND c.money=NEW.money);
 SELECT RAISE(ABORT,'chore actor forbidden') WHERE NOT EXISTS(SELECT 1 FROM memberships WHERE group_id=NEW.household_id AND user_id=NEW.actor AND role IN ('owner','admin'));
 SELECT RAISE(ABORT,'chore points wallet missing') WHERE NEW.kind='complete' AND NEW.points>0 AND NOT EXISTS(SELECT 1 FROM passbook_chores c JOIN passbook_accounts a ON a.household_id=c.household_id AND a.unit_id=c.point_unit_id WHERE c.id=NEW.chore_id AND a.child_id=NEW.target) AND NOT EXISTS(SELECT 1 FROM passbook_chores c JOIN passbook_adult_accounts a ON a.household_id=c.household_id AND a.unit_id=c.point_unit_id WHERE c.id=NEW.chore_id AND 'user:'||a.owner_user_id=NEW.target);
 SELECT RAISE(ABORT,'chore cash wallet missing') WHERE NEW.kind='complete' AND NEW.money>0 AND NOT EXISTS(SELECT 1 FROM passbook_accounts a JOIN passbook_units u ON u.id=a.unit_id WHERE a.household_id=NEW.household_id AND a.child_id=NEW.target AND u.code='cash' AND u.kind='money') AND NOT EXISTS(SELECT 1 FROM passbook_adult_accounts a JOIN passbook_units u ON u.id=a.unit_id WHERE a.household_id=NEW.household_id AND 'user:'||a.owner_user_id=NEW.target AND u.code='cash' AND u.kind='money');
END;
CREATE TRIGGER passbook_chore_day_apply AFTER INSERT ON passbook_chore_days
BEGIN
 INSERT INTO passbook_entries(id,account_id,household_id,delta,memo,occurred_at,created_at,created_by,source_app,source_event)
 SELECT NEW.id||':points',a.id,NEW.household_id,NEW.points,NEW.memo,NEW.occurred_at,NEW.created_at,NEW.actor,'chores',NEW.id FROM passbook_accounts a JOIN passbook_chores c ON c.id=NEW.chore_id WHERE NEW.kind='complete' AND NEW.points>0 AND a.household_id=NEW.household_id AND a.child_id=NEW.target AND a.unit_id=c.point_unit_id;
 INSERT INTO passbook_adult_entries(id,account_id,household_id,delta,memo,occurred_at,created_at,created_by,source_app,source_event)
 SELECT NEW.id||':points',a.id,NEW.household_id,NEW.points,NEW.memo,NEW.occurred_at,NEW.created_at,NEW.actor,'chores',NEW.id FROM passbook_adult_accounts a JOIN passbook_chores c ON c.id=NEW.chore_id WHERE NEW.kind='complete' AND NEW.points>0 AND a.household_id=NEW.household_id AND 'user:'||a.owner_user_id=NEW.target AND a.unit_id=c.point_unit_id;
 INSERT INTO passbook_entries(id,account_id,household_id,delta,memo,occurred_at,created_at,created_by,source_app,source_event)
 SELECT NEW.id||':cash',a.id,NEW.household_id,NEW.money,NEW.memo,NEW.occurred_at,NEW.created_at,NEW.actor,'chores',NEW.id FROM passbook_accounts a JOIN passbook_units u ON u.id=a.unit_id WHERE NEW.kind='complete' AND NEW.money>0 AND a.household_id=NEW.household_id AND a.child_id=NEW.target AND u.code='cash' AND u.kind='money';
 INSERT INTO passbook_adult_entries(id,account_id,household_id,delta,memo,occurred_at,created_at,created_by,source_app,source_event)
 SELECT NEW.id||':cash',a.id,NEW.household_id,NEW.money,NEW.memo,NEW.occurred_at,NEW.created_at,NEW.actor,'chores',NEW.id FROM passbook_adult_accounts a JOIN passbook_units u ON u.id=a.unit_id WHERE NEW.kind='complete' AND NEW.money>0 AND a.household_id=NEW.household_id AND 'user:'||a.owner_user_id=NEW.target AND u.code='cash' AND u.kind='money';
 UPDATE passbook_chores SET next_date=date(NEW.day,'+1 day'),next_target=CASE WHEN json_array_length(rotation_json)=0 THEN NULL ELSE json_extract(rotation_json,'$['||((COALESCE((SELECT CAST(key AS INTEGER) FROM json_each(rotation_json) WHERE value=next_target),-1)+1)%json_array_length(rotation_json))||']') END,revision=revision+1 WHERE id=NEW.chore_id;
END;
CREATE TABLE passbook_chore_attempt_settlements (
 chore_id TEXT NOT NULL, day TEXT NOT NULL, household_id TEXT NOT NULL,
 event_id TEXT NOT NULL, actor TEXT NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL,
 PRIMARY KEY(chore_id,day), FOREIGN KEY(household_id,event_id) REFERENCES passbook_chore_attempts(household_id,event_id)
);
CREATE TRIGGER passbook_chore_attempt_settlement_validate BEFORE INSERT ON passbook_chore_attempt_settlements
BEGIN
 SELECT RAISE(ABORT,'pending chore missing') WHERE NOT EXISTS(SELECT 1 FROM passbook_chore_attempts t WHERE t.chore_id=NEW.chore_id AND t.day=NEW.day AND t.household_id=NEW.household_id AND t.event_id=NEW.event_id AND t.status='pending');
 SELECT RAISE(ABORT,'chore already completed') WHERE EXISTS(SELECT 1 FROM passbook_chore_days d WHERE d.chore_id=NEW.chore_id AND d.day=NEW.day AND d.kind='complete');
 SELECT RAISE(ABORT,'chore actor forbidden') WHERE NOT EXISTS(SELECT 1 FROM memberships WHERE group_id=NEW.household_id AND user_id=NEW.actor AND role IN ('owner','admin'));
 SELECT RAISE(ABORT,'chore cash wallet missing') WHERE EXISTS(SELECT 1 FROM passbook_chore_attempts t WHERE t.household_id=NEW.household_id AND t.event_id=NEW.event_id AND t.money>0 AND NOT EXISTS(SELECT 1 FROM passbook_adult_accounts a JOIN passbook_units u ON u.id=a.unit_id WHERE a.household_id=t.household_id AND 'user:'||a.owner_user_id=t.target AND u.code='cash' AND u.kind='money') AND NOT EXISTS(SELECT 1 FROM passbook_accounts a JOIN passbook_units u ON u.id=a.unit_id WHERE a.household_id=t.household_id AND a.child_id=t.target AND u.code='cash' AND u.kind='money'));
 SELECT RAISE(ABORT,'chore points wallet missing') WHERE EXISTS(SELECT 1 FROM passbook_chore_attempts t JOIN passbook_chores c ON c.id=t.chore_id WHERE t.household_id=NEW.household_id AND t.event_id=NEW.event_id AND t.points>0 AND NOT EXISTS(SELECT 1 FROM passbook_adult_accounts a WHERE a.household_id=t.household_id AND 'user:'||a.owner_user_id=t.target AND a.unit_id=t.point_unit_id) AND NOT EXISTS(SELECT 1 FROM passbook_accounts a WHERE a.household_id=t.household_id AND a.child_id=t.target AND a.unit_id=t.point_unit_id));
END;
CREATE TRIGGER passbook_chore_attempt_settlement_apply AFTER INSERT ON passbook_chore_attempt_settlements
BEGIN
 INSERT INTO passbook_adult_entries(id,account_id,household_id,delta,memo,occurred_at,created_at,created_by,source_app,source_event)
 SELECT 'pending:'||NEW.chore_id||':'||NEW.day||':'||u.code,a.id,t.household_id,CASE WHEN u.code='cash' THEN t.money ELSE t.points END,'未払い精算：'||t.memo,strftime('%Y-%m-%dT%H:%M:%SZ',NEW.created_at,'unixepoch'),NEW.created_at,NEW.actor,'chores-retry',NEW.chore_id||':'||NEW.day FROM passbook_chore_attempts t JOIN passbook_chores c ON c.id=t.chore_id JOIN passbook_adult_accounts a ON a.household_id=t.household_id AND 'user:'||a.owner_user_id=t.target JOIN passbook_units u ON u.id=a.unit_id WHERE t.chore_id=NEW.chore_id AND t.day=NEW.day AND ((u.code='cash' AND u.kind='money' AND t.money>0) OR (u.id=t.point_unit_id AND t.points>0));
 INSERT INTO passbook_entries(id,account_id,household_id,delta,memo,occurred_at,created_at,created_by,source_app,source_event)
 SELECT 'pending:'||NEW.chore_id||':'||NEW.day||':'||u.code,a.id,t.household_id,CASE WHEN u.code='cash' THEN t.money ELSE t.points END,'未払い精算：'||t.memo,strftime('%Y-%m-%dT%H:%M:%SZ',NEW.created_at,'unixepoch'),NEW.created_at,NEW.actor,'chores-retry',NEW.chore_id||':'||NEW.day FROM passbook_chore_attempts t JOIN passbook_chores c ON c.id=t.chore_id JOIN passbook_accounts a ON a.household_id=t.household_id AND a.child_id=t.target JOIN passbook_units u ON u.id=a.unit_id WHERE t.chore_id=NEW.chore_id AND t.day=NEW.day AND ((u.code='cash' AND u.kind='money' AND t.money>0) OR (u.id=t.point_unit_id AND t.points>0));
 UPDATE passbook_chore_attempts SET status='settled',error=NULL WHERE chore_id=NEW.chore_id AND day=NEW.day;
END;
CREATE TRIGGER passbook_chore_settled_guard BEFORE INSERT ON passbook_chore_days
BEGIN
 SELECT RAISE(ABORT,'chore already settled') WHERE NEW.kind='complete' AND EXISTS(SELECT 1 FROM passbook_chore_attempt_settlements WHERE chore_id=NEW.chore_id AND day=NEW.day);
END;
CREATE TRIGGER passbook_allowance_payments_no_update BEFORE UPDATE ON passbook_allowance_payments
BEGIN
 SELECT RAISE(ABORT,'financial history immutable');
END;
CREATE TRIGGER passbook_allowance_payments_no_delete BEFORE DELETE ON passbook_allowance_payments
BEGIN
 SELECT RAISE(ABORT,'financial history immutable');
END;
CREATE TRIGGER passbook_interest_payments_no_update BEFORE UPDATE ON passbook_interest_payments
BEGIN
 SELECT RAISE(ABORT,'financial history immutable');
END;
CREATE TRIGGER passbook_interest_payments_no_delete BEFORE DELETE ON passbook_interest_payments
BEGIN
 SELECT RAISE(ABORT,'financial history immutable');
END;
CREATE TRIGGER passbook_cash_operations_no_update BEFORE UPDATE ON passbook_cash_operations
BEGIN
 SELECT RAISE(ABORT,'financial history immutable');
END;
CREATE TRIGGER passbook_cash_operations_no_delete BEFORE DELETE ON passbook_cash_operations
BEGIN
 SELECT RAISE(ABORT,'financial history immutable');
END;
CREATE TRIGGER passbook_chore_cash_repairs_no_update BEFORE UPDATE ON passbook_chore_cash_repairs
BEGIN
 SELECT RAISE(ABORT,'financial history immutable');
END;
CREATE TRIGGER passbook_chore_cash_repairs_no_delete BEFORE DELETE ON passbook_chore_cash_repairs
BEGIN
 SELECT RAISE(ABORT,'financial history immutable');
END;
CREATE TRIGGER passbook_chore_attempt_settlements_no_update BEFORE UPDATE ON passbook_chore_attempt_settlements
BEGIN
 SELECT RAISE(ABORT,'financial history immutable');
END;
CREATE TRIGGER passbook_chore_attempt_settlements_no_delete BEFORE DELETE ON passbook_chore_attempt_settlements
BEGIN
 SELECT RAISE(ABORT,'financial history immutable');
END;
