import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {jstDay,validDay,chooseDaily,validatePlan,sortedTasks,summarizeSchoolDays} from '../core.mjs';
import {catalog} from '../catalog.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const dependencyRoot=process.env.LEARNING_WORKER_DIR||resolve(root,'../../cloudflare/home-worker');
const require=createRequire(resolve(dependencyRoot,'package.json'));
const {Miniflare,convertV4MiniflareOptions}=require('miniflare'),{build}=require('esbuild');
const fixture=`
 CREATE TABLE users(id TEXT PRIMARY KEY,display_name TEXT NOT NULL,active INTEGER NOT NULL);
 CREATE TABLE groups(id TEXT PRIMARY KEY,kind TEXT NOT NULL);
 CREATE TABLE memberships(group_id TEXT,user_id TEXT,role TEXT,PRIMARY KEY(group_id,user_id));
 CREATE TABLE children(id TEXT PRIMARY KEY,household_id TEXT,display_name TEXT,user_id TEXT);
 CREATE TABLE home_member_attributes(group_id TEXT,user_id TEXT,age_kind TEXT);
 CREATE TABLE group_apps(group_id TEXT,app_id TEXT);
 CREATE TABLE private_files(id TEXT PRIMARY KEY);
 INSERT INTO users VALUES('parent','架空の保護者',1),('kid-a','サンプルA',1),('kid-b','サンプルB',1),('other','別家庭',1),('guest','閲覧者',1);
 INSERT INTO groups VALUES('house-a','household'),('house-b','household');
 INSERT INTO memberships VALUES('house-a','parent','owner'),('house-a','kid-a','member'),('house-a','kid-b','member'),('house-a','guest','member'),('house-b','other','owner');
 INSERT INTO children VALUES('child-a','house-a','サンプルA','kid-a'),('child-b','house-a','サンプルB','kid-b'),('child-other','house-b','別家庭','other');
 INSERT INTO home_member_attributes VALUES('house-a','parent','adult'),('house-a','kid-a','child');
 INSERT INTO group_apps VALUES('house-a','english-flash'),('house-a','school-prep'),('house-b','english-flash'),('house-b','school-prep');
`;
async function setup(t){
 // Test-only entry point. Never copy the x-test-user identity mechanism into HOME.
 const bundle=await build({stdin:{contents:`import {learningRoute} from ${JSON.stringify(resolve(root,'routes.mjs'))};export default {fetch(r,e){return learningRoute(r,e.DB,r.headers.get('x-test-user'),new Date('2026-10-15T13:00:00Z'));}};`,resolveDir:root,sourcefile:'synthetic-test-entry.mjs'},bundle:true,format:'esm',platform:'browser',write:false});
 const mf=new Miniflare(convertV4MiniflareOptions({name:'learning-test',modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-01',d1Databases:['DB']}));t.after(()=>mf.dispose());
 const db=await mf.getD1Database('DB');
 // D1 exec does not parse multi-line triggers. Use sqlite splitter output from the checked-in script.
 const statements=JSON.parse(await readFile(resolve(root,'test/schema-statements.json'),'utf8'));
 for(const sql of fixture.split(';').filter(s=>s.trim()))await db.prepare(sql).run();
 for(const sql of statements)await db.prepare(sql).run();
 const call=async(user,app,path='',method='GET',body,child='child-a',household='house-a')=>{
  const headers={'Content-Type':'application/json'};if(user)headers['x-test-user']=user;
  return mf.dispatchFetch(`https://test.invalid/api/${app}${path}?household=${household}&child=${child}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
 };
 return {db,call};
}
const plan={day:'2026-10-15',expected_revision:0,is_school_day:true,dismissal:'14:30',tasks:[{id:'read',kind:'homework',text:'音読'},{id:'pencil',kind:'belonging',text:'ふでばこ'}]};
test('JST boundary, real dates, unseen priority and explicit school-day summary',()=>{
 assert.equal(jstDay(new Date('2026-10-14T14:59:59Z')),'2026-10-14');assert.equal(jstDay(new Date('2026-10-14T15:00:00Z')),'2026-10-15');
 assert.equal(validDay('2026-02-30'),false);assert.equal(validDay('2028-02-29'),true);
 const pool=catalog.filter(c=>c.level==='alphabet');const out=chooseDaily(pool,new Set(pool.slice(0,23).map(c=>c.id)),3,()=>.5);assert.deepEqual(new Set(out),new Set(['letter-X','letter-Y','letter-Z']));
 assert.throws(()=>validatePlan({...plan,tasks:[plan.tasks[0],plan.tasks[0]]}));
 assert.equal(sortedTasks(plan.tasks,[{task_id:'read',phase:'homework',done:1}],'night')[0].done,false);
 assert.deepEqual(summarizeSchoolDays([{is_school_day:true,complete:true},{is_school_day:false,complete:true}]),{school_days:1,completed:1,window_size:30,reward_policy:'unconfigured'});
});
test('authentication, other child, other household and unassigned adult are rejected',async t=>{
 const {call}=await setup(t);
 assert.equal((await call(null,'english-flash')).status,401);
 for(const app of ['school-prep','english-flash']){
  assert.equal((await call('kid-b',app)).status,403);assert.equal((await call('other',app)).status,403);assert.equal((await call('guest',app)).status,403);
  assert.equal((await call('kid-a',app,'','GET',undefined,'child-other','house-b')).status,403);
 }
 assert.equal((await call('kid-a','english-flash','/profile','PUT',{level:'words',daily_count:3})).status,403);
 assert.equal((await call('kid-a','school-prep','/confirm','POST',plan)).status,403);
});
test('daily English is stable and mastery/review are idempotent and isolated',async t=>{
 const {call,db}=await setup(t);
 assert.equal((await call('parent','english-flash','/profile','PUT',{level:'words',daily_count:3})).status,200);
 const first=await(await call('kid-a','english-flash')).json(),second=await(await call('kid-a','english-flash')).json();assert.deepEqual(first.today,second.today);assert.equal(first.today.items.length,3);
 const payload={day:'2026-10-15',item_id:first.today.items[0]};
 const results=await Promise.all([call('kid-a','english-flash','/remember','POST',payload),call('kid-a','english-flash','/remember','POST',payload)]);assert.deepEqual(results.map(r=>r.status),[200,200]);
 assert.equal((await db.prepare("SELECT COUNT(*) n FROM learning_english_events WHERE kind='remember'").first()).n,1);
 assert.equal((await call('kid-a','english-flash','/remember','POST',{...payload,day:'2026-10-14'})).status,409);
 assert.equal((await call('kid-a','english-flash','/review','POST',payload)).status,200);
 assert.equal((await call('parent','english-flash','/remember','POST',payload)).status,403);
 const sibling=await(await call('kid-b','english-flash','','GET',undefined,'child-b')).json();assert.deepEqual(sibling.remembered,[]);
 // A settings change does not replace today's already-persisted set.
 await call('parent','english-flash','/profile','PUT',{level:'alphabet',daily_count:5});
 assert.deepEqual((await(await call('kid-a','english-flash')).json()).today,first.today===undefined?undefined:{...first.today,confirmed:[payload.item_id]});
});
test('school confirmation is versioned, night/morning separate, duplicate receipt cannot undo newer state',async t=>{
 const {call,db}=await setup(t);
 assert.equal((await call('parent','school-prep','/confirm','POST',plan)).status,200);
 assert.equal((await call('parent','school-prep','/confirm','POST',plan)).status,409);
 const payload={revision:1,task_id:'pencil',phase:'night',done:true,request_id:'req-1'};
 assert.equal((await call('kid-a','school-prep','/check','POST',payload)).status,200);
 assert.equal((await call('kid-a','school-prep','/check','POST',{...payload,phase:'morning',request_id:'req-2'})).status,200);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM learning_school_checks').first()).n,2);
 await call('kid-a','school-prep','/check','POST',{...payload,task_id:'read',phase:'homework',request_id:'req-homework'});
 assert.equal((await(await call('parent','school-prep','/summary')).json()).completed,1);
 assert.equal((await(await call('parent','school-prep','/days')).json()).days.length,1);
 await call('kid-a','school-prep','/check','POST',{...payload,done:false,request_id:'req-3'});
 assert.equal((await call('kid-a','school-prep','/check','POST',payload)).status,200);
 assert.equal((await db.prepare("SELECT done FROM learning_school_checks WHERE phase='night'").first()).done,0);
 assert.equal((await call('kid-a','school-prep','/check','POST',{...payload,done:false})).status,409);
 assert.equal((await call('kid-a','school-prep','/check','POST',{...payload,phase:'homework',request_id:'bad'})).status,400);
 assert.equal((await call('parent','school-prep','/confirm','POST',{...plan,expected_revision:1})).status,200);
 assert.equal((await call('kid-a','school-prep','/check','POST',{...payload,request_id:'stale'})).status,409);
 const state=await(await call('kid-a','school-prep')).json();assert.equal(state.plan.revision,2);assert.deepEqual(state.checks,[]);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM learning_school_checks').first()).n,3);
 for(const operation of ['/extract','/notify','/reward'])assert.equal((await call('parent','school-prep',operation,'POST',{})).status,503);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM learning_school_outbox').first()).n,0);
});
test('concurrent school confirmation only accepts one version and malformed dates are rejected',async t=>{
 const {call,db}=await setup(t);
 const results=await Promise.all([call('parent','school-prep','/confirm','POST',plan),call('parent','school-prep','/confirm','POST',plan)]);
 assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM learning_school_versions').first()).n,1);
 assert.equal((await call('parent','school-prep','/confirm','POST',{...plan,day:'2026-02-30'})).status,400);
 assert.equal((await call('parent','school-prep','/confirm','POST',{...plan,source_file_id:'private-image'})).status,409);
});
