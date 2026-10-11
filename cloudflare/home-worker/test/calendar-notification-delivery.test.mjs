import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {DatabaseSync} from 'node:sqlite';

test('HOME device identity, legacy subscriptions, and live authorization before every calendar push',async()=>{
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(`
 CREATE TABLE push_subscriptions(id INTEGER PRIMARY KEY,endpoint TEXT UNIQUE,p256dh TEXT,auth TEXT,recipient TEXT,device_name TEXT,user_agent TEXT,enabled INTEGER,fail_count INTEGER,last_error TEXT,last_success_at TEXT,updated_at TEXT);
 CREATE TABLE habit_completions(rule_id INTEGER,date TEXT,recipient TEXT,status TEXT);
 INSERT INTO push_subscriptions VALUES(1,'https://push.test/old','k','a','mama','old','ua',1,0,NULL,NULL,NULL);
 `);
 const DB={prepare(sql){let values=[];return {bind(...v){values=v;return this;},async run(){return sqlite.prepare(sql).run(...values);},async all(){return {results:sqlite.prepare(sql).all(...values)};},async first(){return sqlite.prepare(sql).get(...values)||null;}};},async batch(statements){return Promise.all(statements.map(s=>s.run()));}};
 let allowed=true,broken=false;const checks=[],sent=[];
 const env={DB,HOME_AUTH:{async fetch(request){const u=new URL(request.url);if(u.pathname==='/api/notifications/identity')return Response.json({user:{id:'mom',display_name:'テストの母'},session_id:'sid'});checks.push(u.searchParams.get('user'));if(broken)throw Error('offline');return Response.json({allowed,title:'最新の予定名',url:'/wagaya/apps/calendar/'});}}};
 const source=await readFile(new URL('../../notification-center-api/notification-center-api.js',import.meta.url),'utf8');
 const context=vm.createContext({Response,Request,URL,URLSearchParams,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Date,console,atob,btoa,crypto:globalThis.crypto,sent});
 vm.runInContext(source.replace('export default {','globalThis.worker = {')+`\nsendPush=async(sub,payload)=>{sent.push({endpoint:sub.endpoint,payload});return {ok:true};};globalThis.api={homeNotificationRoute,subsForRecipient,fireRule,b64urlToBytes,bytesToB64url};`,context);
 const api=context.api;
 const sample=Uint8Array.from([0,1,250,255]);assert.deepEqual(Array.from(api.b64urlToBytes(api.bytesToB64url(sample))),Array.from(sample));
 function req(endpoint,user='forged'){return new Request('https://notification.internal/api/home/subscribe',{method:'POST',headers:{Origin:'https://cetus.fun',Cookie:'test','Content-Type':'application/json'},body:JSON.stringify({endpoint,p256dh:'k',auth:'a',home_user_id:user})});}
 assert.equal((await api.homeNotificationRoute(req('https://push.test/old'),env,'/api/home/subscribe')).status,200);
 assert.equal(sqlite.prepare('SELECT recipient FROM push_subscriptions WHERE id=1').get().recipient,'mama');
 assert.equal(sqlite.prepare('SELECT home_user_id FROM home_notification_subscriptions').get().home_user_id,'mom');
 assert.equal((await api.homeNotificationRoute(req('https://push.test/new'),env,'/api/home/subscribe')).status,200);
 assert.equal((await api.subsForRecipient(env,'all')).length,1);assert.equal((await api.subsForRecipient(env,'home:forged')).length,0);assert.equal((await api.subsForRecipient(env,'home:mom')).length,2);
 const rule={id:9,title:'古い予定名',body:'5分前',recipient:'home-all',external_key:'cal_event',repeat_type:'once',track_completion:0,url:'/wagaya/apps/calendar/'};
 await api.fireRule(env,rule,'1','2026-10-12');assert.equal(sent.length,2);assert.equal(sent[0].payload.title,'最新の予定名');assert.deepEqual(checks,['mom','mom']);
 allowed=false;await api.fireRule(env,rule,'2','2026-10-12');assert.equal(sent.length,2);
 allowed=true;broken=true;await api.fireRule(env,rule,'3','2026-10-12');assert.equal(sent.length,2);
 const untrusted=new Request('https://notification-center-api.sslowdayss.workers.dev/api/home/subscribe',{method:'POST'});assert.equal((await api.homeNotificationRoute(untrusted,env,'/api/home/subscribe')).status,404);
 sqlite.close();
});

test('new calendar IDs never fall back to all on an older notification worker',async()=>{
 const source=await readFile(new URL('../../calendar-worker/calendar-worker.js',import.meta.url),'utf8');
 const context=vm.createContext({Response,Request,URL,URLSearchParams,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Date,console,atob,btoa,crypto:globalThis.crypto});
 vm.runInContext(source.replace('export default {','globalThis.worker = {')+'\nglobalThis.sync=syncCalendarNotification;',context);
 const requests=[];
 const env={DB:{prepare(){return {async first(){return null;}};}},NOTIFICATION_API_URL:'https://notification.test',NOTIFICATION_APP_PASSWORD:'test',NOTIFICATION_API:{async fetch(url){requests.push(url);return Response.json({ok:true,version:2});}}};
 const result=await context.sync(env,{id:'event',calendar_id:'calendar',notification_recipient:'home-all',notify_before:5});
 assert.equal(result.skipped,true);assert.deepEqual(requests,['https://notification.test/api/health']);
});
