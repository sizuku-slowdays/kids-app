"""Strict offline comparison before invitations or HOME editing are enabled/used."""
import argparse
from collections import Counter
import hashlib
import importlib.util
import json
from pathlib import Path

_spec=importlib.util.spec_from_file_location('family_audit',Path(__file__).with_name('audit-multi-family.py'))
_audit=importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_audit)
NEW={'family_workspaces','family_invitations','family_invitation_uses','family_audit_events','home_layout_versions','home_layout_operations'}
IGNORE={'sessions','auth_attempts','d1_migrations'}
def fingerprint(row):
    data=[(type(v).__name__,v.hex() if isinstance(v,bytes) else v) for v in row]
    return hashlib.sha256(json.dumps(data,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()
def snapshot(path):
    db,metadata=_audit.open_export(path)
    try:
        if metadata['integrity']!='ok' or metadata['foreign_key_issues']:raise ValueError('integrity')
        result={}
        for name in metadata['table_counts']:
            q='"'+name.replace('"','""')+'"'
            result[name]={'schema':[tuple(r) for r in db.execute('PRAGMA table_info('+q+')')],
                          'rows':Counter(fingerprint(r) for r in db.execute('SELECT * FROM '+q)),
                          'count':metadata['table_counts'][name]}
        return result
    finally:db.close()
def compare(before,after,profile):
    issues=[];counts=[]
    for name in sorted(set(before)-IGNORE):
        if name not in after:issues.append({'table':name,'reason':'missing_table'});continue
        a,b=before[name],after[name]
        counts.append({'table':name,'before':a['count'],'after':b['count']})
        if a['schema']!=b['schema']:issues.append({'table':name,'reason':'schema_changed'})
        if a['rows']!=b['rows']:issues.append({'table':name,'reason':'records_changed_review_required'})
    expected=NEW if profile=='home' else set()
    for name in sorted(expected-set(after)):issues.append({'table':name,'reason':'missing_new_table'})
    for name in sorted(set(after)-set(before)-expected-IGNORE):issues.append({'table':name,'reason':'unexpected_table'})
    for name in sorted((set(after)-set(before))&expected):
        if after[name]['count']:issues.append({'table':name,'reason':'new_feature_used_before_verification'})
    return {'ok':not issues,'profile':profile,'counts':counts,'issues':issues,'new_tables':sorted(set(after)-set(before)),
            'note':'No row values are shown. Natural app use may require review; never repair or overwrite data automatically.'}
def main():
    p=argparse.ArgumentParser();p.add_argument('--before',required=True);p.add_argument('--after',required=True);p.add_argument('--profile',choices=['home','calendar'],required=True);a=p.parse_args()
    try:r=compare(snapshot(a.before),snapshot(a.after),a.profile)
    except Exception:print('{"ok":false,"error":"Offline verification stopped. No files or production data changed."}');return 2
    print(json.dumps(r,ensure_ascii=False,indent=2));return 0 if r['ok'] else 1
if __name__=='__main__':raise SystemExit(main())
