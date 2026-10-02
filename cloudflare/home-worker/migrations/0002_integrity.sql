CREATE TRIGGER child_household_check BEFORE INSERT ON children
BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM groups WHERE id=NEW.household_id AND kind='household') THEN RAISE(ABORT,'child requires household') END;
END;
CREATE TRIGGER invitation_child_check BEFORE INSERT ON invitations WHEN NEW.child_id IS NOT NULL
BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM children WHERE id=NEW.child_id AND household_id=NEW.group_id AND user_id IS NULL) THEN RAISE(ABORT,'invalid invitation child') END;
END;
CREATE TRIGGER child_redemption_check BEFORE INSERT ON users WHEN NEW.invitation_id IS NOT NULL
BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM invitations i JOIN children c ON c.id=i.child_id WHERE i.id=NEW.invitation_id AND c.user_id IS NOT NULL) THEN RAISE(ABORT,'child already registered') END;
END;
