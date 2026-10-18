-- Additive foundation. Existing users, memberships, sessions and app grants are not updated.
CREATE TABLE family_workspaces (
 group_id TEXT PRIMARY KEY REFERENCES groups(id), mode TEXT NOT NULL CHECK(mode='restricted'),
 created_at INTEGER NOT NULL
);
CREATE TABLE family_invitations (
 id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE,
 purpose TEXT NOT NULL CHECK(purpose IN ('create_family','join_family','join_sharing')),
 group_id TEXT REFERENCES groups(id), issued_by TEXT NOT NULL REFERENCES users(id),
 expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL,
 use_limit INTEGER NOT NULL DEFAULT 1 CHECK(use_limit BETWEEN 1 AND 100),
 use_count INTEGER NOT NULL DEFAULT 0 CHECK(use_count>=0 AND use_count<=use_limit), revoked_at INTEGER,
 CHECK((purpose='create_family' AND group_id IS NULL) OR (purpose<>'create_family' AND group_id IS NOT NULL))
);
CREATE TABLE family_invitation_uses (
 id TEXT PRIMARY KEY, invitation_id TEXT NOT NULL REFERENCES family_invitations(id),
 user_id TEXT NOT NULL REFERENCES users(id), created_group_id TEXT UNIQUE,
 group_name TEXT NOT NULL DEFAULT '', accepted_at INTEGER NOT NULL,
 UNIQUE(invitation_id,user_id)
);
CREATE TABLE family_audit_events (
 id TEXT PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES users(id),
 group_id TEXT REFERENCES groups(id), action TEXT NOT NULL,
 target_id TEXT, created_at INTEGER NOT NULL
);
CREATE INDEX family_invitation_groups ON family_invitations(group_id,created_at);
CREATE TRIGGER family_invitation_validate BEFORE INSERT ON family_invitations
BEGIN
 SELECT RAISE(ABORT,'family invitation denied') WHERE
 NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.issued_by AND active=1)
 OR EXISTS(SELECT 1 FROM children WHERE user_id=NEW.issued_by)
 OR EXISTS(SELECT 1 FROM home_member_attributes WHERE user_id=NEW.issued_by AND age_kind='child')
 OR (NEW.purpose='create_family' AND NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.issued_by AND platform_role='operator'))
 OR (NEW.purpose<>'create_family' AND NOT EXISTS(
  SELECT 1 FROM memberships m JOIN groups g ON g.id=m.group_id
  WHERE m.group_id=NEW.group_id AND m.user_id=NEW.issued_by AND m.role IN ('owner','admin')
  AND g.kind=CASE NEW.purpose WHEN 'join_family' THEN 'household' ELSE 'sharing' END));
END;
CREATE TRIGGER family_invitation_consume_validate BEFORE INSERT ON family_invitation_uses
BEGIN
 SELECT RAISE(ABORT,'family invitation unavailable') WHERE NOT EXISTS(
 SELECT 1 FROM family_invitations i JOIN users issuer ON issuer.id=i.issued_by AND issuer.active=1
 JOIN users recipient ON recipient.id=NEW.user_id AND recipient.active=1
 WHERE i.id=NEW.invitation_id AND i.revoked_at IS NULL AND i.expires_at>NEW.accepted_at AND i.use_count<i.use_limit
 AND NOT EXISTS(SELECT 1 FROM children WHERE user_id IN (issuer.id,recipient.id))
 AND NOT EXISTS(SELECT 1 FROM home_member_attributes WHERE user_id IN (issuer.id,recipient.id) AND age_kind='child')
 AND ((i.purpose='create_family' AND issuer.platform_role='operator' AND NEW.created_group_id IS NOT NULL
       AND length(trim(NEW.group_name)) BETWEEN 1 AND 60)
 OR (i.purpose<>'create_family' AND NEW.created_group_id IS NULL AND EXISTS(
  SELECT 1 FROM memberships m JOIN groups g ON g.id=m.group_id WHERE m.group_id=i.group_id AND m.user_id=issuer.id
  AND m.role IN ('owner','admin') AND g.kind=CASE i.purpose WHEN 'join_family' THEN 'household' ELSE 'sharing' END)
  AND NOT EXISTS(SELECT 1 FROM memberships WHERE group_id=i.group_id AND user_id=NEW.user_id))));
