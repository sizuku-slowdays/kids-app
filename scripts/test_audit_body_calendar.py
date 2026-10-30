import json,sqlite3,subprocess,sys,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parent
class AuditTest(unittest.TestCase):
 def test_only_schema_and_counts_are_shared(self):
  with tempfile.TemporaryDirectory() as folder:
   db=sqlite3.connect(':memory:');db.executescript("CREATE TABLE users(id TEXT,active INTEGER);INSERT INTO users VALUES ('PRIVATE_USER',1);CREATE TABLE groups(id TEXT,kind TEXT);INSERT INTO groups VALUES ('PRIVATE_FAMILY','household');")
   (Path(folder)/'home-before.sql').write_text('\n'.join(db.iterdump()))
   db=sqlite3.connect(':memory:')
   for table in ['period_users','period_records','period_requests','period_favorites','period_inventory']:
    db.execute('CREATE TABLE '+table+'(id INTEGER PRIMARY KEY,secret TEXT)');db.execute('INSERT INTO '+table+" VALUES (1,'PRIVATE_HEALTH_DATA')")
   (Path(folder)/'calendar-before.sql').write_text('\n'.join(db.iterdump()))
   r=subprocess.run([sys.executable,str(ROOT/'audit-body-calendar-backups.py'),'--folder',folder],capture_output=True,text=True);self.assertEqual(r.returncode,0,r.stdout+r.stderr)
   summary=(Path(folder)/'summary-safe-to-share.json').read_text();self.assertNotIn('PRIVATE_',summary);self.assertTrue(json.loads(summary)['ok'])
 def test_wrong_database_stops_without_private_output(self):
  with tempfile.TemporaryDirectory() as folder:
   for name in ['home-before.sql','calendar-before.sql']:(Path(folder)/name).write_text("CREATE TABLE unknown(secret TEXT);INSERT INTO unknown VALUES('PRIVATE_DATA');")
   r=subprocess.run([sys.executable,str(ROOT/'audit-body-calendar-backups.py'),'--folder',folder],capture_output=True,text=True);self.assertEqual(r.returncode,1);self.assertNotIn('PRIVATE_DATA',r.stdout+r.stderr);self.assertFalse((Path(folder)/'summary-safe-to-share.json').exists())
if __name__=='__main__':unittest.main()
