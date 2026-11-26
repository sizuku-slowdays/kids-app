import {fileURLToPath} from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {packPixels,PIXEL_MIME} from '../src/pixel-images.js';
import {CONSENT_VERSION,hash} from '../src/security.js';
const password='test-password-only-2026';
async function fixture(){
 const mf=new Miniflare(convertV4MiniflareOptions({name:'oshaberi-local-test',modules:true,scriptPath:fileURLToPath(new URL('../.build/index.js',import.meta.url)),compatibilityDate:'2026-10-01',compatibilityFlags:['nodejs_compat'],d1Databases:{CHAT_DB:'isolated-chat-db'},r2Buckets:{CHAT_FILES:'isolated-chat-r2'},bindings:{RELEASE_ENABLED:'1',REGISTRATION_ENABLED:'1',INVITATIONS_ENABLED:'1',RATE_SECRET:'local-test-only-secret',BOOTSTRAP_CODE:'local-test-only-code',OSHABERI_HOME_LINK_SECRET:'isolated-test-secret-only-1234567890'},serviceBindings:{ASSETS:()=>new Response('local fixture')}}));
 const db=await mf.getD1Database('CHAT_DB');const sql=await readFile(new URL('../migrations/0001_chat.sql',import.meta.url),'utf8');
 for(const s of sql.replace(/^--.*$/gm,'').match(/\s*CREATE TRIGGER[\s\S]*?\nEND;|[^;]+;/g)||[])await db.prepare(s).run();
 const groupSql=await readFile(new URL('../migrations/0002_family_groups.sql',import.meta.url),'utf8');for(const statement of groupSql.replace(/^--.*$/gm,'').split(';').filter(x=>x.trim()))await db.prepare(statement).run();
 const linkSql=await readFile(new URL('../migrations/0003_home_links.sql',import.meta.url),'utf8');for(const statement of linkSql.split(';').filter(x=>x.trim()))await db.prepare(statement).run();
 let ip=0;
 async function call(path,who,method='GET',data,extra={}){
  const headers={...(who?{Cookie:who.cookie}:{}),Origin:'https://chat.test','X-Oshaberi':'1','CF-Connecting-IP':'192.0.2.'+(++ip),...(data?{'Content-Type':'application/json'}:{}),...extra};
  const r=await mf.dispatchFetch('https://chat.test'+path,{method,headers,body:data?JSON.stringify(data):undefined});const ct=r.headers.get('Content-Type')||'';return {status:r.status,data:ct.includes('json')?await r.json():await r.arrayBuffer(),headers:r.headers};
 }
 async function ok(...args){const r=await call(...args);assert.equal(r.status,200,JSON.stringify(r.data));return r.data;}
 async function login(login){const r=await call('/api/login',null,'POST',{login,password,device:'テスト端末'});assert.equal(r.status,200,JSON.stringify(r.data));assert.match(r.headers.get('set-cookie'),/Secure; HttpOnly; SameSite=Strict/);return {cookie:r.headers.get('set-cookie').split(';')[0]};}
 async function parent(name){const r=await ok('/api/register',null,'POST',{login:name,password,alias:name,agree:true,consent_version:CONSENT_VERSION,setup_code:'local-test-only-code'});const a=await login(name);a.id=(await ok('/api/me',a)).id;a.recovery=r.recovery_code;return a;}
 async function child(parent,name){const c=await ok('/api/children',parent,'POST',{login:name,password,alias:name,agree:true,consent_version:CONSENT_VERSION});const a=await login(name);a.id=c.id;return a;}
 async function enable(parent,c,paused=false,photos=true){const s=(await ok('/api/me',parent)).children.find(x=>x.id===c.id);return ok('/api/children/'+c.id+'/settings',parent,'PUT',{revision:s.revision,paused,photos_enabled:photos,timezone:'Asia/Tokyo',schedule:Array.from({length:7},()=>[[0,1440]])});}
 return {mf,db,call,ok,login,parent,child,enable};
}
test('separate guardian/child accounts, bilateral invitation, scoped chat, unread, schedules, media and revocation',async()=>{
 const t=await fixture();const {mf,db,call,ok,parent,child,enable}=t;
 try{
 assert.equal((await call('/api/me')).status,401);
 assert.equal((await call('/api/register',null,'POST',{login:'nouser',password,alias:'n',setup_code:'wrong',agree:true,consent_version:CONSENT_VERSION})).status,403);
 const pa=await parent('parent_a'),pb=await parent('parent_b'),pc=await parent('parent_c');
 const ca=await child(pa,'child_a'),cb=await child(pb,'child_b'),cc=await child(pc,'child_c'),sibling=await child(pa,'sibling_a');
 assert.equal((await ok('/api/me',ca)).available,false,'no default family hours');
 assert.equal((await call('/api/friends',ca)).status,403);
 await enable(pa,ca);await enable(pb,cb);await enable(pc,cc);
 assert.equal((await call('/api/children/'+ca.id+'/settings',pb,'PUT',{})).status,403);
 assert.equal((await call('/api/friends?child='+ca.id,pb)).status,403);
 assert.equal((await call('/api/invitations',ca,'POST',{child_id:ca.id})).status,403);
 const invite=await ok('/api/invitations',pa,'POST',{child_id:ca.id});const token=new URL(invite.url).hash.slice(8);
 assert.equal((await db.prepare('SELECT token_hash FROM invitations WHERE id=?').bind(invite.id).first()).token_hash,await hash(token));
 assert.equal((await call('/api/invitations/accept',pb,'POST',{child_id:ca.id,token})).status,403);
 const friend=await ok('/api/invitations/accept',pb,'POST',{child_id:cb.id,token});
 assert.equal((await call('/api/invitations/accept',pb,'POST',{child_id:cb.id,token})).status,409);
 const url='/api/talks/'+friend.id;
 assert.equal((await call(url+'/messages',ca)).status,403);
 await ok('/api/friends/'+friend.id+'/approve',pa,'POST',{});
 assert.equal((await call(url+'/messages',ca)).status,403,'one approval is insufficient');
 await ok('/api/friends/'+friend.id+'/approve',pb,'POST',{});
 assert.equal((await call('/api/friends/'+friend.id+'/approve',pc,'POST',{})).status,403);
 const payload={kind:'text',text:'<img src=x onerror=alert(1)> 😊',nonce:crypto.randomUUID()};
 const sent=await ok(url+'/messages',ca,'POST',payload);await ok(url+'/messages',ca,'POST',payload);assert.equal((await call(url+'/messages',ca,'POST',{...payload,text:'different'})).status,409);
 const parallel=await Promise.all([ok(url+'/messages',ca,'POST',{kind:'standard',stamp:'hello',nonce:'parallel-unique-nonce'}),ok(url+'/messages',ca,'POST',{kind:'standard',stamp:'hello',nonce:'parallel-unique-nonce'})]);assert.equal(parallel[0].id,parallel[1].id);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM messages').first()).n,2);
 assert.equal((await call(url+'/messages',pa,'POST',payload)).status,403);
 assert.equal((await call(url+'/messages?child='+ca.id,pb)).status,403);
 assert.equal((await call(url+'/messages',cc)).status,403);
 assert.equal((await call(url+'/messages',sibling)).status,403);
 const messages=(await ok(url+'/messages',cb)).messages;assert.equal(messages[0].text,payload.text);
 assert.equal((await ok('/api/friends',cb)).friends[0].unread,2);
 await ok(url+'/messages?child='+ca.id,pa);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM read_cursors').first()).n,0,'guardian viewing never changes child read');
 assert.equal((await call(url+'/read?child='+ca.id,pa,'POST',{seq:messages.at(-1).seq})).status,403);
 await ok(url+'/read',cb,'POST',{seq:messages.at(-1).seq});assert.equal((await ok('/api/friends',cb)).friends[0].unread,0);
 assert.equal((await call(url+'/messages',ca,'POST',payload,{Origin:'https://other.test'})).status,403);
 assert.equal((await call(url+'/messages',ca,'POST',payload,{'X-Oshaberi':''})).status,403);
 assert.equal((await call(url+'/messages',ca,'POST',{kind:'photo',nonce:crypto.randomUUID()})).status,400,'no direct photo bypass');
 const pixels={width:4,height:4,data:Buffer.alloc(4*4*4,255)},jpg=packPixels(4,4,pixels.data);
 async function upload(kind,talkId){const r=await mf.dispatchFetch('https://chat.test/api/media?'+new URLSearchParams({kind,label:'テスト画像',...(talkId?{talk:talkId}:{})}),{method:'POST',headers:{Cookie:ca.cookie,Origin:'https://chat.test','X-Oshaberi':'1','Content-Type':PIXEL_MIME},body:jpg});assert.equal(r.status,200,await r.clone().text());return r.json();}
 const photo=await upload('photo',friend.id);
 assert.equal((await call('/media/'+photo.id,cb)).status,404);
 assert.equal((await call('/media/'+photo.id+'?child='+cb.id,pb)).status,404);
 assert.equal((await call('/media/'+photo.id,ca)).status,200);
 assert.equal((await call('/api/media/'+photo.id+'/approve',pb,'POST',{})).status,403);
 const before=(await db.prepare('SELECT COUNT(*) n FROM messages').first()).n;
 const approval=await Promise.all([ok('/api/media/'+photo.id+'/approve',pa,'POST',{}),ok('/api/media/'+photo.id+'/approve',pa,'POST',{})]);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM messages').first()).n,before+1,'concurrent photo approval publishes once');
 assert.equal((await call('/media/'+photo.id,cb)).status,200);
 assert.equal((await call('/media/'+photo.id,cc)).status,404);
 const rejected=await upload('photo',friend.id);await ok('/api/media/'+rejected.id+'/reject',pa,'POST',{});assert.equal((await call('/media/'+rejected.id,cb)).status,404);
 const stamp=await upload('stamp');const sendStamp={kind:'stamp',media_id:stamp.id,nonce:crypto.randomUUID()};
 assert.equal((await call(url+'/messages',ca,'POST',sendStamp)).status,409);
 await ok('/api/media/'+stamp.id+'/approve',pa,'POST',{});await ok(url+'/messages',ca,'POST',sendStamp);
 assert.equal((await call('/media/'+stamp.id,cb)).status,200);
 await ok('/api/media/'+stamp.id+'/disable',pa,'POST',{});
 assert.equal((await call('/media/'+stamp.id,cb)).status,404);assert.equal((await call(url+'/messages',ca,'POST',{...sendStamp,nonce:crypto.randomUUID()})).status,409);
 await enable(pa,ca,true);
 assert.equal((await call(url+'/messages',ca)).status,403);assert.equal((await call(url+'/messages',cb)).status,403);assert.equal((await call(url+'/messages?child='+ca.id,pa)).status,200,'guardian can supervise a paused child');
 await enable(pa,ca,false);
 const cs=(await ok('/api/me',pa)).children.find(c=>c.id===ca.id);await ok('/api/children/'+ca.id+'/settings',pa,'PUT',{revision:cs.revision,paused:false,photos_enabled:true,timezone:'Asia/Tokyo',schedule:Array.from({length:7},()=>[])});
 assert.equal((await call(url+'/messages',ca)).status,403);assert.equal((await call(url+'/messages?child='+ca.id,pa)).status,200,'guardian bypasses child hours');
 await enable(pa,ca);
 await ok('/api/friends/'+friend.id+'/block',pb,'POST',{});
 assert.equal((await call(url+'/messages',ca)).status,403);assert.equal((await call('/media/'+photo.id,ca)).status,200,'owner can still manage own file');assert.equal((await call('/media/'+photo.id,cb)).status,404);
 assert.equal((await call(url+'/messages?child='+ca.id,pa)).status,403);
 await assert.rejects(()=>db.prepare("INSERT INTO messages VALUES(NULL,'blocked-direct',?,?,?,?,'text','forbidden',NULL,?)").bind(friend.id,ca.id,'direct-nonce',awaitHash,Date.now()).run());
 const revokedInvite=await ok('/api/invitations',pa,'POST',{child_id:ca.id});await ok('/api/invitations/'+revokedInvite.id,pa,'DELETE',{});assert.equal((await call('/api/invitations/accept',pc,'POST',{child_id:cc.id,token:new URL(revokedInvite.url).hash.slice(8)})).status,409);
 const expiredInvite=await ok('/api/invitations',pa,'POST',{child_id:ca.id});await db.prepare('UPDATE invitations SET expires_at=0 WHERE id=?').bind(expiredInvite.id).run();assert.equal((await call('/api/invitations/accept',pc,'POST',{child_id:cc.id,token:new URL(expiredInvite.url).hash.slice(8)})).status,409);
 const race=await ok('/api/invitations',pa,'POST',{child_id:sibling.id});const rt=new URL(race.url).hash.slice(8);const attempts=await Promise.all([call('/api/invitations/accept',pb,'POST',{child_id:cb.id,token:rt}),call('/api/invitations/accept',pc,'POST',{child_id:cc.id,token:rt})]);assert.deepEqual(attempts.map(x=>x.status).sort(),[200,409],'concurrent invite consumption succeeds once');
 const sess=(await ok('/api/children/'+ca.id+'/sessions',pa)).sessions.find(s=>!s.revoked);await ok('/api/children/'+ca.id+'/sessions',pa,'DELETE',{session_id:sess.id});assert.equal((await call('/api/me',ca)).status,401);
 const logs=(await db.prepare('SELECT * FROM audit_events').all()).results;assert.ok(logs.every(x=>!JSON.stringify(x).includes(payload.text)));
 assert.ok(logs.some(x=>x.action==='media.approved'));
 }finally{await mf.dispose();}
});
const awaitHash='fixture-hash';
test('safe deletion, expiry cleanup, auth throttling and default release locks',async()=>{
 const t=await fixture();const {mf,db,call,ok,parent,child,enable}=t;
 try{
 const pa=await parent('delete_parent'),ca=await child(pa,'delete_child');await enable(pa,ca);
 const recovered=await ok('/api/recover',null,'POST',{login:'delete_parent',password,recovery_code:pa.recovery});assert.ok(recovered.recovery_code);assert.equal((await call('/api/me',pa)).status,401);assert.equal((await call('/api/recover',null,'POST',{login:'delete_parent',password,recovery_code:pa.recovery})).status,403);pa.cookie=(await t.login('delete_parent')).cookie;
 const mediaId=crypto.randomUUID();await db.prepare("INSERT INTO media VALUES(?,?,NULL,'stamp','old','private/old.jpg','pending',1,1,1,?,0,NULL)").bind(mediaId,ca.id,Date.now()).run();const bucket=await mf.getR2Bucket('CHAT_FILES');await bucket.put('private/old.jpg','fixture');
 await mf.getWorker().then(w=>w.scheduled({cron:'local-test'}));assert.equal(await bucket.head('private/old.jpg'),null);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM media').first()).n,0);
 for(let i=0;i<10;i++)await call('/api/login',null,'POST',{login:'unknown',password});assert.equal((await call('/api/login',null,'POST',{login:'unknown',password})).status,429);
 await ok('/api/children/'+ca.id+'/delete',pa,'POST',{password,confirm:true});assert.equal((await call('/api/me',ca)).status,401);assert.equal((await ok('/api/me',pa)).children.length,0);
 await ok('/api/account/delete',pa,'POST',{password,confirm:true});assert.equal((await call('/api/me',pa)).status,401);
 assert.equal((await db.prepare('SELECT active FROM accounts WHERE id=?').bind(pa.id).first()).active,0);
 await db.prepare('UPDATE accounts SET deleted_at=? WHERE active=0').bind(Date.now()-181*86400000).run();
 await mf.getWorker().then(w=>w.scheduled({cron:'local-test'}));
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM accounts').first()).n,0,'expired deleted account shells are physically purged');
 }finally{await mf.dispose();}
 const disabled=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:fileURLToPath(new URL('../.build/index.js',import.meta.url)),compatibilityDate:'2026-10-01',compatibilityFlags:['nodejs_compat'],bindings:{RELEASE_ENABLED:'0'}}));try{assert.equal((await disabled.dispatchFetch('https://chat.test/api/info')).status,503);assert.equal((await disabled.dispatchFetch('https://chat.test/')).status,503);}finally{await disabled.dispose();}
});

