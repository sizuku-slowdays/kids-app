"""Build D1 statements from draft SQL; no Cloudflare/database connection."""
import json
import pathlib
import sqlite3
root = pathlib.Path(__file__).resolve().parents[1]
statements, pending = [], ''
for line in (root / 'schema.draft.sql').read_text(encoding='utf-8').splitlines(True):
    pending += line
    if sqlite3.complete_statement(pending):
        statements.append(pending)
        pending = ''
if pending.strip():
    raise RuntimeError('Incomplete SQL')
(root / 'test/schema-statements.json').write_text(json.dumps(statements, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'{len(statements)} draft SQL statements; not applied to production')
