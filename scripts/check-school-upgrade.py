"""Verify private before/after SQL exports locally; never connect to production."""
import argparse
from collections import Counter
import hashlib,json,sqlite3
from pathlib import Path
def quote(name):
 return '"'+name.replace('"','""')+'"'
def fingerprint(row):
 data=[[type(v).__name__,v.hex() if isinstance(v,bytes) else v] for v in row]
 return hashlib.sha256(json.dumps(data,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()

def snapshot(path):
 db=sqlite3.connect(':memory:')
 def authorize(action,arg1,arg2,*_):
  if action in (sqlite3.SQLITE_ATTACH,sqlite3.SQLITE_DETACH):return sqlite3.SQLITE_DENY
  if action==sqlite3.SQLITE_FUNCTION and str(arg2).lower() in ('load_extension','readfile','writefile'):return sqlite3.SQLITE_DENY
  return sqlite3.SQLITE_OK
 db.set_authorizer(authorize)
 try:
  db.executescript(Path(path).read_text(encoding='utf-8-sig'))
  if db.execute('PRAGMA integrity_check').fetchall()!=[('ok',)] or db.execute('PRAGMA foreign_key_check').fetchall():raise ValueError('integrity')
  result={}
  for (name,) in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").fetchall():
   values=db.execute('SELECT * FROM '+quote(name)).fetchall()
   result[name]={'schema':db.execute('PRAGMA table_info('+quote(name)+')').fetchall(),'rows':Counter(map(fingerprint,values)),'count':len(values),'values':values}
  return result
 finally:db.close()
HOME_NEW={'learning_school_versions','learning_school_checks','learning_school_receipts','learning_school_preferences','learning_school_deliveries'}
IGNORE={'sessions','auth_attempts','d1_migrations'}
def compare(before,after,profile):
 issues=[];counts=[]
 focus=set(before)-IGNORE if profile=='home' else {'push_subscriptions','notification_rules','home_notification_subscriptions','home_notification_only_endpoints'} & set(before)
 for name in sorted(focus):
  if name not in after:issues.append({'table':name,'reason':'missing_table'});continue
  a,b=before[name],after[name]
  counts.append({'table':name,'before':a['count'],'after':b['count']})
  if a['schema']!=b['schema']:issues.append({'table':name,'reason':'changed_schema'})
  if name in {'apps','group_apps'} and profile=='home':
   if a['rows']-b['rows']:issues.append({'table':name,'reason':'old_rows_changed'})
   columns=[c[1] for c in b['schema']]; key='id' if name=='apps' else 'app_id'
   for row in b['values']:
    if fingerprint(row) not in a['rows'] and row[columns.index(key)]!='school-prep':issues.append({'table':name,'reason':'unrelated_added_row'})
  elif a['rows']!=b['rows']:issues.append({'table':name,'reason':'changed_records'})
 expected=HOME_NEW if profile=='home' else {'school_push_deliveries'}
 for name in sorted(expected):
  if name not in after:issues.append({'table':name,'reason':'missing_new_table'})
  elif name not in before and after[name]['count']:issues.append({'table':name,'reason':'new_table_not_empty_before_use'})
 for name in sorted(set(after)-set(before)-expected-IGNORE):issues.append({'table':name,'reason':'unexpected_table'})
 return {'ok':not issues,'profile':profile,'counts':counts,'issues':issues,'new_tables':sorted(set(after)-set(before)),'note':'No record values shown. Verify before setting up or using the new app. Existing auth activity is excluded.'}
def main():
 p=argparse.ArgumentParser();p.add_argument('--profile',choices=['home','notifications'],required=True);p.add_argument('--before',required=True);p.add_argument('--after',required=True);a=p.parse_args()
 try:r=compare(snapshot(a.before),snapshot(a.after),a.profile)
 except Exception:print('{"ok":false,"error":"Backup verification failed. Do not continue."}');return 2
 print(json.dumps(r,ensure_ascii=False,indent=2));return 0 if r['ok'] else 1
if __name__=='__main__':raise SystemExit(main())