test('one guardian can connect siblings and both children can send messages',async()=>{
 const {mf,call,ok,parent,child,enable}=await fixture();
 try{
  const guardian=await parent('siblings_parent'),otherGuardian=await parent('other_parent');
  const first=await child(guardian,'sibling_first'),second=await child(guardian,'sibling_second');
  const outsider=await child(otherGuardian,'other_child');
  const path='/api/friends/household',pair={child_id:first.id,peer_id:second.id};
  assert.equal((await call(path,first,'POST',pair)).status,403);
  assert.equal((await call(path,guardian,'POST',{child_id:first.id,peer_id:outsider.id})).status,403);
  const created=await ok(path,guardian,'POST',pair);
  assert.equal((await ok(path,guardian,'POST',{child_id:second.id,peer_id:first.id})).id,created.id);
  const messages='/api/talks/'+created.id+'/messages';
  assert.equal((await call(messages,first)).status,403);
  await enable(guardian,first);await enable(guardian,second);
  assert.equal((await ok('/api/friends',first)).friends[0].state,'active');
  assert.equal((await ok('/api/friends',second)).friends[0].id,created.id);
  await ok(messages,first,'POST',{kind:'text',text:'こんにちは',nonce:'sibling-first-0001'});
  await ok(messages,second,'POST',{kind:'text',text:'こんにちは！',nonce:'sibling-second-001'});
  assert.deepEqual((await ok(messages,second)).messages.map(m=>m.text),['こんにちは','こんにちは！']);
  assert.equal((await call(messages,outsider)).status,403);
  await ok('/api/friends/'+created.id+'/block?child='+second.id,guardian,'POST',{});
  assert.equal((await call(path,guardian,'POST',pair)).status,409);
  assert.equal((await call(messages,first)).status,403);
 }finally{await mf.dispose();}
});

