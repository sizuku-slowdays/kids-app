"""Validate local SQL exports and a trial migration; never connect to production or print records."""
import argparse,hashlib,json,sqlite3,uuid
from pathlib import Path
NEW={'home_karada_links','home_karada_inventory','home_karada_operations','home_karada_changes','home_karada_link_attempts','home_karada_record_trash'}
IGNORE={'sessions','auth_attempts','d1_migrations'}
def load(p):
 raw=p.read_bytes();db=sqlite3.connect(':memory:');db.executescript(raw.decode('utf-8-sig'))
 if db.execute('PRAGMA integrity_check').fetchone()[0]!='ok' or db.execute('PRAGMA foreign_key_check').fetchall():raise ValueError('integrity')
 return db,dict(bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest(),integrity='ok',foreign_key_issues=0)
def tables(db):return {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'")}-IGNORE
def rows(db,t):return sorted(db.execute('SELECT * FROM "'+t.replace('"','""')+'"').fetchall(),key=repr)
def definitions(db):return dict(db.execute("SELECT name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'"))
def compare(before,after,label):
 bt,at=tables(before),tables(after);issues=[]
 if bt!=at:issues.append(dict(database=label,reason='table_set_changed'))
 for t in sorted(bt&at):
  if rows(before,t)!=rows(after,t):issues.append(dict(database=label,table=t,reason='rows_changed'))
 for n,sql in definitions(before).items():
  if n not in IGNORE and definitions(after).get(n)!=sql:issues.append(dict(database=label,object=n,reason='sql_changed'))
 return issues
p=argparse.ArgumentParser();p.add_argument('--folder',required=True);p.add_argument('--mode',choices=['preflight','verify'],default='preflight');a=p.parse_args();folder=Path(a.folder);stage='read backups'
try:
 home,hm=load(folder/'home-before.sql');cal,cm=load(folder/'calendar-before.sql')
 if NEW&tables(cal) or 'body-calendar' in [r[0] for r in home.execute('SELECT id FROM apps')]:raise ValueError('before already upgraded')
 before=sqlite3.connect(':memory:');cal.backup(before)
 stage='trial additive migrations';cal.executescript((folder/'body-home.sql').read_text(encoding='utf-8-sig'));home.executescript((folder/'0026_body_calendar.sql').read_text(encoding='utf-8-sig'))
 if tables(cal)-tables(before)!=NEW:raise ValueError('unexpected tables')
 for t in tables(before):
  if rows(cal,t)!=rows(before,t):raise ValueError('old rows modified')
 for n,sql in definitions(before).items():
  if definitions(cal).get(n)!=sql:raise ValueError('old SQL modified')
 if a.mode=='preflight':
  stage='trial new profiles against actual legacy constraints';cal.execute('SAVEPOINT synthetic')
  for role in ['mama','child']:
   now='2026-10-30T00:00:00.000Z';user='home_'+str(uuid.uuid4());cal.execute('INSERT INTO period_users(username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?)',(user,'Synthetic test','0'*64,role,now));uid=cal.execute('SELECT id FROM period_users WHERE username=?',(user,)).fetchone()[0]
   cal.execute('INSERT INTO period_records(user_id,start_date,end_date,flow_level,pain_level,mood,memo,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',(uid,'2026-10-01','2026-10-04','normal','none','normal','Synthetic',now,now))
   cal.execute('INSERT INTO period_requests(user_id,day_pad,night_pad,heavy_pad,liner,painkiller,memo,urgency,is_read,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',(uid,1,0,0,0,0,'Synthetic','soon',0,now))
   cal.execute('INSERT INTO period_favorites(user_id,memo,created_at) VALUES(?,?,?)',(uid,'Synthetic',now))
  cal.execute('ROLLBACK TO synthetic');cal.execute('RELEASE synthetic');issues=[]
 else:
  stage='compare production exports';ha,ham=load(folder/'home-after-body.sql');ca,cam=load(folder/'calendar-after-body.sql');issues=compare(home,ha,'home')+compare(cal,ca,'calendar')
  for t in NEW:
   if t in tables(ca) and rows(ca,t):issues.append(dict(database='calendar',table=t,reason='already_in_use_review'))
 out=dict(ok=not issues,mode=a.mode,home_before=hm,calendar_before=cm,new_calendar_tables=sorted(NEW),issues=issues,production_changed_by_check=False)
 (folder/('body-'+a.mode+'-safe.json')).write_text(json.dumps(out,indent=2),encoding='utf-8');print(json.dumps(out,indent=2));print('RESULT: '+('PREFLIGHT DATABASE ALL OK' if a.mode=='preflight' else 'EXISTING DATA ALL OK') if not issues else 'RESULT: STOP (comparison requires review)');raise SystemExit(0 if not issues else 1)
except (OSError,sqlite3.Error,UnicodeError,ValueError):
 print('RESULT: STOP');print('Stage: '+stage);print('No SQL values, accounts or record content printed. No production data changed by this checker.');raise SystemExit(1)
