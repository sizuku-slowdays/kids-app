import importlib.util
from pathlib import Path
import sqlite3
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('audit', Path(__file__).with_name('check-deployment-backups.py'))
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class BackupChecks(unittest.TestCase):
    def dump(self, path, extra=''):
        db = sqlite3.connect(':memory:')
        db.executescript("CREATE TABLE users(id TEXT, name TEXT); INSERT INTO users VALUES('u','架空'); CREATE TABLE balances(id TEXT, amount INTEGER, image BLOB); INSERT INTO balances VALUES('u',644,X'00FF'); CREATE TABLE apps(id TEXT); CREATE TABLE group_apps(group_id TEXT,app_id TEXT);" + extra)
        path.write_text('\n'.join(db.iterdump()))
        db.close()
        return audit.snapshot(path)

    def test_additive_migration_and_same_count_mutation(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            before = self.dump(path / 'before.sql')
            after = self.dump(path / 'after.sql', "CREATE TABLE family_tree_people(id TEXT); INSERT INTO apps VALUES('family-tree'); INSERT INTO group_apps VALUES('g','family-tree');")
            self.assertTrue(audit.compare(before, after, 'home')['ok'])
            altered = self.dump(path / 'changed.sql', "UPDATE balances SET amount=645;")
            report = audit.compare(before, altered, 'home')
            self.assertFalse(report['ok'])
            self.assertEqual(report['issues'][0], {'table': 'balances', 'reason': 'changed_or_removed_records'})
            self.assertNotIn('644', str(report))

    def test_unexpected_table_and_other_app_not_allowed(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            before = self.dump(path / 'before.sql')
            after = self.dump(path / 'after.sql', "CREATE TABLE unknown(id TEXT); INSERT INTO apps VALUES('other-app');")
            self.assertFalse(audit.compare(before, after, 'home')['ok'])

    def test_private_export_cannot_attach_files(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'bad.sql'
            path.write_text("ATTACH DATABASE '/tmp/should-not-exist.sqlite' AS outside;")
            with self.assertRaises(sqlite3.Error):
                audit.snapshot(path)


if __name__ == '__main__':
    unittest.main()
