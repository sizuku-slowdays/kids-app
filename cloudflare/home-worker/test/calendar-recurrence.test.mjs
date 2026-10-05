import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
// Workers evaluates these timezone-less calendar strings in UTC.
process.env.TZ='UTC';

const source=await readFile(new URL('../../calendar-worker/calendar-worker.js',import.meta.url),'utf8');
const expansion=source.slice(source.indexOf('function expandRecurring('),source.indexOf('function notificationSourceId('));
const expand=new Function(expansion+'; return expandRecurring;')();
const base={id:'repeat',start_datetime:'2026-10-06',end_datetime:'2026-10-06',all_day:1,recurrence_type:'daily',recurrence_interval:1,recurrence_end_type:'count',recurrence_end_count:3};

test('all-day recurrence returns one initial occurrence and retains subsequent dates',()=>{
 const rows=expand(base,'2026-10-01','2026-10-31');
 assert.deepEqual(rows.map(r=>r.start_datetime.slice(0,10)),['2026-10-06','2026-10-07','2026-10-08']);
 assert.ok(rows.every(r=>r.recurrence_parent_id==='repeat'));
});
test('timed and weekly recurrences retain one initial occurrence',()=>{
 const timed={...base,all_day:0,start_datetime:'2026-10-06T09:00',end_datetime:'2026-10-06T10:00'};
 assert.equal(expand(timed,'2026-10-01','2026-10-31').length,3);
 const rows=expand({...base,recurrence_type:'weekly',recurrence_days:'2'},'2026-10-01','2026-10-31');
 assert.deepEqual(rows.map(r=>r.start_datetime.slice(0,10)),['2026-10-06','2026-10-13','2026-10-20']);
});
test('a removed initial occurrence is not reinserted by the fallback',()=>{
 const rows=expand({...base,recurrence_exceptions:'2026-10-06'},'2026-10-01','2026-10-31');
 assert.deepEqual(rows.map(r=>r.start_datetime.slice(0,10)),['2026-10-07','2026-10-08']);
});
