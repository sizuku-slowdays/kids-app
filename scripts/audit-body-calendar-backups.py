"""Read-only local export validation. No names, user IDs, records, tokens or password values are printed."""
import argparse,hashlib,json,sqlite3
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--folder',required=True);a=p.parse_args();folder=Path(a.folder)
def load(name):
 raw=(folder/name).read_bytes();db=sqlite3.connect(':memory:');db.executescript(raw.decode('utf-8-sig'))
 if db.execute('PRAGMA integrity_check').fetchone()[0]!='ok' or db.execute('PRAGMA foreign_key_check').fetchall():raise ValueError('Backup integrity or foreign-key check failed')
 return db,dict(bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest(),integrity='ok',foreign_key_issues=0)
try:
 home,hm=load('home-before.sql');calendar,cm=load('calendar-before.sql');tables={x[0] for x in calendar.execute("SELECT name FROM sqlite_master WHERE type='table'")};required={'period_users','period_records','period_requests','period_favorites','period_inventory'}
 if not required<=tables:raise ValueError('Required existing period tables were not found')
 schema={}
 for name in sorted(required):
  columns=[dict(name=r[1],type=r[2],not_null=bool(r[3]),primary_key=r[5]) for r in calendar.execute('PRAGMA table_info("'+name+'")')]
  unique=[]
  for row in calendar.execute('PRAGMA index_list("'+name+'")'):
   if row[2]:unique.append([c[2] for c in calendar.execute('PRAGMA index_info("'+row[1].replace('"','""')+'")')])
  schema[name]=dict(columns=columns,unique_columns=unique,row_count=calendar.execute('SELECT COUNT(*) FROM "'+name+'"').fetchone()[0])
 result=dict(ok=True,home=hm,calendar=cm,period_schema=schema,home_active_users=home.execute('SELECT COUNT(*) FROM users WHERE active=1').fetchone()[0],home_households=home.execute("SELECT COUNT(*) FROM groups WHERE kind='household'").fetchone()[0],note='Only schema and aggregate counts. No production changes. No automatic user matching.')
 (folder/'summary-safe-to-share.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');print('RESULT: BACKUPS AND SCHEMA ALL OK');print('Summary: '+str(folder/'summary-safe-to-share.json'))
except (sqlite3.Error,ValueError,OSError,UnicodeError):
 print('RESULT: STOP (local validation failed; no private records printed)');raise SystemExit(1)
