import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {osekkaiMessage} from '../src/osekkai.ts';

test('homework character changes face, chats with a friend and celebrates the report',()=>{
 const early=osekkaiMessage('homework','ogre',0,0);
 const late=osekkaiMessage('homework','ogre',3,0);
 assert.notEqual(early.face,late.face);
 assert.ok(late.reply);
 assert.match(osekkaiMessage('homework','ogre',3,0,true).text,/やった/);
 assert.notEqual(early.text,osekkaiMessage('homework','ogre',0,1).text);
});

test('osekkai has household and recipient isolation, idempotent scheduling and safe direct links',async()=>{
 const mf=new Miniflare(convertV4MiniflareOptions({name:'osekkai-test',modules:true,
  scriptPath:new URL('../.wrangler/test-build/index.js',import.meta.url).pathname,compatibilityDate:'2026-10-01',
  compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'osekkai'},serviceBindings:{ASSETS:()=>new Response('asset')}}));
 try{
  const db=await mf.getD1Database('DB');
  for(const f of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort()){
   const source=(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8')).replace(/^--.*$/gm,'');
   for(const stmt of source.match(/\s*CREATE TRIGGER[\s\S]*?\nEND;|[^;]+;/g)||[])await db.prepare(stmt).run();
  }
  const now=Math.floor(Date.now()/1000),date=new Date((now+32400)*1000),day=date.toISOString(),cookies={};
  for(const [i,u] of ['parent','older','younger','outsider'].entries()){
   await db.prepare("INSERT INTO users(id,login_name,display_name,password_salt,password_hash,password_iterations,created_at) VALUES (?,?,?,'s','h',1,?)").bind(u,u,u,now).run();
   const secret=String(i+1).repeat(64);cookies[u]='__Host-home_session='+secret;
   await db.prepare("INSERT INTO sessions VALUES (?,?,?,'mock',?,?,?,NULL)").bind(u,createHash('sha256').update(secret).digest('hex'),u,now,now,now+3600).run();
  }
  for(const [h,u] of [['home','parent'],['other','outsider']]){
   await db.prepare("INSERT INTO groups VALUES(?,?,'household',?,?)").bind(h,h,u,now).run();
   await db.prepare("INSERT INTO memberships VALUES(?,?,'owner')").bind(h,u).run();
  }
  for(const u of ['older','younger']){
   await db.prepare("INSERT INTO memberships VALUES('home',?,'member')").bind(u).run();
   await db.prepare("INSERT INTO children VALUES(?,'home',?,?)").bind(u+'-child',u,u).run();
  }
  await db.prepare("INSERT INTO group_apps VALUES('home','notification'),('home','school-prep')").run();
  const fetch=(path,who,method='GET',body)=>mf.dispatchFetch('https://cetus.fun/wagaya'+path,{
   method,redirect:'manual',headers:{Origin:'https://cetus.fun',...(who?{Cookie:cookies[who]}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,
  });
  const api=(suffix,who,method,body)=>fetch('/api/osekkai'+suffix,who,method,body);
  const rule={household_id:'home',recipient_id:'older',target:'homework',character:'ogre',time:day.slice(11,16),
   weekdays:[date.getUTCDay()],interval_min:15,retries:3,intensity:2,enabled:true,confirmation:'report',challenge:'',notify_guardian:true};
  assert.equal((await api('/rules','younger','POST',rule)).status,404);
  assert.equal((await api('/rules','outsider','POST',rule)).status,404);
  assert.equal((await api('/rules','parent','POST',rule)).status,200);
  const tick=()=>mf.dispatchFetch('https://notification-auth.internal/internal/osekkai/tick',{method:'POST'});
  const readEvent=async who=>(await (await api('',who)).json()).events;
  const [result] = await Promise.all([tick(),tick()]);
  assert.equal(result.status,200,await result.clone().text());
  const events=await readEvent('older');
  assert.equal(events.length,1);
  assert.deepEqual(await readEvent('younger'),[]);
  assert.deepEqual(await readEvent('parent'),[]);
  const id=events[0].id;
  const push=(await db.prepare('SELECT * FROM home_osekkai_push').all()).results;
  assert.equal(push.length,1);
  const check=(user,session)=>mf.dispatchFetch('https://notification-auth.internal/internal/osekkai/check?delivery='+push[0].id+'&user='+user+'&session='+session);
  assert.equal((await (await check('older','older')).json()).allowed,true);
  assert.equal((await (await check('older','younger')).json()).allowed,false);
  assert.equal((await (await check('younger','younger')).json()).allowed,false);
  const dest='/apps/osekkai/open?event='+id;
  const expired=await fetch(dest,null);
  assert.equal(expired.headers.get('location'),'/wagaya/login?osekkai='+id+'&open=1');
  assert.equal((await fetch(dest,'younger')).status,404);
  assert.equal((await fetch(dest,'older')).headers.get('location'),'/wagaya/apps/school-prep/');
  assert.equal((await api('/respond','younger','POST',{id,action:'done'})).status,404);
  assert.equal((await api('/respond','older','POST',{id,action:'decline'})).status,400);
  await db.prepare('UPDATE home_osekkai_events SET guardian_at=? WHERE id=?').bind(now,id).run();
  assert.equal((await tick()).status,200);
  const guardianCheck=(user,session)=>mf.dispatchFetch('https://notification-auth.internal/internal/osekkai/check?delivery='+id+'-4&user='+user+'&session='+session);
  assert.equal((await (await guardianCheck('parent','parent')).json()).allowed,true);
  assert.equal((await (await guardianCheck('older','older')).json()).allowed,false);
  assert.equal((await api('/respond','older','POST',{id,action:'done'})).status,200);
  assert.equal((await (await check('older','older')).json()).allowed,false);
  assert.equal((await (await guardianCheck('parent','parent')).json()).allowed,false);
  assert.equal((await readEvent('older'))[0].status,'done');
  assert.equal((await db.prepare('SELECT next_at FROM home_osekkai_events WHERE id=?').bind(id).first()).next_at,null);
  assert.equal((await api('/rules','parent','POST',{...rule,recipient_id:'younger',target:'food',character:'chick',notify_guardian:false})).status,200);
  const food=(await readEvent('younger'))[0].id;
  assert.equal((await fetch('/apps/osekkai/open?event='+food,'younger')).headers.get('location'),'https://cetus.fun/karada_power/');
  assert.equal((await api('/respond','younger','POST',{id:food,action:'decline'})).status,200);
  assert.equal((await readEvent('younger'))[0].status,'declined');
  assert.equal((await api('/rules','parent','POST',{...rule,target:'medicine',character:'slime',confirmation:'medication',notify_guardian:false})).status,200);
  const med=(await readEvent('older')).find(e=>e.target==='medicine').id;
  assert.equal((await api('/respond','older','POST',{id:med,action:'done'})).status,400);
  assert.equal((await api('/respond','older','POST',{id:med,action:'done',medication_confirmed:true})).status,200);
  const medRule=(await (await api('','parent')).json()).rules.find(r=>r.target==='medicine');
  assert.equal((await api('/rules','parent','POST',{...medRule,test:true})).status,409);
  assert.equal((await api('/rules','parent','DELETE',medRule)).status,200);
  assert.equal((await api('/rules','parent','POST',{...rule,target:'medicine',character:'slime',confirmation:'medication',notify_guardian:false})).status,200);
  assert.equal((await readEvent('older')).filter(e=>e.target==='medicine').length,1,'recreated medication rule must not prompt after completed medication');
  assert.equal((await api('/rules','parent','POST',{...rule,recipient_id:'younger',target:'food',character:'chick',notify_guardian:false})).status,200);
  assert.equal((await readEvent('younger')).length,1,'declining an optional target stops further invitations for that day');
 }finally{await mf.dispose();}
});
