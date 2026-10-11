import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

test('calendar profile lookup is shared only within one authenticated request',async()=>{
 const source=await readFile(new URL('../../calendar-worker/calendar-worker.js',import.meta.url),'utf8');
 const fn=source.slice(source.indexOf('async function getHomeCalendarUser('),source.indexOf('async function homeCalendarGate('));
 const contexts=new WeakMap();let queries=0;
 const sandbox={homeCalendarContexts:contexts};vm.createContext(sandbox);vm.runInContext(fn,sandbox);
 const env={DB:{prepare(){return {bind(){return {async first(){queries++;return {member_id:'one',display_name:'One',role:'member'};}};}};}}};
 const request={};contexts.set(request,{identity:{user:{id:'one'},groups:[{id:'h'}]},bound:'h'});
 const results=await Promise.all(Array.from({length:30},()=>sandbox.getHomeCalendarUser(request,env)));
 assert.equal(queries,1);assert.ok(results.every(r=>r.google_id==='family:one'));
 const next={};contexts.set(next,{identity:{user:{id:'one'},groups:[{id:'h'}]},bound:'h'});
 await sandbox.getHomeCalendarUser(next,env);assert.equal(queries,2);
 assert.equal(await sandbox.getHomeCalendarUser({},env),null);
});
