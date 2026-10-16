"""Read a local private D1 SQL export; no remote connection or record values printed."""
import argparse,hashlib,json,sqlite3
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('backup');a=p.parse_args();source=Path(a.backup);db=sqlite3.connect(':memory:')
def guard(action,arg1,arg2,*args):
 if action in (sqlite3.SQLITE_ATTACH,sqlite3.SQLITE_DETACH):return sqlite3.SQLITE_DENY
 if action==sqlite3.SQLITE_FUNCTION and str(arg2).lower() in ('load_extension','readfile','writefile'):return sqlite3.SQLITE_DENY
 return sqlite3.SQLITE_OK
db.set_authorizer(guard)
try:
 raw=source.read_bytes();db.executescript(raw.decode('utf-8-sig'));db.execute('PRAGMA query_only=ON')
 integrity=db.execute('PRAGMA integrity_check').fetchall()==[('ok',)];fk=len(db.execute('PRAGMA foreign_key_check').fetchall());result={'integrity':'ok' if integrity else 'failed','foreign_key_issues':fk,'sha256':hashlib.sha256(raw).hexdigest(),'accounts_checked':0,'entries_checked':0,'invalid_dates':0,'unsafe_numbers':0,'legacy_adjustment_entries':0,'uncertain_legacy_dates':0,'accounts_with_negative_running_balance':0}
 for table,accounts in [('passbook_entries','passbook_accounts'),('passbook_adult_entries','passbook_adult_accounts')]:
  for account, in db.execute('SELECT id FROM '+accounts).fetchall():
   result['accounts_checked']+=1;balance=0;negative=False
   rows=db.execute("SELECT delta,julianday(occurred_at),source_app,date(occurred_at,'+9 hours') FROM "+table+" WHERE account_id=? ORDER BY julianday(occurred_at),rowid",(account,)).fetchall()
   expected=db.execute('SELECT COALESCE(SUM(delta),0) FROM '+table+' WHERE account_id=?',(account,)).fetchone()[0]
   for delta,stamp,source_app,day in rows:
    result['entries_checked']+=1;result['invalid_dates']+=int(stamp is None);result['legacy_adjustment_entries']+=int(source_app=='legacy-opening');result['uncertain_legacy_dates']+=int(source_app.startswith('legacy-') and source_app!='legacy-opening' and day is not None and day<'1971-01-01');balance+=delta;negative|=balance<0
    result['unsafe_numbers']+=int(not isinstance(delta,int) or abs(delta)>9007199254740991 or abs(balance)>9007199254740991)
   if balance!=expected:result['unsafe_numbers']+=1
   result['accounts_with_negative_running_balance']+=int(negative)
 result['ok']=integrity and fk==0 and result['invalid_dates']==0 and result['unsafe_numbers']==0
 result['note']='Opening adjustments and uncertain legacy dates are reported, never repaired. No production or local backup content changed.'
 print(json.dumps(result,ensure_ascii=False,indent=2));raise SystemExit(0 if result['ok'] else 1)
except (sqlite3.Error,UnicodeError,OSError):
 print('{"ok":false,"error":"Local backup audit failed; no production data changed."}');raise SystemExit(2)
finally:db.close()
