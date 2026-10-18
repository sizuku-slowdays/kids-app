import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest
s=importlib.util.spec_from_file_location('check_multi',Path(__file__).with_name('check-multi-family-upgrade.py'));m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class Comparison(unittest.TestCase):
 def test_additive_and_same_count_changes(self):
  with tempfile.TemporaryDirectory() as d:
   a,b=Path(d)/'before.sql',Path(d)/'after.sql'
   old="CREATE TABLE ledger(id TEXT,delta INTEGER);INSERT INTO ledger VALUES('private-user',100);"
   a.write_text(old);b.write_text(old+''.join('CREATE TABLE '+n+'(id TEXT);' for n in m.NEW))
   h=hashlib.sha256(a.read_bytes()).hexdigest();self.assertTrue(m.compare(m.snapshot(a),m.snapshot(b),'home')['ok'])
   b.write_text(b.read_text().replace(",100)",",101)"));r=m.compare(m.snapshot(a),m.snapshot(b),'home');self.assertFalse(r['ok']);self.assertNotIn('private-user',str(r));self.assertEqual(hashlib.sha256(a.read_bytes()).hexdigest(),h)
 def test_early_feature_use_and_calendar_extra_table(self):
  old={'ledger':{'schema':[],'rows':{},'count':0}};new={**old,**{n:{'schema':[],'rows':{},'count':0} for n in m.NEW}};new['family_invitations']['count']=1
  self.assertFalse(m.compare(old,new,'home')['ok']);self.assertFalse(m.compare(old,new,'calendar')['ok'])
 def test_external_database_rejected(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'bad.sql';p.write_text("ATTACH DATABASE '/not-used' AS private;")
   with self.assertRaises(Exception):m.snapshot(p)
if __name__=='__main__':unittest.main()
