import json,sqlite3,subprocess,sys,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
class BackupChecks(unittest.TestCase):
 def test_empty_upgrade_and_changed_old_rows(self):
  with tempfile.TemporaryDirectory() as folder:
   db=sqlite3.connect(':memory:')
   for file in sorted((ROOT/'cloudflare/home-worker/migrations').glob('*.sql')):
    if not file.name.startswith('0025_'):db.executescript(file.read_text())
   db.execute("INSERT INTO users(id,login_name,display_name,password_salt,password_hash,password_iterations,platform_role,created_at) VALUES ('synthetic-owner','synthetic-owner','Synthetic','s','h',1,'user',0)");db.execute("INSERT INTO groups VALUES ('synthetic-home','Synthetic','household','synthetic-owner',0)");db.execute("INSERT INTO passbook_settings VALUES ('synthetic-home',1)")
   before=Path(folder)/'before.sql';before.write_text('\n'.join(db.iterdump()),encoding='utf-8')
   db.executescript((ROOT/'cloudflare/home-worker/migrations/0025_passbook_chore_records.sql').read_text())
   after=Path(folder)/'after.sql';after.write_text('\n'.join(db.iterdump()),encoding='utf-8')
   cmd=[sys.executable,str(ROOT/'scripts/check-chore-records-upgrade.py'),'--before',str(before),'--after',str(after)]
   r=subprocess.run(cmd,capture_output=True,text=True);self.assertEqual(r.returncode,0,r.stdout+r.stderr);self.assertTrue(json.loads(r.stdout)['ok'])
   db.execute("UPDATE passbook_settings SET sibling_points_visible=0 WHERE household_id='synthetic-home'")
   after.write_text('\n'.join(db.iterdump()),encoding='utf-8');r=subprocess.run(cmd,capture_output=True,text=True);self.assertEqual(r.returncode,1);self.assertTrue(any(x['reason']=='rows_changed' for x in json.loads(r.stdout)['issues']))
   db.execute("UPDATE passbook_settings SET sibling_points_visible=1 WHERE household_id='synthetic-home'")
   # App metadata is outside the financial comparison, but an old protected SQL object is not.
   db.executescript("DROP TRIGGER passbook_entry_no_update;CREATE TRIGGER passbook_entry_no_update BEFORE UPDATE ON passbook_entries BEGIN SELECT RAISE(ABORT,'changed');END;")
   after.write_text('\n'.join(db.iterdump()),encoding='utf-8');r=subprocess.run(cmd,capture_output=True,text=True);self.assertEqual(r.returncode,1);self.assertFalse(json.loads(r.stdout)['ok'])
 def test_unexpected_new_table_is_not_silently_accepted(self):
  with tempfile.TemporaryDirectory() as folder:
   db=sqlite3.connect(':memory:')
   for file in sorted((ROOT/'cloudflare/home-worker/migrations').glob('*.sql')):
    if not file.name.startswith('0025_'):db.executescript(file.read_text())
   before=Path(folder)/'before.sql';before.write_text('\n'.join(db.iterdump()),encoding='utf-8')
   db.executescript((ROOT/'cloudflare/home-worker/migrations/0025_passbook_chore_records.sql').read_text());db.execute('CREATE TABLE unexpected_example(id TEXT)')
   after=Path(folder)/'after.sql';after.write_text('\n'.join(db.iterdump()),encoding='utf-8')
   r=subprocess.run([sys.executable,str(ROOT/'scripts/check-chore-records-upgrade.py'),'--before',str(before),'--after',str(after)],capture_output=True,text=True)
   self.assertEqual(r.returncode,1);self.assertTrue(any(x['reason']=='unexpected_new_table' for x in json.loads(r.stdout)['issues']))
if __name__=='__main__':unittest.main()
