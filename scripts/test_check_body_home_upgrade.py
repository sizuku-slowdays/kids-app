import json,sqlite3,subprocess,sys,tempfile,unittest,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
class BodyUpgrade(unittest.TestCase):
 def prepare(self,folder):
  home=sqlite3.connect(':memory:')
  for file in sorted((ROOT/'cloudflare/home-worker/migrations').glob('*.sql')):
   if not file.name.startswith('0026_'):home.executescript(file.read_text())
  home.execute("INSERT INTO users(id,login_name,display_name,password_salt,password_hash,password_iterations,created_at) VALUES('synthetic','synthetic','Synthetic','s','h',1,0)");home.execute("INSERT INTO groups VALUES('h','Synthetic','household','synthetic',0)")
  (folder/'home-before.sql').write_text('\n'.join(home.iterdump()))
  cal=sqlite3.connect(':memory:');cal.executescript("CREATE TABLE period_users(id INTEGER PRIMARY KEY,username TEXT NOT NULL UNIQUE,display_name TEXT NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('mama','child')),created_at TEXT NOT NULL);CREATE TABLE period_records(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES period_users(id),start_date TEXT NOT NULL,end_date TEXT,flow_level TEXT,pain_level TEXT,mood TEXT,memo TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);CREATE TABLE period_requests(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES period_users(id),day_pad INTEGER,night_pad INTEGER,heavy_pad INTEGER,liner INTEGER,painkiller INTEGER,memo TEXT,urgency TEXT NOT NULL,is_read INTEGER NOT NULL,created_at TEXT NOT NULL);CREATE TABLE period_favorites(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES period_users(id),memo TEXT NOT NULL,created_at TEXT NOT NULL);CREATE TABLE period_inventory(id INTEGER PRIMARY KEY,item_key TEXT NOT NULL UNIQUE,item_name TEXT NOT NULL,quantity INTEGER NOT NULL,low_threshold INTEGER NOT NULL,updated_at TEXT NOT NULL);")
  (folder/'calendar-before.sql').write_text('\n'.join(cal.iterdump()));shutil.copy(ROOT/'cloudflare/calendar-worker/body-home.sql',folder/'body-home.sql');shutil.copy(ROOT/'cloudflare/home-worker/migrations/0026_body_calendar.sql',folder/'0026_body_calendar.sql');return home,cal
 def runcheck(self,folder,mode):return subprocess.run([sys.executable,str(ROOT/'scripts/check-body-home-upgrade.py'),'--folder',str(folder),'--mode',mode],capture_output=True,text=True)
 def test_real_constraints_trial_and_unchanged_after_exports(self):
  with tempfile.TemporaryDirectory() as tmp:
   folder=Path(tmp);home,cal=self.prepare(folder);original=(folder/'calendar-before.sql').read_bytes();r=self.runcheck(folder,'preflight');self.assertEqual(r.returncode,0,r.stdout+r.stderr);self.assertEqual((folder/'calendar-before.sql').read_bytes(),original)
   home.executescript((folder/'0026_body_calendar.sql').read_text());cal.executescript((folder/'body-home.sql').read_text());(folder/'home-after-body.sql').write_text('\n'.join(home.iterdump()));(folder/'calendar-after-body.sql').write_text('\n'.join(cal.iterdump()));r=self.runcheck(folder,'verify');self.assertEqual(r.returncode,0,r.stdout+r.stderr)
   cal.execute("INSERT INTO period_users VALUES(1,'synthetic','Synthetic','h','mama','now')");(folder/'calendar-after-body.sql').write_text('\n'.join(cal.iterdump()));r=self.runcheck(folder,'verify');self.assertEqual(r.returncode,1);self.assertIn('rows_changed',r.stdout)
 def test_unexpected_role_constraints_stop_without_values(self):
  with tempfile.TemporaryDirectory() as tmp:
   folder=Path(tmp);self.prepare(folder);s=(folder/'calendar-before.sql').read_text().replace("('mama','child')","('mama','old-child-only')");(folder/'calendar-before.sql').write_text(s);r=self.runcheck(folder,'preflight');self.assertEqual(r.returncode,1);self.assertIn('trial new profiles',r.stdout);self.assertNotIn('old-child-only',r.stdout)
if __name__=='__main__':unittest.main()
