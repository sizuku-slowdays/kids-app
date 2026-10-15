"""Read an exported SQL file into a local in-memory database. Never connect remotely."""
import hashlib
import pathlib
import sqlite3
import sys
path=pathlib.Path(sys.argv[1])
raw=path.read_bytes()
if not raw:
    raise SystemExit('ERROR: empty backup')
db=sqlite3.connect(':memory:')
db.executescript(raw.decode('utf-8-sig'))
integrity=db.execute('PRAGMA integrity_check').fetchall()
foreign=db.execute('PRAGMA foreign_key_check').fetchall()
if integrity!=[('ok',)] or foreign:
    raise SystemExit('ERROR: backup integrity / foreign keys need review')
tables=db.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").fetchone()[0]
if not tables:
    raise SystemExit('ERROR: no tables')
print('integrity: ok')
print('foreign_key_issues: 0')
print('tables:',tables)
print('file_bytes:',len(raw))
print('sha256:',hashlib.sha256(raw).hexdigest())
