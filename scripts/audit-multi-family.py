"""Offline, read-only audit of private D1 exports. Public output never contains names/IDs/money.

The private report maps stable U/G references to IDs on the user's PC only.
Nothing here connects to Cloudflare or changes source SQL backups.
"""
import argparse
import hashlib
import json
import sqlite3
from pathlib import Path


def open_export(path):
    raw = Path(path).read_bytes()
    db = sqlite3.connect(':memory:')
    db.row_factory = sqlite3.Row

    def guard(action, arg1, arg2, *rest):
        if action in (sqlite3.SQLITE_ATTACH, sqlite3.SQLITE_DETACH, sqlite3.SQLITE_CREATE_VTABLE):
            return sqlite3.SQLITE_DENY
        if action == sqlite3.SQLITE_FUNCTION and str(arg2).lower() in ('load_extension', 'readfile', 'writefile'):
            return sqlite3.SQLITE_DENY
        return sqlite3.SQLITE_OK

    db.set_authorizer(guard)
    try:
        db.executescript(raw.decode('utf-8-sig'))
        db.execute('PRAGMA query_only=ON')
        integrity = [tuple(r) for r in db.execute('PRAGMA integrity_check')] == [('ok',)]
        fk = len(db.execute('PRAGMA foreign_key_check').fetchall())
        tables = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        counts = {t: db.execute('SELECT COUNT(*) FROM "' + t.replace('"', '""') + '"').fetchone()[0]
                  for t in sorted(tables) if not t.startswith(('sqlite_', '_cf_'))}
        return db, {'integrity': 'ok' if integrity else 'failed', 'foreign_key_issues': fk,
                    'file_bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(), 'table_counts': counts}
    except Exception:
        db.close()
        raise


def rows(db, sql, args=()):
    return [dict(r) for r in db.execute(sql, args)]


def audit(home_path, calendar_path, notification_path, private_report):
    sources = [home_path, calendar_path, notification_path]
    if Path(private_report).resolve() in {Path(p).resolve() for p in sources}:
        raise ValueError('private report cannot overwrite backup')
    hashes = [hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in sources]
    opened = []
    try:
        for p in sources:
            opened.append(open_export(p))
        (home, hi), (calendar, ci), (notifications, ni) = opened
        required = {'users', 'groups', 'memberships', 'children', 'home_member_attributes',
                    'group_apps', 'apps', 'user_apps', 'home_preferences', 'family_tree_people',
                    'family_tree_relations', 'passbook_accounts', 'passbook_adult_accounts',
                    'passbook_gift_guardians', 'passbook_gift_senders'}
        available = {r[0] for r in home.execute('SELECT name FROM sqlite_master')}
        if required - available:
            raise ValueError('required schema missing')
        users = rows(home, 'SELECT id,login_name,display_name,platform_role,active FROM users ORDER BY id')
        groups = rows(home, 'SELECT id,name,kind,created_by FROM groups ORDER BY id')
        user_ref = {u['id']: 'U' + str(i + 1) for i, u in enumerate(users)}
        group_ref = {g['id']: 'G' + str(i + 1) for i, g in enumerate(groups)}
        members = rows(home, """SELECT m.group_id,m.user_id,m.role,COALESCE(a.age_kind,'unknown') age_kind,
          EXISTS(SELECT 1 FROM children c WHERE c.household_id=m.group_id AND c.user_id=m.user_id) child_link,
          EXISTS(SELECT 1 FROM passbook_gift_guardians p WHERE p.household_id=m.group_id AND p.user_id=m.user_id) gift_guardian,
          EXISTS(SELECT 1 FROM passbook_gift_senders p WHERE p.household_id=m.group_id AND p.user_id=m.user_id) gift_sender
          FROM memberships m LEFT JOIN home_member_attributes a ON a.group_id=m.group_id AND a.user_id=m.user_id
          ORDER BY m.group_id,m.user_id""")
        public_members = []
        for m in members:
            household = next(g['kind'] == 'household' for g in groups if g['id'] == m['group_id'])
            account = next(u for u in users if u['id'] == m['user_id'])
            public_members.append({'family_ref': group_ref[m['group_id']], 'user_ref': user_ref[m['user_id']],
                                   'active': bool(account['active']), 'platform_operator': account['platform_role'] == 'operator',
                                   'role': m['role'], 'age_kind': m['age_kind'], 'child_link': bool(m['child_link']),
                                   'legacy_finance_admin': household and bool(account['active']) and m['role'] in ('owner', 'admin'),
                                   'gift_guardian': bool(m['gift_guardian']), 'gift_sender': bool(m['gift_sender']),
                                   'legacy_learning_guardian': household and bool(account['active']) and (m['age_kind'] == 'adult' or m['role'] in ('owner', 'admin') or account['platform_role'] == 'operator') and not m['child_link'] and m['age_kind'] != 'child'})
        family_summary = []
        private_tree = []
        for g in groups:
            gid = g['id']
            people = rows(home, 'SELECT id,home_user_id,created_by,deleted_at FROM family_tree_people WHERE household_id=?', (gid,))
            living_records = {p['id'] for p in people if not p['deleted_at']}
            relations = rows(home, 'SELECT from_person,to_person,deleted_at FROM family_tree_relations WHERE household_id=?', (gid,))
            graph = {p: set() for p in living_records}
            for r in relations:
                a, b = r['from_person'], r['to_person']
                if not r['deleted_at'] and a in graph and b in graph:
                    graph[a].add(b)
                    graph[b].add(a)
            viewer_summary = []
            for m in [m for m in members if m['group_id'] == gid]:
                basis = next((p['id'] for p in people if p['home_user_id'] == m['user_id'] and not p['deleted_at']), None)
                reachable, todo = set(), [basis] if basis else []
                while todo:
                    x = todo.pop()
                    if x not in reachable:
                        reachable.add(x)
                        todo.extend(graph[x] - reachable)
                viewer_summary.append({'user_ref': user_ref[m['user_id']], 'has_basis': bool(basis),
                                       'disconnected_from_basis': len(living_records - reachable) if basis else None})
            created_counts = {}
            for p in people:
                ref = user_ref.get(p['created_by'], 'unknown')
                created_counts[ref] = created_counts.get(ref, 0) + int(not p['deleted_at'])
            family_summary.append({'group_ref': group_ref[gid], 'kind': g['kind'],
                'members': sum(m['group_id'] == gid for m in members),
                'enabled_apps': [r['app_id'] for r in rows(home, 'SELECT app_id FROM group_apps WHERE group_id=? ORDER BY app_id', (gid,))],
                'children': home.execute('SELECT COUNT(*) FROM children WHERE household_id=?', (gid,)).fetchone()[0],
                'tree_active_people': len(living_records), 'tree_creators': created_counts, 'tree_viewers': viewer_summary})
            private_tree.append({'household_id': gid, 'person_ids': people})
        calendar_tables = set(ci['table_counts'])
        if not {'home_calendar_config', 'home_calendar_links', 'calendars', 'calendar_events'} <= calendar_tables:
            raise ValueError('calendar schema missing')
        bindings = rows(calendar, 'SELECT household_id FROM home_calendar_config')
        links = rows(calendar, 'SELECT home_user_id,member_id,household_id FROM home_calendar_links')
        link_summary = [{'user_ref': user_ref.get(l['home_user_id'], 'unknown'),
                         'family_ref': group_ref.get(l['household_id'], 'unknown'),
                         'membership_matches': any(m['user_id'] == l['home_user_id'] and m['group_id'] == l['household_id'] for m in members)} for l in links]
        tables = hi['table_counts']
        if 'push_subscriptions' not in ni['table_counts']:
            raise ValueError('notification schema missing')
        warnings = []
        if any(m['legacy_finance_admin'] and (m['age_kind'] == 'child' or m['child_link']) for m in public_members):
            warnings.append('child_has_legacy_finance_admin_role')
        if any(not l['membership_matches'] for l in link_summary):
            warnings.append('calendar_link_membership_mismatch')
        if any(g['tree_active_people'] and any(not v['has_basis'] or v['disconnected_from_basis'] for v in g['tree_viewers']) for g in family_summary):
            warnings.append('tree_basis_or_disconnected_people_need_display_check')
        result = {'ok': all(x['integrity'] == 'ok' and x['foreign_key_issues'] == 0 for x in (hi, ci, ni)),
                  'backups': {'home': hi, 'calendar': ci, 'notifications': ni},
                  'active_users': sum(bool(u['active']) for u in users),
                  'families': family_summary, 'memberships': public_members,
                  'calendar': {'binding_family_refs': [group_ref.get(b['household_id'], 'unknown') for b in bindings],
                               'links': link_summary, 'acl_tables_present': all(t in calendar_tables for t in ('home_calendar_acl', 'home_event_visibility', 'home_calendar_participation'))},
                  'home_settings': {'user_app_rows': tables.get('user_apps', 0), 'favorites_rows': tables.get('home_preferences', 0)},
                  'warnings': warnings,
                  'phase_2_ready': False,
                  'note': 'Audit only. Review roles and warnings before phase 2. No names, IDs, tokens, balances or event contents in this summary.'}
        private = {'warning': 'PRIVATE: do not upload this report or SQL exports to GitHub/chat.',
                   'users': [{**u, 'user_ref': user_ref[u['id']]} for u in users],
                   'groups': [{**g, 'group_ref': group_ref[g['id']]} for g in groups],
                   'memberships': members, 'calendar_links': links, 'tree': private_tree}
        Path(private_report).write_text(json.dumps(private, ensure_ascii=False, indent=2), encoding='utf-8')
        if [hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in sources] != hashes:
            raise ValueError('source files changed')
        return result
    finally:
        for db, _ in opened:
            db.close()


def main():
    parser = argparse.ArgumentParser()
    for name in ('home', 'calendar', 'notifications', 'private_report', 'summary'):
        parser.add_argument('--' + name.replace('_', '-'), required=True)
    args = parser.parse_args()
    # Never overwrite one of the source backups with a report.
    input_paths = {Path(p).resolve() for p in (args.home, args.calendar, args.notifications)}
    outputs = [Path(args.private_report).resolve(), Path(args.summary).resolve()]
    if any(p in input_paths for p in outputs) or outputs[0] == outputs[1]:
        print('{"ok":false,"error":"Report paths must differ from backup paths."}')
        return 2
    try:
        result = audit(args.home, args.calendar, args.notifications, args.private_report)
        Path(args.summary).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0 if result['ok'] else 1
    except (sqlite3.Error, ValueError, UnicodeError, OSError):
        print('{"ok":false,"error":"Offline audit stopped. No production data changed. Do not send SQL or private reports."}')
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
