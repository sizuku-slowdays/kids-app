import importlib.util
from pathlib import Path
import tempfile
import unittest
spec=importlib.util.spec_from_file_location('verify',Path(__file__).with_name('check-school-template-upgrade.py'))
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
class BackupComparison(unittest.TestCase):
 def test_additive_and_unchanged_values(self):
  with tempfile.TemporaryDirectory() as folder:
   before,after=Path(folder)/'before.sql',Path(folder)/'after.sql'
   source=''.join('CREATE TABLE '+name+'(id TEXT,value INTEGER);' for name in ['users','groups','memberships','children','learning_school_versions','learning_school_checks','passbook_entries'])+"INSERT INTO passbook_entries VALUES('private',123);"
   before.write_text(source)
   after.write_text(source+'CREATE TABLE learning_school_templates(id TEXT);CREATE TABLE learning_school_imports(id TEXT);')
   self.assertTrue(module.verify(before,after)['ok'])
   self.assertEqual(before.read_text(),source)
   after.write_text(after.read_text().replace(",123)",",124)"))
   result=module.verify(before,after)
   self.assertFalse(result['ok']);self.assertNotIn('private',str(result));self.assertNotIn('124',str(result['issues']))
 def test_missing_migration_rejected(self):
  with tempfile.TemporaryDirectory() as folder:
   path=Path(folder)/'before.sql'
   path.write_text(''.join('CREATE TABLE '+name+'(id TEXT);' for name in ['users','groups','memberships','children','learning_school_versions','learning_school_checks']))
   self.assertFalse(module.verify(path,path)['ok'])
if __name__=='__main__':unittest.main()
