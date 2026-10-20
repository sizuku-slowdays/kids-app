"""Read-only offline SQL comparison; never prints private row values."""
import argparse
import json
import importlib.util
from pathlib import Path
spec = importlib.util.spec_from_file_location("audit", Path(__file__).with_name("audit-multi-family.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def verify(before, after=None):
    opened = []
    try:
        db, meta = module.open_export(before)
        opened.append(db)
        assert meta['integrity'] == 'ok' and meta['foreign_key_issues'] == 0, 'Invalid backup'
        required = {'users', 'groups', 'memberships', 'children', 'learning_school_versions', 'learning_school_checks'}
        assert required <= set(meta['table_counts']), 'Missing expected tables'
        result = {'ok': True, 'integrity': 'ok', 'foreign_key_issues': 0, 'sha256': meta['sha256'], 'file_bytes': meta['file_bytes']}
        if after:
            later, info = module.open_export(after)
            opened.append(later)
            assert info['integrity'] == 'ok' and info['foreign_key_issues'] == 0, 'Invalid after backup'
            issues = []
            ignored = {'sessions', 'auth_attempts', 'd1_migrations'}
            for table in set(meta['table_counts']) - ignored:
                if table not in info['table_counts']:
                    issues.append({'table': table, 'reason': 'missing_table'})
                    continue
                quote = '"' + table.replace('"', '""') + '"'
                before_schema = db.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone()[0]
                after_schema = later.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone()[0]
                def values(conn):
                    return sorted(json.dumps(list(r), ensure_ascii=True, default=str) for r in conn.execute('SELECT * FROM ' + quote))
                if before_schema != after_schema or values(db) != values(later):
                    issues.append({'table': table, 'reason': 'changed_records_or_schema'})
            expected = {'learning_school_templates', 'learning_school_imports'}
            for table in expected:
                if table not in info['table_counts']:
                    issues.append({'table': table, 'reason': 'migration_missing'})
                elif table not in meta['table_counts'] and info['table_counts'][table] != 0:
                    issues.append({'table': table, 'reason': 'used_before_verification'})
            unexpected = set(info['table_counts']) - set(meta['table_counts']) - expected - ignored
            issues.extend({'table': t, 'reason': 'unexpected_new_table'} for t in sorted(unexpected))
            result.update(ok=not issues, issues=issues, after_sha256=info['sha256'])
        return result
    finally:
        for db in opened:
            db.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--before', required=True)
    parser.add_argument('--after')
    args = parser.parse_args()
    try:
        result = verify(args.before, args.after)
        print(json.dumps(result, indent=2))
        raise SystemExit(0 if result['ok'] else 1)
    except (AssertionError, Exception) as error:
        print(json.dumps({'ok': False, 'reason': type(error).__name__}))
        raise SystemExit(1)

