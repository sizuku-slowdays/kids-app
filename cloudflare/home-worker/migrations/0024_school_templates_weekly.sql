-- Additive only: no existing plans, checks, users, financial or notification rows change.
CREATE TABLE learning_school_templates (
 household_id TEXT NOT NULL REFERENCES groups(id), child_id TEXT NOT NULL REFERENCES children(id),
 schedule_key TEXT NOT NULL CHECK(schedule_key IN ('default','mon','tue','wed','thu','fri','sat','sun')),
 revision INTEGER NOT NULL CHECK(revision>0), labels_json TEXT NOT NULL CHECK(json_valid(labels_json)),
 updated_by TEXT NOT NULL REFERENCES users(id), updated_at TEXT NOT NULL,
 PRIMARY KEY(household_id,child_id,schedule_key,revision)
);
CREATE TRIGGER school_template_authorize BEFORE INSERT ON learning_school_templates
BEGIN
 SELECT RAISE(ABORT,'school template denied') WHERE NOT EXISTS(
 SELECT 1 FROM children c JOIN memberships m ON m.group_id=c.household_id AND m.user_id=NEW.updated_by
 JOIN users u ON u.id=m.user_id AND u.active=1
 JOIN group_apps ga ON ga.group_id=m.group_id AND ga.app_id='school-prep'
 JOIN apps a ON a.id=ga.app_id AND a.enabled=1
 WHERE c.id=NEW.child_id AND c.household_id=NEW.household_id AND m.role IN ('owner','admin')
 AND NOT EXISTS(SELECT 1 FROM children x WHERE x.user_id=m.user_id)
 AND NOT EXISTS(SELECT 1 FROM home_member_attributes x WHERE x.group_id=m.group_id AND x.user_id=m.user_id AND x.age_kind='child'));
 SELECT RAISE(ABORT,'school template conflict') WHERE NEW.revision!=COALESCE((SELECT MAX(revision)+1 FROM learning_school_templates WHERE household_id=NEW.household_id AND child_id=NEW.child_id AND schedule_key=NEW.schedule_key),1);
END;
CREATE TRIGGER school_template_no_update BEFORE UPDATE ON learning_school_templates
BEGIN
 SELECT RAISE(ABORT,'school template immutable');
END;
CREATE TRIGGER school_template_no_delete BEFORE DELETE ON learning_school_templates
BEGIN
 SELECT RAISE(ABORT,'school template immutable');
END;
CREATE TABLE learning_school_imports (
 household_id TEXT NOT NULL REFERENCES groups(id), child_id TEXT NOT NULL REFERENCES children(id),
 request_id TEXT NOT NULL, actor_id TEXT NOT NULL REFERENCES users(id), week_start TEXT NOT NULL,
 payload_json TEXT NOT NULL CHECK(json_valid(payload_json)), created_at TEXT NOT NULL,
 PRIMARY KEY(household_id,child_id,request_id)
);
CREATE TRIGGER school_import_validate BEFORE INSERT ON learning_school_imports
BEGIN
 SELECT RAISE(ABORT,'school import denied') WHERE NOT EXISTS(
 SELECT 1 FROM children c JOIN memberships m ON m.group_id=c.household_id AND m.user_id=NEW.actor_id
 JOIN users u ON u.id=m.user_id AND u.active=1
 JOIN group_apps ga ON ga.group_id=m.group_id AND ga.app_id='school-prep'
 JOIN apps a ON a.id=ga.app_id AND a.enabled=1
 WHERE c.id=NEW.child_id AND c.household_id=NEW.household_id AND m.role IN ('owner','admin')
 AND NOT EXISTS(SELECT 1 FROM children x WHERE x.user_id=m.user_id)
 AND NOT EXISTS(SELECT 1 FROM home_member_attributes x WHERE x.group_id=m.group_id AND x.user_id=m.user_id AND x.age_kind='child'));
 SELECT RAISE(ABORT,'school import conflict') WHERE EXISTS(
 SELECT 1 FROM json_each(NEW.payload_json,'$.days') d
 WHERE COALESCE((SELECT MAX(v.revision) FROM learning_school_versions v
 WHERE v.household_id=NEW.household_id AND v.child_id=NEW.child_id AND v.school_day=json_extract(d.value,'$.day')),0)!=json_extract(d.value,'$.expected_revision'));
END;
CREATE TRIGGER school_import_apply AFTER INSERT ON learning_school_imports
BEGIN
 INSERT INTO learning_school_versions(household_id,child_id,school_day,revision,is_school_day,dismissal,tasks_json,source_file_id,confirmed_by,confirmed_at)
 SELECT NEW.household_id,NEW.child_id,json_extract(d.value,'$.day'),json_extract(d.value,'$.expected_revision')+1,
 json_extract(d.value,'$.is_school_day'),json_extract(d.value,'$.dismissal'),json_extract(d.value,'$.tasks'),
 NULL,NEW.actor_id,NEW.created_at FROM json_each(NEW.payload_json,'$.days') d;
 -- Carry forward only unchanged task IDs/text/kind. Old revisions/checks remain intact.
 INSERT INTO learning_school_checks(household_id,child_id,school_day,revision,task_id,phase,done,changed_by,updated_at)
 SELECT c.household_id,c.child_id,c.school_day,c.revision+1,c.task_id,c.phase,c.done,c.changed_by,c.updated_at
 FROM learning_school_checks c JOIN learning_school_versions old
 ON old.household_id=c.household_id AND old.child_id=c.child_id AND old.school_day=c.school_day AND old.revision=c.revision
 JOIN json_each(NEW.payload_json,'$.days') d ON json_extract(d.value,'$.day')=c.school_day AND json_extract(d.value,'$.expected_revision')=c.revision
 JOIN json_each(old.tasks_json) ot ON json_extract(ot.value,'$.id')=c.task_id
 JOIN json_each(d.value,'$.tasks') nt ON json_extract(nt.value,'$.id')=c.task_id
 AND json_extract(nt.value,'$.text')=json_extract(ot.value,'$.text') AND json_extract(nt.value,'$.kind')=json_extract(ot.value,'$.kind')
 WHERE c.household_id=NEW.household_id AND c.child_id=NEW.child_id;
END;
CREATE TRIGGER school_import_no_update BEFORE UPDATE ON learning_school_imports
BEGIN
 SELECT RAISE(ABORT,'school import immutable');
END;
CREATE TRIGGER school_import_no_delete BEFORE DELETE ON learning_school_imports
BEGIN
 SELECT RAISE(ABORT,'school import immutable');
END;
