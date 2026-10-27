PRAGMA foreign_keys=ON;
CREATE TABLE accounts (
 id TEXT PRIMARY KEY, login TEXT NOT NULL UNIQUE, alias TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('guardian','child')), salt TEXT NOT NULL, password_hash TEXT NOT NULL,
 recovery_hash TEXT, active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), created_at INTEGER NOT NULL, deleted_at INTEGER
);
CREATE TABLE families(id TEXT PRIMARY KEY, created_at INTEGER NOT NULL);
CREATE TABLE family_guardians(family_id TEXT NOT NULL REFERENCES families(id),guardian_id TEXT NOT NULL REFERENCES accounts(id),PRIMARY KEY(family_id,guardian_id));
CREATE TABLE guardian_children (
 guardian_id TEXT NOT NULL REFERENCES accounts(id), child_id TEXT NOT NULL REFERENCES accounts(id),
 family_id TEXT NOT NULL REFERENCES families(id), PRIMARY KEY(guardian_id,child_id)
);
CREATE INDEX managed_children ON guardian_children(child_id);
CREATE TABLE consent_events(id TEXT PRIMARY KEY,guardian_id TEXT NOT NULL REFERENCES accounts(id),child_id TEXT,version TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE child_settings (
 child_id TEXT PRIMARY KEY REFERENCES accounts(id), paused INTEGER NOT NULL DEFAULT 0 CHECK(paused IN(0,1)),
 photos_enabled INTEGER NOT NULL DEFAULT 0 CHECK(photos_enabled IN(0,1)),
 timezone TEXT NOT NULL DEFAULT 'Asia/Tokyo', schedule_json TEXT NOT NULL DEFAULT '[[],[],[],[],[],[],[]]' CHECK(json_valid(schedule_json)),
 revision INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE sessions(id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE,account_id TEXT NOT NULL REFERENCES accounts(id),device TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,revoked INTEGER NOT NULL DEFAULT 0);
CREATE INDEX sessions_account ON sessions(account_id);
CREATE TABLE rate_buckets(key TEXT PRIMARY KEY,n INTEGER NOT NULL,expires_at INTEGER NOT NULL);
CREATE TABLE invitations (
 id TEXT PRIMARY KEY,token_hash TEXT NOT NULL UNIQUE,issuer_id TEXT NOT NULL REFERENCES accounts(id),child_id TEXT NOT NULL REFERENCES accounts(id),
 expires_at INTEGER NOT NULL,used INTEGER NOT NULL DEFAULT 0 CHECK(used IN(0,1)),revoked INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL
);
CREATE TABLE friendships (
 id TEXT PRIMARY KEY,left_child TEXT NOT NULL REFERENCES accounts(id),right_child TEXT NOT NULL REFERENCES accounts(id),
 left_approved INTEGER NOT NULL DEFAULT 0 CHECK(left_approved IN(0,1)),right_approved INTEGER NOT NULL DEFAULT 0 CHECK(right_approved IN(0,1)),
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN('pending','active','ended','blocked')),
 created_at INTEGER NOT NULL,CHECK(left_child<right_child)
);
CREATE UNIQUE INDEX live_friend_pair ON friendships(left_child,right_child) WHERE state IN('pending','active');
CREATE TABLE blocks(child_id TEXT NOT NULL REFERENCES accounts(id),peer_id TEXT NOT NULL REFERENCES accounts(id),created_at INTEGER NOT NULL,PRIMARY KEY(child_id,peer_id));
CREATE TABLE media (
 id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES accounts(id),friendship_id TEXT REFERENCES friendships(id),
 kind TEXT NOT NULL CHECK(kind IN('photo','stamp')),label TEXT NOT NULL,
 object_key TEXT NOT NULL UNIQUE,status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN('pending','approved','rejected','disabled','deleted')),
 width INTEGER NOT NULL,height INTEGER NOT NULL,bytes INTEGER NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,reviewer_id TEXT REFERENCES accounts(id)
);
CREATE TABLE messages (
 seq INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT NOT NULL UNIQUE,friendship_id TEXT NOT NULL REFERENCES friendships(id),author_id TEXT NOT NULL REFERENCES accounts(id),
 nonce TEXT NOT NULL,payload_hash TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN('text','standard','stamp','photo','removed')),
 text TEXT NOT NULL DEFAULT '',media_id TEXT REFERENCES media(id),created_at INTEGER NOT NULL,
 UNIQUE(author_id,nonce)
);
CREATE INDEX chat_messages ON messages(friendship_id,seq);
CREATE TABLE read_cursors(friendship_id TEXT NOT NULL REFERENCES friendships(id),child_id TEXT NOT NULL REFERENCES accounts(id),last_seq INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(friendship_id,child_id));
CREATE TABLE audit_events(id TEXT PRIMARY KEY,actor_id TEXT,action TEXT NOT NULL,target_id TEXT,created_at INTEGER NOT NULL);
-- Critical friendship state is checked again at the SQLite mutation boundary.
CREATE TRIGGER message_authorized BEFORE INSERT ON messages BEGIN
 SELECT CASE WHEN NOT EXISTS(
  SELECT 1 FROM friendships f JOIN accounts a ON a.id=NEW.author_id
  JOIN child_settings s ON s.child_id=a.id
  WHERE f.id=NEW.friendship_id AND f.state='active' AND f.left_approved=1 AND f.right_approved=1
  AND a.active=1 AND a.role='child' AND s.paused=0 AND a.id IN(f.left_child,f.right_child)
  AND EXISTS(SELECT 1 FROM accounts p JOIN child_settings ps ON ps.child_id=p.id WHERE p.id=CASE WHEN a.id=f.left_child THEN f.right_child ELSE f.left_child END AND p.active=1 AND ps.paused=0)
  AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.child_id=f.left_child AND b.peer_id=f.right_child) OR (b.child_id=f.right_child AND b.peer_id=f.left_child))
 ) THEN RAISE(ABORT,'chat_access_changed') END;
 SELECT CASE WHEN NEW.kind IN('photo','stamp') AND NOT EXISTS(
  SELECT 1 FROM media m WHERE m.id=NEW.media_id AND m.owner_id=NEW.author_id AND m.status='approved' AND m.kind=NEW.kind AND m.expires_at>NEW.created_at
  AND (m.kind='stamp' OR (m.friendship_id=NEW.friendship_id AND (SELECT photos_enabled FROM child_settings WHERE child_id=NEW.author_id)=1))
 ) THEN RAISE(ABORT,'media_not_approved') END;
END;
