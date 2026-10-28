#!/usr/bin/env python3
"""Read local D1 SQL exports only. Never connect to Cloudflare or repair rows."""
import argparse,hashlib,json,sqlite3
from pathlib import Path
NEW={'passbook_chore_records','passbook_chore_record_payments'}
def load(path):
    raw=Path(path).read_bytes();db=sqlite3.connect(':memory:');db.executescript(raw.decode('utf-8-sig'))
    integrity=db.execute('PRAGMA integrity_check').fetchone()[0]
    fk=len(db.execute('PRAGMA foreign_key_check').fetchall())
    if integrity!='ok' or fk: raise ValueError('Backup integrity or foreign-key check failed')
    return db,{'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'integrity':integrity,'foreign_key_issues':fk}
def tables(db):return {name:sql for name,sql in db.execute("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'")}
def rows(db,name):return sorted(db.execute('SELECT * FROM "'+name.replace('"','""')+'"').fetchall(),key=repr)
def protected(name):return name.startswith(('passbook_','good_deed_')) or name in {'users','children','groups','memberships','group_apps'}
p=argparse.ArgumentParser();p.add_argument('--before',required=True);p.add_argument('--after');a=p.parse_args()
try:
    before,meta=load(a.before);bt=tables(before)
    if NEW&bt.keys():raise ValueError('The BEFORE export already has the new tables; stop and review, never reset')
    if not {'passbook_chores','passbook_chore_days','passbook_entries','passbook_adult_entries','passbook_chore_attempts'}<=bt.keys():raise ValueError('Expected HOME passbook tables were not found')
    out={'ok':True,'before':meta,'production_changed_by_check':False}
    if a.after:
        after,am=load(a.after);at=tables(after);issues=[];counts=[]
        for name in sorted(n for n in bt if protected(n)):
            if name not in at:issues.append({'table':name,'reason':'missing'});continue
            b,r=rows(before,name),rows(after,name);counts.append({'table':name,'before':len(b),'after':len(r)})
            if bt[name]!=at[name]:issues.append({'table':name,'reason':'schema_changed'})
            if b!=r:issues.append({'table':name,'reason':'rows_changed'})
        for name in sorted(at.keys()-bt.keys()-NEW):issues.append({'table':name,'reason':'unexpected_new_table'})
        old_objects=dict(before.execute("SELECT name,sql FROM sqlite_master WHERE name LIKE 'passbook_%' AND sql IS NOT NULL"));new_objects=dict(after.execute("SELECT name,sql FROM sqlite_master WHERE name LIKE 'passbook_%' AND sql IS NOT NULL"))
        for name,sql in old_objects.items():
            if new_objects.get(name)!=sql:issues.append({'table':name,'reason':'existing_sql_changed'})
        for name in sorted(NEW):
            if name not in at:issues.append({'table':name,'reason':'new_table_missing'})
            elif rows(after,name):issues.append({'table':name,'reason':'already_in_use_review_without_reset'})
        out.update(ok=not issues,after=am,counts=counts,issues=issues,new_tables=sorted(at.keys()-bt.keys()))
        after.close()
    before.close();print(json.dumps(out,ensure_ascii=False,indent=2))
    raise SystemExit(0 if out['ok'] else 1)
except (ValueError,sqlite3.Error,UnicodeError,OSError):
    print('RESULT: STOP (backup validation failed; no records printed or repaired)');raise SystemExit(1)
