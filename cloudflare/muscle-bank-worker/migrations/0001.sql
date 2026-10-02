CREATE TABLE IF NOT EXISTS muscle_states (
  owner_id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 0,
  state_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
-- HOME利用者のIDをキーにする。家庭の共有ポイント、銀行残高は参照・更新しない。