END;
CREATE TRIGGER family_invitation_consume AFTER INSERT ON family_invitation_uses
BEGIN
 UPDATE family_invitations SET use_count=use_count+1 WHERE id=NEW.invitation_id;
 INSERT INTO groups(id,name,kind,created_by,created_at)
 SELECT NEW.created_group_id,trim(NEW.group_name),'household',NEW.user_id,NEW.accepted_at
 FROM family_invitations WHERE id=NEW.invitation_id AND purpose='create_family';
 INSERT INTO family_workspaces SELECT NEW.created_group_id,'restricted',NEW.accepted_at
 FROM family_invitations WHERE id=NEW.invitation_id AND purpose='create_family';
 INSERT INTO memberships(group_id,user_id,role)
 SELECT CASE purpose WHEN 'create_family' THEN NEW.created_group_id ELSE group_id END,NEW.user_id,
 CASE purpose WHEN 'create_family' THEN 'owner' ELSE 'member' END FROM family_invitations WHERE id=NEW.invitation_id;
 INSERT INTO home_member_attributes(group_id,user_id,age_kind,changed_by,updated_at)
 SELECT CASE purpose WHEN 'create_family' THEN NEW.created_group_id ELSE group_id END,NEW.user_id,'adult',NEW.user_id,
 strftime('%Y-%m-%dT%H:%M:%SZ',NEW.accepted_at,'unixepoch') FROM family_invitations WHERE id=NEW.invitation_id
 ON CONFLICT(group_id,user_id) DO NOTHING;
 INSERT INTO group_apps(group_id,app_id)
 SELECT NEW.created_group_id,id FROM apps WHERE id IN ('calendar','notification') AND enabled=1
 AND EXISTS(SELECT 1 FROM family_invitations WHERE id=NEW.invitation_id AND purpose='create_family');
 INSERT INTO family_audit_events VALUES(NEW.id,NEW.user_id,
 (SELECT CASE purpose WHEN 'create_family' THEN NEW.created_group_id ELSE group_id END FROM family_invitations WHERE id=NEW.invitation_id),
 'invitation.accepted',NEW.invitation_id,NEW.accepted_at);
END;
CREATE TRIGGER family_use_no_update BEFORE UPDATE ON family_invitation_uses
BEGIN
 SELECT RAISE(ABORT,'family audit immutable');
END;
CREATE TRIGGER family_use_no_delete BEFORE DELETE ON family_invitation_uses
BEGIN
 SELECT RAISE(ABORT,'family audit immutable');
END;
CREATE TRIGGER family_audit_no_update BEFORE UPDATE ON family_audit_events
BEGIN
 SELECT RAISE(ABORT,'family audit immutable');
END;
CREATE TRIGGER family_audit_no_delete BEFORE DELETE ON family_audit_events
BEGIN
 SELECT RAISE(ABORT,'family audit immutable');
END;
CREATE TRIGGER family_audit_authorize BEFORE INSERT ON family_audit_events
BEGIN
 SELECT RAISE(ABORT,'family operation denied') WHERE NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.actor_id AND active=1)
 OR EXISTS(SELECT 1 FROM children WHERE user_id=NEW.actor_id)
 OR EXISTS(SELECT 1 FROM home_member_attributes WHERE user_id=NEW.actor_id AND age_kind='child')
 OR (NEW.action IN ('group.apps.changed','invitation.revoked') AND NEW.group_id IS NOT NULL AND NOT EXISTS(
 SELECT 1 FROM memberships WHERE group_id=NEW.group_id AND user_id=NEW.actor_id AND role IN ('owner','admin')))
 OR (NEW.action='invitation.revoked' AND NEW.group_id IS NULL AND NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.actor_id AND platform_role='operator'));
END;
