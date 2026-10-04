INSERT OR IGNORE INTO apps(id,name,icon,path,enabled,status,position,access_mode)
VALUES('play-agreement','遊ぶやくそく','🤝','/apps/play-agreement/',1,'ready',8,'personal');

UPDATE apps
SET name='遊ぶやくそく',icon='🤝',path='/apps/play-agreement/',enabled=1,status='ready',position=8,access_mode='personal'
WHERE id='play-agreement';

INSERT OR IGNORE INTO personal_app_access(user_id,app_id)
SELECT id,'play-agreement' FROM users WHERE id='bootstrap-admin';