test('family group: guardian and siblings send as themselves, unrelated family denied, time and pause enforced',async()=>{
 const t=await fixture();try{const {ok,call,parent,child,enable}=t;
 const p=await parent('group_parent'),other=await parent('other_parent'),a=await child(p,'group_child_a'),b=await child(p,'group_child_b'),c=await child(other,'other_child');
 await enable(p,a);await enable(p,b);await enable(other,c);
 assert.equal((await call('/api/family-groups',p,'POST',{member_ids:[a.id,c.id]})).status,403);
 assert.equal((await call('/api/family-groups',a,'POST',{member_ids:[b.id]})).status,403);
 const g=await ok('/api/family-groups',p,'POST',{member_ids:[a.id,b.id]});
 assert.equal((await ok('/api/family-groups',p,'POST',{member_ids:[a.id,b.id]})).id,g.id);
 for(const who of [p,a,b]){assert.equal((await ok('/api/family-groups',who)).groups[0].members.length,3);await ok('/api/family-groups/'+g.id+'/messages',who,'POST',{kind:'text',text:'test',nonce:crypto.randomUUID()});}
 const path='/api/family-groups/'+g.id+'/messages';
 assert.deepEqual((await ok(path,b)).messages.map(m=>m.author_id),[p.id,a.id,b.id]);
 assert.equal((await call(path,c)).status,403);assert.equal((await call(path,other)).status,403);
 await enable(p,a,true);assert.equal((await call(path,a)).status,403);
 assert.equal((await ok(path,p)).messages.length,3);
 }finally{await t.mf.dispose();}
});

