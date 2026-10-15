"""Read-only local SQL backup verification; never connects to production or prints names/IDs."""
import argparse,json,sqlite3,pathlib,hashlib
p=argparse.ArgumentParser();p.add_argument('sql');p.add_argument('--login',required=True);p.add_argument('--day',default='2026-10-14');a=p.parse_args()
f=pathlib.Path(a.sql);raw=f.read_bytes();db=sqlite3.connect(':memory:');db.row_factory=sqlite3.Row
try:
 db.executescript(raw.decode('utf-8-sig'))
 integrity=db.execute('PRAGMA integrity_check').fetchone()[0];foreign=db.execute('PRAGMA foreign_key_check').fetchall()
 users=db.execute("SELECT u.id,m.group_id FROM users u JOIN memberships m ON m.user_id=u.id JOIN groups g ON g.id=m.group_id WHERE u.login_name=? COLLATE NOCASE AND m.role IN ('owner','admin') AND g.kind='household'",(a.login,)).fetchall()
 result={'file_bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'integrity':integrity,'foreign_key_issues':len(foreign),'households':[]}
 tables={r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
 for user in users:
  h,uid=user['group_id'],user['id'];rows=db.execute("SELECT d.id,d.money,d.kind FROM passbook_chore_days d WHERE d.household_id=? AND d.day=? AND d.target=?",(h,a.day,'user:'+uid)).fetchall()
  complete=[r for r in rows if r['kind']=='complete'];cash=[]
  for r in complete:
   paid=db.execute("SELECT COALESCE(SUM(e.delta),0) FROM passbook_adult_entries e JOIN passbook_adult_accounts ac ON ac.id=e.account_id JOIN passbook_units u ON u.id=ac.unit_id WHERE e.household_id=? AND ac.owner_user_id=? AND u.code='cash' AND u.kind='money' AND e.source_app='chores' AND e.source_event=?",(h,uid,r['id'])).fetchone()[0]
   cash.append({'recorded_reward':r['money'],'credited':paid,'unpaid':max(0,r['money']-paid)})
  skipped=db.execute("SELECT COUNT(*) FROM passbook_chore_days WHERE household_id=? AND day=? AND assigned_to=? AND kind='skip'",(h,a.day,'user:'+uid)).fetchone()[0]
  pending=db.execute("SELECT COUNT(*) FROM passbook_chore_attempts WHERE household_id=? AND day=? AND target=? AND status='pending'",(h,a.day,'user:'+uid)).fetchone()[0] if 'passbook_chore_attempts' in tables else 0
  result['households'].append({'completed_records':len(complete),'skipped_assignments':skipped,'pending_attempts':pending,'cash_reconciliation':cash,'action':'recorded_data_available_for_review' if complete or pending else 'no_evidence_do_not_credit'})
 result['ok']=integrity=='ok' and not foreign and bool(users);print(json.dumps(result,ensure_ascii=False,indent=2));raise SystemExit(0 if result['ok'] else 1)
finally:db.close()
