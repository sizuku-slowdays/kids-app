CREATE TABLE passbook_imports (
 household_id TEXT PRIMARY KEY REFERENCES groups(id),
 snapshot_hash TEXT NOT NULL, backup_key TEXT NOT NULL,
 imported_by TEXT NOT NULL REFERENCES users(id), imported_at INTEGER NOT NULL,
 summary_json TEXT NOT NULL
);
CREATE TABLE passbook_adult_accounts (
 id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES groups(id),
 owner_user_id TEXT NOT NULL REFERENCES users(id), unit_id TEXT NOT NULL,
 UNIQUE(owner_user_id,unit_id), UNIQUE(id,household_id),
 FOREIGN KEY(unit_id,household_id) REFERENCES passbook_units(id,household_id)
);
CREATE TABLE passbook_adult_entries (
 id TEXT PRIMARY KEY, account_id TEXT NOT NULL, household_id TEXT NOT NULL,
 delta INTEGER NOT NULL CHECK(typeof(delta)='integer' AND delta<>0),
 memo TEXT NOT NULL, occurred_at TEXT NOT NULL, created_at INTEGER NOT NULL,
 created_by TEXT NOT NULL REFERENCES users(id), source_app TEXT NOT NULL, source_event TEXT NOT NULL,
 UNIQUE(account_id,source_app,source_event),
 FOREIGN KEY(account_id,household_id) REFERENCES passbook_adult_accounts(id,household_id)
);
CREATE TRIGGER passbook_adult_household BEFORE INSERT ON passbook_adult_accounts
BEGIN
 SELECT RAISE(ABORT,'adult household mismatch') WHERE NOT EXISTS(SELECT 1 FROM memberships WHERE user_id=NEW.owner_user_id AND group_id=NEW.household_id AND role IN ('owner','admin'));
END;
CREATE TRIGGER passbook_adult_account_immutable BEFORE UPDATE ON passbook_adult_accounts
BEGIN
 SELECT RAISE(ABORT,'account is immutable');
END;
CREATE TRIGGER passbook_adult_entry_no_update BEFORE UPDATE ON passbook_adult_entries
BEGIN
 SELECT RAISE(ABORT,'ledger is append only');
END;
CREATE TRIGGER passbook_adult_entry_no_delete BEFORE DELETE ON passbook_adult_entries
BEGIN
 SELECT RAISE(ABORT,'ledger is append only');
END;
