import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarProxy} from '../src/calendar.ts';

test('HOME blocks the pre-upgrade Google leak before forwarding private data requests',async()=>{
 let owner='family:home_grandpa',version,forwarded=0;
 const env={CALENDAR_SERVICE:{fetch:async request=>{
  if(new URL(request.url).pathname==='/home/status')return Response.json({profile:{google_id:owner},privacy_version:version});
  forwarded++;return Response.json([{title:'private calendar data'}]);
 }}};
 const request=path=>new Request('https://cetus.fun/api/calendar'+path,{headers:{Cookie:'__Host-home_session=example'}});
 let r=await calendarProxy(env,request('/google-events'),'grandpa');assert.deepEqual(await r.json(),[]);assert.equal(forwarded,0);
 r=await calendarProxy(env,request('/integrations/google-ics'),'grandpa');assert.deepEqual(await r.json(),{configured:false,count:0});assert.equal(forwarded,0);
 r=await calendarProxy(env,new Request('https://cetus.fun/api/calendar/integrations/google-ics',{method:'POST'}),'grandpa');assert.equal(r.status,403);assert.equal(forwarded,0);
 owner='family:mama';r=await calendarProxy(env,request('/google-events'),'mom');assert.equal((await r.json())[0].title,'private calendar data');assert.equal(forwarded,1);
 owner='family:home_grandpa';version='20261005-owner-ics';await calendarProxy(env,request('/google-events'),'grandpa');assert.equal(forwarded,2);
});
