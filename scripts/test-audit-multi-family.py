import importlib.util
import json
import os
import sqlite3
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('family_audit', ROOT / 'scripts/audit-multi-family.py')
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class AuditTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.folder = Path(self.temp.name)
        db = sqlite3.connect(':memory:')
        source = Path(os.environ.get('WAGAYA_TEST_SOURCE', ROOT))
        for file in sorted((source / 'cloudflare/home-worker/migrations').glob('*.sql')):
            db.executescript(file.read_text())
        self.assertTrue(db.execute("SELECT name FROM sqlite_master WHERE name='passbook_gift_guardians'").fetchone())
        for uid in ['m', 'a', 'b', 'gp', 'gm']:
            db.execute("INSERT INTO users(id,login_name,display_name,password_salt,password_hash,password_iterations,created_at) VALUES(?,?,?,'PRIVATE-SALT','PRIVATE-HASH',1,1)", (uid, 'PRIVATE-LOGIN-' + uid, 'PRIVATE-NAME-' + uid))
        db.execute("INSERT INTO groups VALUES('private-group','PRIVATE-FAMILY','household','m',1)")
        for uid in ['m', 'a', 'b', 'gp', 'gm']:
            db.execute('INSERT INTO memberships VALUES(?,?,?)', ('private-group', uid, 'owner' if uid == 'm' else 'member'))
            db.execute('INSERT INTO home_member_attributes VALUES(?,?,?,?,?)', ('private-group', uid, 'child' if uid in ['a', 'b'] else 'adult', 'm', 'now'))
        db.execute("INSERT INTO group_apps VALUES('private-group','passbook')")
        db.executemany("INSERT INTO children VALUES(?,'private-group','PRIVATE-CHILD',?)", [('c1', 'a'), ('c2', 'b')])
        for pid, uid in [('p1', 'm'), ('p2', 'gm')]:
            db.execute("INSERT INTO family_tree_people(id,household_id,home_user_id,name,furigana,former_name,gender,birth_date,death_date,memo,created_by,updated_at) VALUES(?,'private-group',?,'PRIVATE-PERSON','','','unknown','','','PRIVATE-MEMO',?,'now')", (pid, uid, uid))
        self.home = self.folder / 'home.sql'
        self.home.write_text('\n'.join(db.iterdump()), encoding='utf-8')
        db.close()
        self.calendar = self.folder / 'calendar.sql'
        self.calendar.write_text("""
          CREATE TABLE home_calendar_config(id INTEGER,household_id TEXT);
          INSERT INTO home_calendar_config VALUES(1,'private-group');
          CREATE TABLE home_calendar_links(home_user_id TEXT,member_id TEXT,household_id TEXT);
          INSERT INTO home_calendar_links VALUES('m','private-calendar-person','private-group');
          CREATE TABLE calendars(id TEXT,name TEXT); INSERT INTO calendars VALUES('PRIVATE-ID','PRIVATE-TITLE');
          CREATE TABLE calendar_events(id TEXT,memo TEXT); INSERT INTO calendar_events VALUES('PRIVATE-ID','PRIVATE-EVENT');
          CREATE TABLE home_calendar_acl(id TEXT);CREATE TABLE home_event_visibility(id TEXT);CREATE TABLE home_calendar_participation(id TEXT);
        """, encoding='utf-8')
        self.notifications = self.folder / 'notifications.sql'
        self.notifications.write_text("CREATE TABLE push_subscriptions(endpoint TEXT,auth TEXT);INSERT INTO push_subscriptions VALUES('PRIVATE-ENDPOINT','PRIVATE-TOKEN');", encoding='utf-8')

    def tearDown(self):
        self.temp.cleanup()

    def test_report_is_private_and_backups_unchanged(self):
        paths = [self.home, self.calendar, self.notifications]
        before = [p.read_bytes() for p in paths]
        private = self.folder / 'PRIVATE.json'
        result = audit.audit(*paths, private)
        self.assertTrue(result['ok'])
        self.assertEqual(result['active_users'], 5)
        self.assertEqual(result['families'][0]['members'], 5)
        self.assertEqual(result['families'][0]['children'], 2)
        self.assertEqual(result['families'][0]['tree_active_people'], 2)
        self.assertEqual(sum(x['legacy_finance_admin'] for x in result['memberships']), 1)
        self.assertEqual(sum(x['gift_sender'] for x in result['memberships']), 3)
        self.assertEqual(sum(x['legacy_learning_guardian'] for x in result['memberships']), 3)
        self.assertIn('tree_basis_or_disconnected_people_need_display_check', result['warnings'])
        self.assertNotIn('PRIVATE-', json.dumps(result))
        self.assertNotIn('private-group', json.dumps(result))
        self.assertIn('PRIVATE-LOGIN-', private.read_text())
        self.assertNotIn('PRIVATE-HASH', private.read_text())
        self.assertEqual(before, [p.read_bytes() for p in paths])

    def test_private_output_must_not_overwrite_backup(self):
        before = self.home.read_bytes()
        with self.assertRaises(ValueError):
            audit.audit(self.home, self.calendar, self.notifications, self.home)
        self.assertEqual(before, self.home.read_bytes())

    def test_external_file_access_is_rejected(self):
        bad = self.folder / 'bad.sql'
        bad.write_text("ATTACH DATABASE '/tmp/private.db' AS extra;")
        with self.assertRaises(sqlite3.Error):
            audit.open_export(bad)


if __name__ == '__main__':
    unittest.main()
