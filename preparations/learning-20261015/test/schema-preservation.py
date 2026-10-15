"""Local synthetic database only. Refuse any input backup; no production connection."""
import pathlib
import sqlite3
import sys
root=pathlib.Path(__file__).resolve().parents[1]
home=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else root.parents[1]/'cloudflare/home-worker'
db=sqlite3.connect(':memory:')
for path in sorted((home/'migrations').glob('*.sql')):
    if int(path.name.split('_',1)[0])<=17:
        db.executescript(path.read_text())
db.execute("INSERT INTO users(id,login_name,display_name,password_salt,password_hash,password_iterations,platform_role,created_at) VALUES('test-parent','test-parent','Synthetic parent','test','test',1,'user',0)")
db.execute("INSERT INTO groups VALUES('test-house','Synthetic household','household','test-parent',0)")
db.execute("INSERT INTO memberships VALUES('test-house','test-parent','owner')")
tables=[r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")]
before={table:db.execute('SELECT * FROM '+table).fetchall() for table in tables}
db.executescript((root/'schema.draft.sql').read_text())
after={table:db.execute('SELECT * FROM '+table).fetchall() for table in tables}
assert before==after, 'Existing rows changed'
assert db.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
assert not db.execute('PRAGMA foreign_key_check').fetchall()
print(f'PASS: {len(tables)} existing tables unchanged; integrity=ok; foreign_key_issues=0')
