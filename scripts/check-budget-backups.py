"""Offline backup/restore rehearsal and additive-schema comparison. Never connects to a service."""
import argparse,json,sqlite3,hashlib
from pathlib import Path
IGNORED={'d1_migrations','sessions','auth_attempts'}
def load(path):
 raw=Path(path).read_bytes();db=sqlite3.connect(':memory:');db.executescript(raw.decode('utf-8-sig'))
 if db.execute('PRAGMA integrity_check').fetchone()[0]!='ok' or db.execute('PRAGMA foreign_key_check').fetchall():raise ValueError('integrity')
 return db,{'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'integrity':'ok'}
def tables(db):return {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'")}
def rows(db,name):return sorted(db.execute('SELECT * FROM "'+name.replace('"','""')+'"').fetchall(),key=repr)
def compare(a,b):
 issues=[]
 if tables(a)!=tables(b):issues.append({'reason':'table_set_changed'})
 for name in sorted((tables(a)&tables(b))-IGNORED):
  if rows(a,name)!=rows(b,name):issues.append({'reason':'rows_changed','table':name})
 defs=lambda d:dict(d.execute("SELECT name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'"))
 aa,bb=defs(a),defs(b)
 for name,sql in aa.items():
  if name not in IGNORED and bb.get(name)!=sql:issues.append({'reason':'schema_changed','object':name})
 return issues
def check(before,migration,after=None,legacy_before=None,legacy_after=None):
 db,meta=load(before);restore=sqlite3.connect(':memory:');restore.executescript('\n'.join(db.iterdump()));issues=compare(db,restore)
 if issues:raise ValueError('restore rehearsal')
 db.executescript(Path(migration).read_text(encoding='utf-8-sig'))
 for name in ['budget_states','budget_operations']:
  if db.execute('SELECT COUNT(*) FROM '+name).fetchone()[0]:raise ValueError('new tables not empty')
 if after:
  actual,_=load(after);issues+=compare(db,actual)
 if legacy_before:
  old,legacy_meta=load(legacy_before);again=sqlite3.connect(':memory:');again.executescript('\n'.join(old.iterdump()))
  if compare(old,again):raise ValueError('legacy restore rehearsal')
  if legacy_after:
   actual,_=load(legacy_after);issues+=compare(old,actual)
 return {'ok':not issues,'backup':meta,'restore_rehearsal':'ok','issues':issues,'production_changed':False}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--before',required=True);p.add_argument('--migration',required=True);p.add_argument('--after');p.add_argument('--legacy-before');p.add_argument('--legacy-after');a=p.parse_args()
 try:
  result=check(a.before,a.migration,a.after,a.legacy_before,a.legacy_after);print(json.dumps(result,indent=2));print('RESULT: BACKUP AND DATA OK' if result['ok'] else 'RESULT: STOP');raise SystemExit(0 if result['ok'] else 1)
 except (OSError,UnicodeError,sqlite3.Error,ValueError):print('RESULT: STOP (offline backup/schema validation)');raise SystemExit(1)
