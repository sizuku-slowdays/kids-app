CREATE TABLE IF NOT EXISTS home_account_links(home_user_id TEXT PRIMARY KEY, account_id TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS home_launch_used(nonce TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
