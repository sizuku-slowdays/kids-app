"""Read private SQL exports locally. Compare every old passbook row; never modify D1."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import sqlite3

EXPECTED_NEW = {
 'passbook_allowance_plans', 'passbook_allowance_payments',
 'passbook_interest_accounts', 'passbook_interest_policies', 'passbook_interest_payments',
 'passbook_cash_operations', 'passbook_automation_logs', 'passbook_chore_attempts',
 'passbook_chore_cash_repairs', 'passbook_chore_attempt_settlements',
}
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
  if action==sqlite3.SQLITE_PRAGMA and arg1 in ('temp_store_directory','data_store_directory'):return sqlite3.SQLITE_DENY
  return sqlite3.SQLITE_OK
 db.set_authorizer(authorize)
 try:
  db.executescript(Path(path).read_text(encoding='utf-8-sig'))
  if db.execute('PRAGMA integrity_check').fetchall()!=[('ok',)] or db.execute('PRAGMA foreign_key_check').fetchall():raise ValueError()
  tables={}
  for (name,) in db.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall():
   if name.startswith('passbook_'):
    rows=db.execute('SELECT * FROM '+quote(name)).fetchall()
    tables[name]={'schema':db.execute('PRAGMA table_info('+quote(name)+')').fetchall(),'rows':Counter(map(fingerprint,rows)),'count':len(rows)}
  if 'passbook_entries' not in tables:raise ValueError()
  return tables
 finally:db.close()
def compare(before,after):
 issues=[];counts=[]
 for name,old in sorted(before.items()):
  new=after.get(name)
  if new is None:issues.append({'table':name,'reason':'missing_table'});continue
  counts.append({'table':name,'before':old['count'],'after':new['count']})
  if old['schema']!=new['schema']:issues.append({'table':name,'reason':'changed_schema'})
  if old['rows']!=new['rows']:issues.append({'table':name,'reason':'changed_records'})
 additions=set(after)-set(before)
 for name in sorted(additions-EXPECTED_NEW):issues.append({'table':name,'reason':'unexpected_new_table'})
 for name in sorted(EXPECTED_NEW-set(after)):issues.append({'table':name,'reason':'missing_new_table'})
 for name in sorted(additions&EXPECTED_NEW):
  if after[name]['count']:issues.append({'table':name,'reason':'new_table_not_empty_before_setup'})
 return {'ok':not issues,'counts':counts,'issues':issues,'new_tables':sorted(additions),'note':'All old passbook rows compared. Auth sessions and unrelated apps are outside comparison. Compare before any new financial setup.'}
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--before',required=True);parser.add_argument('--after',required=True);args=parser.parse_args()
 try:result=compare(snapshot(args.before),snapshot(args.after))
 except (OSError,sqlite3.Error,ValueError,KeyError):print('{"ok":false,"error":"Unable to verify exports; do not proceed with setup."}');return 2
 print(json.dumps(result,ensure_ascii=False,indent=2));return 0 if result['ok'] else 1
if __name__=='__main__':raise SystemExit(main())
