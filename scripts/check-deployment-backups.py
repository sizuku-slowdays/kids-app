#!/usr/bin/env python3
"""Read two private D1 SQL exports in memory; never print records or modify D1."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import sqlite3

NEW_TABLES = {
    'home': {'home_member_attributes', 'home_person_names', 'home_person_aliases',
             'family_tree_state', 'family_tree_people', 'family_tree_relations',
             'family_tree_photos', 'family_tree_changes'},
    'calendar': {'home_calendar_acl', 'home_calendar_participation',
                 'home_event_visibility', 'home_calendar_policy_backups',
                 'home_calendar_notification_locks'},
}


def quote(name):
    return '"' + name.replace('"', '""') + '"'


def row_hash(row):
    values = [[type(v).__name__, v.hex() if isinstance(v, bytes) else v] for v in row]
    return hashlib.sha256(json.dumps(values, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()


def snapshot(path):
    db = sqlite3.connect(':memory:')
    # SQL exports are data inputs. Disallow access to other databases/files.
    def authorize(action, arg1, arg2, *_):
        if action in (sqlite3.SQLITE_ATTACH, sqlite3.SQLITE_DETACH):
            return sqlite3.SQLITE_DENY
        if action == sqlite3.SQLITE_PRAGMA and arg1 in ('temp_store_directory', 'data_store_directory'):
            return sqlite3.SQLITE_DENY
        if action == sqlite3.SQLITE_FUNCTION and str(arg2).lower() in ('load_extension', 'writefile', 'readfile'):
            return sqlite3.SQLITE_DENY
        return sqlite3.SQLITE_OK
    db.set_authorizer(authorize)
    try:
        db.executescript(Path(path).read_text(encoding='utf-8'))
        check = db.execute('PRAGMA integrity_check').fetchall()
        if check != [('ok',)]:
            raise ValueError('SQL export failed integrity check')
        tables = {}
        names = db.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").fetchall()
        for (name,) in names:
            if name.startswith('sqlite_') or name in ('_cf_KV', 'd1_migrations'):
                continue
            schema = list(db.execute('PRAGMA table_info(' + quote(name) + ')'))
            columns = [r[1] for r in schema]
            rows = list(db.execute('SELECT * FROM ' + quote(name)))
            tables[name] = {'columns': columns, 'schema': schema, 'rows': Counter(map(row_hash, rows)),
                            'raw': rows, 'count': len(rows)}
        return tables
    finally:
        db.close()


def compare(before, after, profile):
    issues, counts = [], []
    for name, old in before.items():
        new = after.get(name)
        if new is None:
            issues.append({'table': name, 'reason': 'missing_table'})
            continue
        counts.append({'table': name, 'before': old['count'], 'after': new['count']})
        if old['schema'] != new['schema']:
            issues.append({'table': name, 'reason': 'changed_columns'})
            continue
        if old['rows'] - new['rows']:
            issues.append({'table': name, 'reason': 'changed_or_removed_records'})
        extra = new['rows'] - old['rows']
        if extra and profile == 'home' and name in ('apps', 'group_apps'):
            column = 'id' if name == 'apps' else 'app_id'
            idx = old['columns'].index(column)
            allowed = Counter(row_hash(r) for r in new['raw'] if r[idx] == 'family-tree')
            extra -= allowed
        if extra:
            issues.append({'table': name, 'reason': 'unexpected_added_records'})
    for name in after.keys() - before.keys():
        if name not in NEW_TABLES[profile]:
            issues.append({'table': name, 'reason': 'unexpected_new_table'})
    return {'ok': not issues, 'profile': profile, 'counts': counts, 'issues': issues,
            'new_tables': sorted(after.keys() - before.keys()),
            'note': 'No record values are included. Compare during a quiet window before normal use resumes.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--profile', choices=NEW_TABLES, required=True)
    parser.add_argument('--before', required=True)
    parser.add_argument('--after', required=True)
    args = parser.parse_args()
    try:
        result = compare(snapshot(args.before), snapshot(args.after), args.profile)
    except (OSError, sqlite3.Error, ValueError, KeyError):
        # Exceptions can contain SQL and personal values: do not echo them.
        print(json.dumps({'ok': False, 'error': 'Unable to read/verify SQL exports; check files privately.'}))
        return 2
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result['ok'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
