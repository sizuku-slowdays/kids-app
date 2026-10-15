-- Independent good-deed ledger. No passbook tables or legacy records are changed.
CREATE TABLE good_deed_starts (
 child_id TEXT PRIMARY KEY REFERENCES children(id), household_id TEXT NOT NULL REFERENCES groups(id),
 start_id TEXT NOT NULL UNIQUE, started_at TEXT NOT NULL, started_by TEXT NOT NULL REFERENCES users(id),
 UNIQUE(child_id,household_id)
);
CREATE TRIGGER good_deed_start_scope BEFORE INSERT ON good_deed_starts
BEGIN
 SELECT RAISE(ABORT,'good deed household mismatch') WHERE NOT EXISTS(SELECT 1 FROM children WHERE id=NEW.child_id AND household_id=NEW.household_id);
END;
CREATE TABLE good_deed_records (
 id TEXT PRIMARY KEY, household_id TEXT NOT NULL, child_id TEXT NOT NULL,
 title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 100), point INTEGER NOT NULL CHECK(typeof(point)='integer' AND point BETWEEN 1 AND 100000000),
 memo TEXT NOT NULL DEFAULT '' CHECK(length(memo)<=300), created_at TEXT NOT NULL, created_day TEXT NOT NULL,
 actor TEXT NOT NULL REFERENCES users(id), event_id TEXT NOT NULL, deleted_at TEXT, deleted_by TEXT REFERENCES users(id),
 UNIQUE(child_id,event_id), FOREIGN KEY(child_id,household_id) REFERENCES good_deed_starts(child_id,household_id)
);
CREATE INDEX good_deed_records_child ON good_deed_records(child_id,created_at,id);
CREATE TRIGGER good_deed_record_limit BEFORE INSERT ON good_deed_records
BEGIN
 SELECT RAISE(ABORT,'good deed limit') WHERE NEW.point+COALESCE((SELECT SUM(point) FROM good_deed_records WHERE child_id=NEW.child_id AND deleted_at IS NULL),0)>100000000;
END;
CREATE TRIGGER good_deed_record_update BEFORE UPDATE ON good_deed_records
BEGIN
 SELECT RAISE(ABORT,'good deed record immutable') WHERE NEW.id<>OLD.id OR NEW.household_id<>OLD.household_id OR NEW.child_id<>OLD.child_id OR NEW.title<>OLD.title OR NEW.point<>OLD.point OR NEW.memo<>OLD.memo OR NEW.created_at<>OLD.created_at OR NEW.created_day<>OLD.created_day OR NEW.actor<>OLD.actor OR NEW.event_id<>OLD.event_id;
 SELECT RAISE(ABORT,'good deed limit') WHERE OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL AND NEW.point+COALESCE((SELECT SUM(point) FROM good_deed_records WHERE child_id=NEW.child_id AND deleted_at IS NULL),0)>100000000;
END;
CREATE TRIGGER good_deed_record_no_delete BEFORE DELETE ON good_deed_records
BEGIN
 SELECT RAISE(ABORT,'use recoverable deletion');
END;
CREATE TABLE good_deed_changes (
 id INTEGER PRIMARY KEY AUTOINCREMENT, household_id TEXT NOT NULL REFERENCES groups(id), child_id TEXT NOT NULL REFERENCES children(id),
 record_id TEXT REFERENCES good_deed_records(id), kind TEXT NOT NULL, actor TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL
);
CREATE TRIGGER good_deed_record_added AFTER INSERT ON good_deed_records
BEGIN
 INSERT INTO good_deed_changes(household_id,child_id,record_id,kind,actor,created_at) VALUES(NEW.household_id,NEW.child_id,NEW.id,'add',NEW.actor,NEW.created_at);
END;
CREATE TRIGGER good_deed_record_deleted AFTER UPDATE ON good_deed_records WHEN OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL
BEGIN
 INSERT INTO good_deed_changes(household_id,child_id,record_id,kind,actor,created_at) VALUES(NEW.household_id,NEW.child_id,NEW.id,'delete',NEW.deleted_by,NEW.deleted_at);
END;
INSERT INTO apps(id,name,icon,path,enabled,status,position,access_mode)
VALUES('good-deeds','いいことポイント','🌸','/apps/good-deeds/',1,'ready',12,'group');
INSERT INTO group_apps(group_id,app_id) SELECT id,'good-deeds' FROM groups WHERE kind='household';
CREATE TRIGGER good_deed_start_immutable BEFORE UPDATE ON good_deed_starts
BEGIN
 SELECT RAISE(ABORT,'start is immutable');
END;
CREATE TRIGGER good_deed_start_no_delete BEFORE DELETE ON good_deed_starts
BEGIN
 SELECT RAISE(ABORT,'start is immutable');
END;
CREATE TRIGGER good_deed_changes_no_update BEFORE UPDATE ON good_deed_changes
BEGIN
 SELECT RAISE(ABORT,'audit is immutable');
END;
CREATE TRIGGER good_deed_changes_no_delete BEFORE DELETE ON good_deed_changes
BEGIN
 SELECT RAISE(ABORT,'audit is immutable');
END;
