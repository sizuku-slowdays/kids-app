import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
// Match the Workers runtime for timezone-less calendar wall-clock strings.
process.env.TZ='UTC';
const source=await readFile(new URL('../../calendar-worker/calendar-worker.js',import.meta.url),'utf8');
const context=vm.createContext({Response,Request,URL,Date:class extends Date{static now(){return Date.parse('2026-10-01T00:00:00Z');}},console,crypto:globalThis.crypto});
vm.runInContext(source.replace('export default {','globalThis.worker={')+'\nglobalThis.payload=calendarNotificationPayload;',context);
const base={id:'test-event',title:'synthetic',start_datetime:'2026-10-05T09:00',end_datetime:'2026-10-05T10:00',notification_recipient:'home-all',recurrence_type:'daily',recurrence_interval:1,recurrence_end_type:'count',recurrence_end_count:2};
test('overlapping daily reminder moments deduplicate; long series retain all timings',()=>{
 const rows=context.payload({...base,notify_befores:[0,1440]}).occurrences;
 assert.equal(rows.length,3);assert.equal(new Set(rows.map(x=>x.date+' '+x.time)).size,3);
 const long=context.payload({...base,recurrence_end_type:'none',notify_befores:[0,5,10,30,60,1440]}).occurrences;
 assert.ok(long.length>500);assert.ok(long.length<3500);assert.equal(new Set(long.map(x=>x.date+' '+x.time)).size,long.length);
 assert.equal(context.payload({...base,notify_before:5}).occurrences.length,2,'legacy single timing preserved');
 assert.equal(context.payload({...base,all_day:1,notify_befores:[30,1440]}).occurrences.length,0);
 assert.equal(context.payload({...base,notify_before:-1,notify_befores:[]}).occurrences.length,0);
});
