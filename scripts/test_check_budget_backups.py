import unittest,sqlite3,tempfile,importlib.util
from pathlib import Path
root=Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('checker',root/'scripts/check-budget-backups.py');checker=importlib.util.module_from_spec(spec);spec.loader.exec_module(checker)
class Backups(unittest.TestCase):
 def test_restore_and_existing_data_match_before_only_additive_changes(self):
  with tempfile.TemporaryDirectory() as folder:
   path=Path(folder);db=sqlite3.connect(':memory:');db.executescript("CREATE TABLE users(id TEXT PRIMARY KEY);CREATE TABLE apps(id TEXT PRIMARY KEY,name TEXT,icon TEXT,path TEXT,enabled INTEGER,status TEXT,position INTEGER,access_mode TEXT);CREATE TABLE app_data(app TEXT,data_key TEXT,data_json TEXT);INSERT INTO app_data VALUES('kakeibo-app','main','{\"entries\":[{\"id\":\"synthetic\"}]}');")
   before=path/'before.sql';after=path/'after.sql';before.write_text('\n'.join(db.iterdump()));migration=root/'cloudflare/home-worker/migrations/0027_budget_private.sql';self.assertTrue(checker.check(before,migration)['ok']);db.executescript(migration.read_text());after.write_text('\n'.join(db.iterdump()));self.assertTrue(checker.check(before,migration,after)['ok']);db.execute("UPDATE app_data SET data_json='{}'");after.write_text('\n'.join(db.iterdump()));result=checker.check(before,migration,after);self.assertFalse(result['ok']);self.assertEqual(result['issues'][0]['table'],'app_data');self.assertNotIn('synthetic',str(result))
if __name__=='__main__':unittest.main()
