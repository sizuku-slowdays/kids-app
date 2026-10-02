CREATE TRIGGER IF NOT EXISTS child_household_check BEFORE INSERT ON children
BEGIN
 SELECT RAISE(ABORT,'child requires household') WHERE NOT EXISTS(SELECT 1 FROM groups WHERE id=NEW.household_id AND kind='household');
END;
CREATE TRIGGER IF NOT EXISTS invitation_child_check BEFORE INSERT ON invitations WHEN NEW.child_id IS NOT NULL
BEGIN
 SELECT RAISE(ABORT,'invalid invitation child') WHERE NOT EXISTS(SELECT 1 FROM children WHERE id=NEW.child_id AND household_id=NEW.group_id AND user_id IS NULL);
END;
CREATE TRIGGER IF NOT EXISTS child_redemption_check BEFORE INSERT ON users WHEN NEW.invitation_id IS NOT NULL
BEGIN
 SELECT RAISE(ABORT,'child already registered') WHERE EXISTS(SELECT 1 FROM invitations i JOIN children c ON c.id=i.child_id WHERE i.id=NEW.invitation_id AND c.user_id IS NOT NULL);
END;
