import unittest,sqlite3,tempfile,importlib.util
from pathlib import Path
root=Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('checker',root/'scripts/check-budget-backups.py');checker=importlib.util.module_from_spec(spec);spec.loader.exec_module(checker)
class Backups(unittest.TestCase):
 def test_restore_and_existing_data_match_before_only_additive_changes(self):
  with tempfile.TemporaryDirectory() as folder:
   path=Path(folder);db=sqlite3.connect(':memory:');db.executescript("CREATE TABLE users(id TEXT PRIMARY KEY);CREATE TABLE apps(id TEXT PRIMARY KEY,name TEXT,icon TEXT,path TEXT,enabled INTEGER,status TEXT,position INTEGER,access_mode TEXT);CREATE TABLE app_data(app TEXT,data_key TEXT,data_json TEXT);INSERT INTO app_data VALUES('kakeibo-app','main','{\"entries\":[{\"id\":\"synthetic\"}]}');")
   before=path/'before.sql';after=path/'after.sql';before.write_text('\n'.join(db.iterdump()));migration=root/'cloudflare/home-worker/migrations/0027_budget_private.sql';self.assertTrue(checker.check(before,migration)['ok']);self.assertTrue(checker.check(before,[migration,root/'cloudflare/home-worker/migrations/0028_budget_calendar.sql'])['ok']);db.executescript(migration.read_text());after.write_text('\n'.join(db.iterdump()));self.assertTrue(checker.check(before,migration,after)['ok']);db.execute("UPDATE app_data SET data_json='{}'");after.write_text('\n'.join(db.iterdump()));result=checker.check(before,migration,after);self.assertFalse(result['ok']);self.assertEqual(result['issues'][0]['table'],'app_data');self.assertNotIn('synthetic',str(result))
 def test_notification_additive_schema_preserves_rules_logs_and_subscriptions(self):
  with tempfile.TemporaryDirectory() as folder:
   path=Path(folder);db=sqlite3.connect(':memory:');db.executescript("CREATE TABLE notification_rules(id INTEGER PRIMARY KEY,title TEXT);CREATE TABLE notification_logs(rule_id INTEGER,fire_key TEXT);CREATE TABLE push_subscriptions(id INTEGER,endpoint TEXT);INSERT INTO notification_rules VALUES(1,'synthetic');INSERT INTO notification_logs VALUES(1,'synthetic');INSERT INTO push_subscriptions VALUES(1,'https://synthetic.invalid');")
   before=path/'before.sql';after=path/'after.sql';before.write_text('\n'.join(db.iterdump()));migration=root/'cloudflare/notification-center-api/budget-calendar.sql';db.executescript(migration.read_text());after.write_text('\n'.join(db.iterdump()));self.assertTrue(checker.check(before,migration,after)['ok']);db.execute('DELETE FROM notification_logs');after.write_text('\n'.join(db.iterdump()));self.assertFalse(checker.check(before,migration,after)['ok'])
 def test_rehearsal_detects_existing_data_and_schema_damage_without_after_export(self):
  with tempfile.TemporaryDirectory() as folder:
   path=Path(folder);before=path/'before.sql';migration=path/'migration.sql'
   before.write_text("CREATE TABLE balances(id TEXT PRIMARY KEY,amount INTEGER);INSERT INTO balances VALUES('synthetic',350);CREATE INDEX balances_amount ON balances(amount);")
   migration.write_text("UPDATE balances SET amount=0; DROP INDEX balances_amount;")
   result=checker.check(before,migration)
   self.assertFalse(result['ok'])
   self.assertEqual(result['issues'],[{'reason':'rows_changed','table':'balances'},{'reason':'schema_changed','object':'balances_amount'}])
   self.assertNotIn('synthetic',str(result))
if __name__=='__main__':unittest.main()