test('HOME link requires existing account credentials, one-time signed ticket and stable identity',async()=>{
 const t=await fixture();try{const {ok,call,parent}=t;const p=await parent('link_parent'),other=await parent('link_other');
 const enc=new TextEncoder(),secret='isolated-test-secret-only-1234567890',verifier='a'.repeat(64),challenge=await hash(verifier);
 async function ticket(sub){const payload=Buffer.from(JSON.stringify({aud:'oshaberi-home-v1',sub,name:'fixture',challenge,nonce:await hash(crypto.randomUUID()),exp:Date.now()+60000})).toString('base64url');const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return payload+'.'+Buffer.from(await crypto.subtle.sign('HMAC',key,enc.encode(payload))).toString('base64url');}
 const one=await ticket('home-a');assert.equal((await call('/api/home-link',null,'POST',{ticket:one,verifier:'b'.repeat(64)})).status,403);assert.equal((await ok('/api/home-link',null,'POST',{verifier,ticket:one})).link_required,true);
 assert.equal((await call('/api/home-link',null,'POST',{verifier,ticket:one,login:'link_parent',password:'wrong-password-123'})).status,401);
 const linked=await call('/api/home-link',null,'POST',{verifier,ticket:one,login:'link_parent',password});assert.equal(linked.status,200);assert.equal((await ok('/api/me',{cookie:linked.headers.get('set-cookie').split(';')[0]})).id,p.id);
 assert.equal((await call('/api/home-link',null,'POST',{verifier,ticket:one})).status,409);
 const two=await ticket('home-a');const auto=await call('/api/home-link',other,'POST',{verifier,ticket:two});assert.equal(auto.status,200);assert.equal((await ok('/api/me',{cookie:auto.headers.get('set-cookie').split(';')[0]})).id,p.id);
 const three=await ticket('home-b');assert.equal((await call('/api/home-link',null,'POST',{verifier,ticket:three,login:'link_parent',password})).status,409);
 assert.equal((await call('/api/home-link',null,'POST',{verifier,ticket:three+'x'})).status,403);
 }finally{await t.mf.dispose();}
});
