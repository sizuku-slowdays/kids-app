"""Offline read-only calendar rollout audit. Never prints private row values."""
import argparse
import importlib.util
import json
from pathlib import Path
spec=importlib.util.spec_from_file_location('audit',Path(__file__).with_name('audit-multi-family.py'))
audit=importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)
def check(before,after=None,profile='home'):
 opened=[]
 try:
  db,info=audit.open_export(before);opened.append(db)
  assert info['integrity']=='ok' and info['foreign_key_issues']==0,'Invalid backup'
  required={'home':{'users','groups','memberships','children'},'calendar':{'calendar_events','calendars','home_event_visibility'},'notifications':{'notification_rules','push_subscriptions','home_notification_subscriptions'}}[profile]
  assert required<=set(info['table_counts']),'Required tables missing'
  result={'ok':True,'profile':profile,'integrity':'ok','foreign_key_issues':0,'sha256':info['sha256'],'file_bytes':info['file_bytes']}
  if after:
   later,other=audit.open_export(after);opened.append(later)
   assert other['integrity']=='ok' and other['foreign_key_issues']==0,'Invalid after backup'
   # Runtime auth activity and delivery logs can continue while settings/old data stay unchanged.
   ignored={'sessions','auth_attempts','d1_migrations','notification_logs','habit_completions'}
   issues=[]
   for table in set(info['table_counts'])-ignored:
    quote='"'+table.replace('"','""')+'"'
    def signature(conn):
     schema=conn.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name=?",(table,)).fetchone()
     if not schema:return None
     return (schema[0],sorted(json.dumps(list(r),ensure_ascii=True,default=str) for r in conn.execute('SELECT * FROM '+quote)))
    if signature(db)!=signature(later):issues.append({'table':table,'reason':'changed_records_or_schema'})
   expected={'home_event_options'} if profile=='calendar' else set()
   added=set(other['table_counts'])-set(info['table_counts'])-ignored
   issues.extend({'table':t,'reason':'unexpected_new_table'} for t in sorted(added-expected))
   if profile=='calendar':
    if 'home_event_options' not in other['table_counts']:issues.append({'table':'home_event_options','reason':'worker_update_not_confirmed'})
    elif 'home_event_options' not in info['table_counts'] and other['table_counts']['home_event_options']!=0:issues.append({'table':'home_event_options','reason':'feature_used_before_verification'})
   result.update(ok=not issues,issues=issues,after_sha256=other['sha256'])
  return result
 finally:
  for db in opened:db.close()
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--before',required=True);parser.add_argument('--after');parser.add_argument('--profile',choices=['home','calendar','notifications'],required=True);args=parser.parse_args()
 try:
  result=check(args.before,args.after,args.profile);print(json.dumps(result,indent=2));raise SystemExit(0 if result['ok'] else 1)
 except Exception as error:
  print(json.dumps({'ok':False,'reason':type(error).__name__}));raise SystemExit(1)
