CREATE TABLE home_member_attributes (
 group_id TEXT NOT NULL REFERENCES groups(id), user_id TEXT NOT NULL REFERENCES users(id),
 age_kind TEXT NOT NULL CHECK(age_kind IN ('adult','child','unknown')),
 changed_by TEXT NOT NULL REFERENCES users(id), updated_at TEXT NOT NULL,
 PRIMARY KEY(group_id,user_id)
);
CREATE TABLE home_person_names (
 user_id TEXT PRIMARY KEY REFERENCES users(id), nickname TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL
);
CREATE TABLE home_person_aliases (
 viewer_id TEXT NOT NULL REFERENCES users(id), subject_id TEXT NOT NULL REFERENCES users(id),
 display_name TEXT NOT NULL, PRIMARY KEY(viewer_id,subject_id)
);
CREATE TABLE family_tree_state (
 household_id TEXT PRIMARY KEY REFERENCES groups(id), revision INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE family_tree_people (
 id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES groups(id), home_user_id TEXT REFERENCES users(id),
 name TEXT NOT NULL DEFAULT '', furigana TEXT NOT NULL DEFAULT '', former_name TEXT NOT NULL DEFAULT '',
 gender TEXT NOT NULL DEFAULT 'unknown' CHECK(gender IN ('female','male','other','unknown')),
 birth_date TEXT NOT NULL DEFAULT '', death_date TEXT NOT NULL DEFAULT '', memo TEXT NOT NULL DEFAULT '',
 photo_id TEXT, deleted_at TEXT, created_by TEXT NOT NULL REFERENCES users(id), updated_at TEXT NOT NULL,
 UNIQUE(household_id,home_user_id)
);
CREATE TABLE family_tree_relations (
 id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES groups(id),
 from_person TEXT NOT NULL REFERENCES family_tree_people(id), to_person TEXT NOT NULL REFERENCES family_tree_people(id),
 kind TEXT NOT NULL CHECK(kind IN ('biological_parent','adoptive_parent','guardian','marriage','partnership','sibling')),
 status TEXT NOT NULL DEFAULT 'current' CHECK(status IN ('current','divorced','ended','unknown')),
 start_date TEXT NOT NULL DEFAULT '', end_date TEXT NOT NULL DEFAULT '', memo TEXT NOT NULL DEFAULT '',
 deleted_at TEXT, deleted_with_person TEXT, updated_at TEXT NOT NULL, CHECK(from_person<>to_person)
);
CREATE TABLE family_tree_photos (
 id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES groups(id), object_key TEXT NOT NULL UNIQUE,
 mime_type TEXT NOT NULL CHECK(mime_type IN ('image/jpeg','image/png','image/webp')), byte_size INTEGER NOT NULL,
 uploaded_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL
);
CREATE TABLE family_tree_changes (
 id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES groups(id), actor_id TEXT NOT NULL REFERENCES users(id),
 base_revision INTEGER NOT NULL, approved INTEGER NOT NULL CHECK(approved=1), created_at TEXT NOT NULL
);
CREATE INDEX family_people_household ON family_tree_people(household_id,deleted_at);
CREATE INDEX family_relations_household ON family_tree_relations(household_id,deleted_at);
INSERT INTO apps(id,name,icon,path,enabled,status,position,access_mode)
VALUES('family-tree','家系図','🌳','/apps/family-tree/',1,'ready',9,'group');
INSERT INTO group_apps(group_id,app_id) SELECT id,'family-tree' FROM groups WHERE kind='household';
