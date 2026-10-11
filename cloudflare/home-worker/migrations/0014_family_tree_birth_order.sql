ALTER TABLE family_tree_people ADD COLUMN birth_order INTEGER CHECK (birth_order IS NULL OR (birth_order >= 1 AND birth_order <= 1000));
