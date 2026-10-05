CREATE TABLE home_preferences (
 user_id TEXT PRIMARY KEY REFERENCES users(id),
 favorite_app_ids TEXT NOT NULL
);
