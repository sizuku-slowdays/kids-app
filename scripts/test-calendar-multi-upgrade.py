import importlib.util
from pathlib import Path
import tempfile
import unittest
spec=importlib.util.spec_from_file_location('verify',Path(__file__).with_name('check-calendar-multi-upgrade.py'))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class Comparison(unittest.TestCase):
 def test_calendar_additive_and_changed_values(self):
  with tempfile.TemporaryDirectory() as folder:
   a,b=Path(folder)/'before.sql',Path(folder)/'after.sql'
   base=''.join('CREATE TABLE '+name+'(id TEXT,value INTEGER);' for name in ['calendar_events','calendars','home_event_visibility'])+"INSERT INTO calendar_events VALUES('private',7);"
   a.write_text(base);b.write_text(base+'CREATE TABLE home_event_options(id TEXT);')
   self.assertTrue(module.check(a,b,'calendar')['ok']);self.assertEqual(a.read_text(),base)
   b.write_text(b.read_text().replace(",7)",",8)"));r=module.check(a,b,'calendar');self.assertFalse(r['ok']);self.assertNotIn('private',str(r))
 def test_notifications_keep_rules_and_subscriptions(self):
  with tempfile.TemporaryDirectory() as folder:
   a,b=Path(folder)/'before.sql',Path(folder)/'after.sql'
   base=''.join('CREATE TABLE '+name+'(id TEXT,value INTEGER);' for name in ['notification_rules','push_subscriptions','home_notification_subscriptions','notification_logs'])+"INSERT INTO notification_rules VALUES('private',7);"
   a.write_text(base);b.write_text(base+"INSERT INTO notification_logs VALUES('private',1);");self.assertTrue(module.check(a,b,'notifications')['ok'])
   b.write_text(b.read_text().replace(",7)",",8)"));self.assertFalse(module.check(a,b,'notifications')['ok'])
if __name__=='__main__':unittest.main()
