CREATE TABLE child_account_moves (
 id TEXT PRIMARY KEY, source_child_id TEXT NOT NULL REFERENCES children(id),
 target_child_id TEXT NOT NULL REFERENCES children(id), user_id TEXT NOT NULL REFERENCES users(id),
 actor_id TEXT NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL
);
CREATE TRIGGER child_account_move_validate BEFORE INSERT ON child_account_moves
BEGIN
 SELECT RAISE(ABORT,'invalid child account move') WHERE NOT EXISTS(
 SELECT 1 FROM children s JOIN children t ON t.household_id=s.household_id
 JOIN memberships a ON a.group_id=s.household_id AND a.user_id=NEW.actor_id
 JOIN memberships m ON m.group_id=s.household_id AND m.user_id=NEW.user_id
 JOIN users u ON u.id=m.user_id
 WHERE s.id=NEW.source_child_id AND t.id=NEW.target_child_id AND s.id<>t.id
 AND s.user_id=NEW.user_id AND t.user_id IS NULL AND a.role IN ('owner','admin') AND m.role='member' AND u.active=1
 AND NOT EXISTS(SELECT 1 FROM passbook_accounts WHERE household_id=s.household_id)
 AND NOT EXISTS(SELECT 1 FROM passbook_imports WHERE household_id=s.household_id)
 AND NOT EXISTS(SELECT 1 FROM passbook_activation WHERE household_id=s.household_id)
 AND NOT EXISTS(SELECT 1 FROM timetables WHERE child_id IN (s.id,t.id)));
END;
CREATE TRIGGER child_account_move_apply AFTER INSERT ON child_account_moves
BEGIN
 UPDATE children SET user_id=NULL WHERE id=NEW.source_child_id;
 UPDATE children SET user_id=NEW.user_id WHERE id=NEW.target_child_id;
 UPDATE invitations SET revoked_at=NEW.created_at WHERE child_id IN (NEW.source_child_id,NEW.target_child_id) AND consumed_by IS NULL AND revoked_at IS NULL;
 UPDATE sessions SET revoked_at=NEW.created_at WHERE user_id=NEW.user_id AND revoked_at IS NULL;
END;
