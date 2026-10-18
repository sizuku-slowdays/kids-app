-- Personal HOME configuration only. No existing preferences or financial rows are updated.
CREATE TABLE home_layout_versions(user_id TEXT PRIMARY KEY REFERENCES users(id),revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0));
CREATE TABLE home_layout_operations(
 id TEXT PRIMARY KEY,actor_id TEXT NOT NULL REFERENCES users(id),user_id TEXT NOT NULL REFERENCES users(id),
 expected_revision INTEGER NOT NULL CHECK(expected_revision>=0),
 layout_json TEXT NOT NULL CHECK(json_valid(layout_json) AND json_type(layout_json)='array'),created_at INTEGER NOT NULL
);
CREATE TRIGGER home_layout_validate BEFORE INSERT ON home_layout_operations
BEGIN
 SELECT RAISE(ABORT,'home layout forbidden') WHERE NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.actor_id AND active=1)
 OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND active=1)
 OR (NEW.actor_id<>NEW.user_id AND (
 EXISTS(SELECT 1 FROM children WHERE user_id=NEW.actor_id)
 OR EXISTS(SELECT 1 FROM home_member_attributes WHERE user_id=NEW.actor_id AND age_kind='child')
 OR NOT EXISTS(SELECT 1 FROM children c JOIN memberships a ON a.group_id=c.household_id
 JOIN memberships t ON t.group_id=c.household_id AND t.user_id=c.user_id
 WHERE c.user_id=NEW.user_id AND a.user_id=NEW.actor_id AND a.role IN ('owner','admin'))));
 SELECT RAISE(ABORT,'home layout conflict') WHERE COALESCE((SELECT revision FROM home_layout_versions WHERE user_id=NEW.user_id),0)<>NEW.expected_revision;
 SELECT RAISE(ABORT,'home layout invalid') WHERE json_array_length(NEW.layout_json)>100
 OR EXISTS(SELECT 1 FROM json_each(NEW.layout_json) j WHERE json_type(j.value)<>'object'
 OR json_type(j.value,'$.id') IS NOT 'text' OR json_type(j.value,'$.section') IS NOT 'text'
 OR json_extract(j.value,'$.section') NOT IN ('favorite','list','hidden'))
 OR (SELECT COUNT(DISTINCT json_extract(value,'$.id')) FROM json_each(NEW.layout_json))<>json_array_length(NEW.layout_json)
 OR EXISTS(SELECT 1 FROM json_each(NEW.layout_json) j WHERE NOT EXISTS(
 SELECT 1 FROM apps a WHERE a.id=json_extract(j.value,'$.id') AND a.enabled=1 AND (
 (a.access_mode='personal' AND EXISTS(SELECT 1 FROM personal_app_access pa WHERE pa.app_id=a.id AND pa.user_id=NEW.user_id))
 OR (a.access_mode='group' AND EXISTS(SELECT 1 FROM group_apps ga JOIN memberships m ON m.group_id=ga.group_id WHERE ga.app_id=a.id AND m.user_id=NEW.user_id)))))
 OR json_array_length(NEW.layout_json)<>(SELECT COUNT(*) FROM apps a WHERE a.enabled=1 AND (
 (a.access_mode='personal' AND EXISTS(SELECT 1 FROM personal_app_access pa WHERE pa.app_id=a.id AND pa.user_id=NEW.user_id))
 OR (a.access_mode='group' AND EXISTS(SELECT 1 FROM group_apps ga JOIN memberships m ON m.group_id=ga.group_id WHERE ga.app_id=a.id AND m.user_id=NEW.user_id))));
END;
CREATE TRIGGER home_layout_apply AFTER INSERT ON home_layout_operations
BEGIN
 INSERT INTO user_apps(user_id,app_id,visible,position)
 SELECT NEW.user_id,json_extract(j.value,'$.id'),CASE json_extract(j.value,'$.section') WHEN 'hidden' THEN 0 ELSE 1 END,CAST(j.key AS INTEGER)
 FROM json_each(NEW.layout_json) j WHERE 1
 ON CONFLICT(user_id,app_id) DO UPDATE SET visible=excluded.visible,position=excluded.position;
 INSERT INTO home_preferences(user_id,favorite_app_ids)
 VALUES(NEW.user_id,(SELECT json_group_array(json_extract(value,'$.id')) FROM json_each(NEW.layout_json) WHERE json_extract(value,'$.section')='favorite'))
 ON CONFLICT(user_id) DO UPDATE SET favorite_app_ids=excluded.favorite_app_ids;
 INSERT INTO home_layout_versions VALUES(NEW.user_id,NEW.expected_revision+1)
 ON CONFLICT(user_id) DO UPDATE SET revision=excluded.revision;
END;
CREATE TRIGGER home_layout_audit_update BEFORE UPDATE ON home_layout_operations
BEGIN
 SELECT RAISE(ABORT,'home layout immutable');
END;
CREATE TRIGGER home_layout_audit_delete BEFORE DELETE ON home_layout_operations
BEGIN
 SELECT RAISE(ABORT,'home layout immutable');
END;
CREATE TRIGGER home_layout_user_app_insert AFTER INSERT ON user_apps
BEGIN
 INSERT INTO home_layout_versions VALUES(NEW.user_id,1) ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER home_layout_user_app_update AFTER UPDATE ON user_apps
BEGIN
 INSERT INTO home_layout_versions VALUES(NEW.user_id,1) ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER home_layout_user_app_delete AFTER DELETE ON user_apps
BEGIN
 INSERT INTO home_layout_versions VALUES(OLD.user_id,1) ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER home_layout_preference_insert AFTER INSERT ON home_preferences
BEGIN
 INSERT INTO home_layout_versions VALUES(NEW.user_id,1) ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER home_layout_preference_update AFTER UPDATE ON home_preferences
BEGIN
 INSERT INTO home_layout_versions VALUES(NEW.user_id,1) ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER home_layout_preference_delete AFTER DELETE ON home_preferences
BEGIN
 INSERT INTO home_layout_versions VALUES(OLD.user_id,1) ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
END;
