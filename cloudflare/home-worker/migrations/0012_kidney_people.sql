UPDATE apps SET name='じいちゃん', icon='👴', path='/apps/kidney/?person=grandpa' WHERE id='kidney';
INSERT OR IGNORE INTO apps(id,name,icon,path,enabled,status,position,access_mode)
VALUES('kidney-grandma','ばあちゃん','👵','/apps/kidney/?person=grandma',1,'ready',8,'group');
INSERT OR IGNORE INTO group_apps(group_id,app_id)
SELECT id,'kidney-grandma' FROM groups WHERE kind='household';
