-- App registration only. Health records remain in calendar-db.
INSERT INTO apps(id,name,icon,path,enabled,status,position,access_mode)
VALUES('body-calendar','からだカレンダー','🌸','/apps/body-calendar/',1,'ready',18,'group');
INSERT INTO group_apps(group_id,app_id)
SELECT id,'body-calendar' FROM groups WHERE kind='household' AND NOT EXISTS(SELECT 1 FROM family_workspaces w WHERE w.group_id=groups.id);
-- Keep existing simplified adult HOME layouts intact. This controls display, never API authority.
INSERT INTO user_apps(user_id,app_id,visible,position)
SELECT m.user_id,'body-calendar',MAX(CASE WHEN m.role IN ('owner','admin')
 OR EXISTS(SELECT 1 FROM children c WHERE c.user_id=m.user_id)
 OR EXISTS(SELECT 1 FROM home_member_attributes a WHERE a.user_id=m.user_id AND a.age_kind='child') THEN 1 ELSE 0 END),18
FROM memberships m JOIN users u ON u.id=m.user_id AND u.active=1
JOIN group_apps ga ON ga.group_id=m.group_id AND ga.app_id='body-calendar'
GROUP BY m.user_id;
