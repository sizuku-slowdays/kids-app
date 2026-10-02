-- Separate currencies per household. Adding a point kind never changes users/auth.
CREATE TABLE passbook_units (
 id TEXT PRIMARY KEY,
 household_id TEXT NOT NULL REFERENCES groups(id),
 code TEXT NOT NULL,
 name TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('money','points')),
 symbol TEXT NOT NULL,
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 UNIQUE(household_id,code), UNIQUE(id,household_id)
);
CREATE TABLE passbook_settings (
 household_id TEXT PRIMARY KEY REFERENCES groups(id),
 sibling_points_visible INTEGER NOT NULL DEFAULT 0 CHECK(sibling_points_visible IN (0,1))
);
CREATE TABLE passbook_accounts (
 id TEXT PRIMARY KEY,
 household_id TEXT NOT NULL REFERENCES groups(id),
 child_id TEXT NOT NULL REFERENCES children(id),
 unit_id TEXT NOT NULL,
 UNIQUE(child_id,unit_id), UNIQUE(id,household_id),
 FOREIGN KEY(unit_id,household_id) REFERENCES passbook_units(id,household_id)
);
-- Append-only ledger: corrections are additional signed entries, never history deletion.
-- Balance = SUM(delta). Initial imports use an opening adjustment when history is incomplete.
CREATE TABLE passbook_entries (
 id TEXT PRIMARY KEY,
 account_id TEXT NOT NULL,
 household_id TEXT NOT NULL,
 delta INTEGER NOT NULL CHECK(typeof(delta)='integer' AND delta<>0),
 memo TEXT NOT NULL,
 occurred_at TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 created_by TEXT NOT NULL REFERENCES users(id),
 source_app TEXT NOT NULL,
 source_event TEXT NOT NULL,
 reversal_of TEXT UNIQUE REFERENCES passbook_entries(id),
 UNIQUE(account_id,source_app,source_event),
 FOREIGN KEY(account_id,household_id) REFERENCES passbook_accounts(id,household_id)
);
CREATE INDEX passbook_entries_account ON passbook_entries(account_id,occurred_at,id);
-- Permissions for future school-check -> good-deed credits, scoped to unit/group.
-- Browser input must never be trusted as source_app; authenticated server integration only.
CREATE TABLE passbook_credit_sources (
 unit_id TEXT NOT NULL REFERENCES passbook_units(id),
 source_app_id TEXT NOT NULL REFERENCES apps(id),
 enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
 PRIMARY KEY(unit_id,source_app_id)
);
-- Preserve the original IDs and bank_synced status without crediting an imported chore twice.
CREATE TABLE passbook_legacy_events (
 household_id TEXT NOT NULL REFERENCES groups(id),
 provider TEXT NOT NULL,
 legacy_id TEXT NOT NULL,
 child_id TEXT NOT NULL REFERENCES children(id),
 bank_synced INTEGER CHECK(bank_synced IN (0,1)),
 imported_at INTEGER NOT NULL,
 PRIMARY KEY(household_id,provider,legacy_id)
);
CREATE TRIGGER passbook_account_household BEFORE INSERT ON passbook_accounts
BEGIN
 SELECT RAISE(ABORT,'child household mismatch') WHERE NOT EXISTS (SELECT 1 FROM children WHERE id=NEW.child_id AND household_id=NEW.household_id);
END;
CREATE TRIGGER passbook_unit_household BEFORE INSERT ON passbook_units
BEGIN
 SELECT RAISE(ABORT,'household required') WHERE NOT EXISTS (SELECT 1 FROM groups WHERE id=NEW.household_id AND kind='household');
END;
CREATE TRIGGER passbook_entry_no_update BEFORE UPDATE ON passbook_entries
BEGIN
 SELECT RAISE(ABORT,'ledger is append only');
END;
CREATE TRIGGER passbook_entry_no_delete BEFORE DELETE ON passbook_entries
BEGIN
 SELECT RAISE(ABORT,'ledger is append only');
END;
