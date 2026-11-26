-- Additive migration: existing accounts, friendships and messages are unchanged.
CREATE TABLE IF NOT EXISTS family_groups(id TEXT PRIMARY KEY, family_id TEXT NOT NULL, creator_id TEXT NOT NULL, created_at INTEGER NOT NULL, UNIQUE(family_id,creator_id));
CREATE TABLE IF NOT EXISTS family_group_members(group_id TEXT NOT NULL, account_id TEXT NOT NULL, PRIMARY KEY(group_id,account_id));
CREATE TABLE IF NOT EXISTS family_group_messages(seq INTEGER PRIMARY KEY AUTOINCREMENT, group_id TEXT NOT NULL, author_id TEXT NOT NULL, nonce TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN('text','standard')), text TEXT NOT NULL, created_at INTEGER NOT NULL, UNIQUE(author_id,nonce));
CREATE INDEX IF NOT EXISTS family_group_history ON family_group_messages(group_id,seq);
