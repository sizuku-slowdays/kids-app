import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';

test('family tree enforces adults, household/photo boundaries, atomic revisions and recoverable data',async()=>{
 const mf=new Miniflare(convertV4MiniflareOptions({workers:[
  {name:'home-worker',modules:true,scriptPath:new URL('../.wrangler/test-build/index.js',import.meta.url).pathname,compatibilityDate:'2026-10-01',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'home-calendar'},r2Buckets:{PRIVATE_FILES:'private-tree'},serviceBindings:{CALENDAR_SERVICE:'calendar-worker',ASSETS:async r=>new Response(await readFile(new URL('../public/calendar.html',import.meta.url),'utf8'),{headers:{'Content-Type':'text/html'}})}},
  {name:'calendar-worker',modules:true,script:await readFile(new URL('../../calendar-worker/calendar-worker.js',import.meta.url),'utf8'),compatibilityDate:'2026-10-01',d1Databases:{DB:'legacy-calendar'},serviceBindings:{HOME_AUTH:'home-worker'}}
 ]}));
 try{
 const home=await mf.getD1Database('DB','home-worker'),cal=await mf.getD1Database('DB','calendar-worker');
 for(const file of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort()){
  const sql=(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8')).replace(/^--.*$/gm,'');
  for(const stmt of sql.match(/\s*CREATE TRIGGER[\s\S]*?\nEND;|[^;]+;/g)||[])await home.prepare(stmt).run();
 }
 const now=Math.floor(Date.now()/1000),tokens={mom:'a'.repeat(64),grandpa:'b'.repeat(64),foreign:'c'.repeat(64)};
 for(const id of Object.keys(tokens)){
  await home.prepare("INSERT INTO users(id,login_name,display_name,password_salt,password_hash,password_iterations,platform_role,created_at) VALUES (?,?,?,'s','h',1,?,?)").bind(id,id,id,id==='mom'?'operator':'user',now).run();
  await home.prepare("INSERT INTO sessions VALUES (?,?,?,'test',?,?,?,NULL)").bind(id,createHash('sha256').update(tokens[id]).digest('hex'),id,now,now,now+10000).run();
 }
 await home.prepare("INSERT INTO groups VALUES ('h','家族','household','mom',?),('other','別家庭','household','foreign',?)").bind(now,now).run();
 await home.prepare("INSERT INTO memberships VALUES ('h','mom','owner'),('h','grandpa','member'),('other','foreign','owner')").run();
 await home.prepare("INSERT INTO group_apps VALUES ('h','calendar'),('other','calendar')").run();
 await home.prepare("INSERT INTO user_apps VALUES ('grandpa','calendar',0,0)").run();

 await home.prepare("INSERT INTO group_apps VALUES ('h','family-tree'),('other','family-tree')").run();
 async function call(path='',who='mom',method='GET',body,household='h') {const form=body instanceof FormData,url='https://cetus.fun/wagaya/api/family-tree'+path+(path.includes('?')?'&':'?')+'household='+household;const encoded=form?new Request(url,{method,body}):null;return mf.dispatchFetch(url,{method,headers:{Origin:'https://cetus.fun',...(who?{Cookie:'__Host-home_session='+tokens[who]}:{}),'Content-Type':form?encoded.headers.get('Content-Type'):'application/json'},body:form?await encoded.arrayBuffer():body?JSON.stringify(body):undefined});}
 const countBefore=(await home.prepare("SELECT COUNT(*) n FROM users").first()).n;
 assert.equal((await call('',null)).status,401);assert.equal((await call('','foreign')).status,403);
 let state=await (await call()).json();assert.equal(state.adult,false);assert.equal(state.configure,true);
 assert.equal((await call('/people','mom','POST',{name:'未設定のまま',revision:state.revision})).status,403);
 async function peopleConfig(who,target,age){return mf.dispatchFetch('https://cetus.fun/wagaya/api/household-people?household=h',{method:'PUT',headers:{Origin:'https://cetus.fun',Cookie:'__Host-home_session='+tokens[who],'Content-Type':'application/json'},body:JSON.stringify({user_id:target,age_kind:age,nickname:target==='mom'?'ママ':''})});}
 assert.equal((await peopleConfig('grandpa','grandpa','adult')).status,403);
 assert.equal((await peopleConfig('mom','mom','adult')).status,200);assert.equal((await peopleConfig('mom','grandpa','child')).status,200);
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jf3sAAAAASUVORK5CYII=','base64');
 const form=new FormData();form.append('file',new File([png],'portrait.png',{type:'image/png'}));form.append('revision','0');let response=await call('/photos','mom','POST',form);assert.equal(response.status,201,await response.clone().text());const photo=await response.json();
 assert.equal((await call('/photos/'+photo.id,null)).status,401);assert.equal((await call('/photos/'+photo.id,'foreign','GET',null,'other')).status,404);
 response=await call('/people','mom','POST',{name:'母',home_user_id:'mom',gender:'female',birth_date:'1980',photo_id:photo.id,revision:1});assert.equal(response.status,201);const mother=(await response.json()).id;
 const childRead=await (await call('','grandpa')).json();assert.equal(childRead.adult,false);assert.equal(childRead.people[0].name,'母');assert.equal((await call('/photos/'+photo.id,'grandpa')).status,200);
 assert.equal((await call('/people','grandpa','POST',{name:'勝手な追加',revision:2})).status,403);assert.equal((await call('/backup','grandpa')).status,403);assert.equal((await call('/trash','grandpa')).status,403);
 assert.equal((await call('/people','mom','POST',{name:'他の家庭の本人',home_user_id:'foreign',revision:2})).status,400);
 assert.equal((await call('/people','mom','POST',{name:'日付不正',birth_date:'2026-00-01',revision:2})).status,400);
 assert.equal((await call('/people','mom','POST',{name:'日付不正',birth_date:'2026-02-29',revision:2})).status,400);
 response=await call('/people','mom','POST',{name:'子',home_user_id:'grandpa',gender:'female',birth_date:'2016-04-01',revision:2});assert.equal(response.status,201);const child=(await response.json()).id;
 response=await call('/relations','mom','POST',{from_person:mother,to_person:child,kind:'biological_parent',revision:3});assert.equal(response.status,201);const relation=(await response.json()).id;
 state=await (await call('','grandpa')).json();assert.equal(state.basis,child);
 assert.equal((await call('/relations','mom','POST',{from_person:child,to_person:mother,kind:'adoptive_parent',revision:4})).status,400);
 const concurrent=await Promise.all([call('/people/'+mother,'mom','PUT',{name:'母更新A',home_user_id:'mom',gender:'female',photo_id:photo.id,revision:4}),call('/people/'+mother,'mom','PUT',{name:'母更新B',home_user_id:'mom',gender:'female',photo_id:photo.id,revision:4})]);assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);
 assert.equal((await call('/people/'+mother,'mom','DELETE',{revision:5})).status,200);state=await (await call('','grandpa')).json();assert.equal(state.people.length,1);assert.equal(state.relations.length,0);assert.equal((await call('/photos/'+photo.id,'grandpa')).status,404);
 let trash=await (await call('/trash')).json();assert.equal(trash.people.length,1);assert.equal(trash.relations.length,1);
 assert.equal((await call('/restore-item','mom','POST',{kind:'person',id:mother,revision:6})).status,200);state=await (await call()).json();assert.equal(state.people.length,2);assert.equal(state.relations.length,1);
 const backup=await (await call('/backup')).json();assert.equal(backup.photos.length,1);assert.equal(backup.people.length,2);
 assert.equal((await call('/restore','mom','POST',{backup,revision:7})).status,400);
 assert.equal((await call('/restore','mom','POST',{backup:{...backup,household_id:'other'},confirm_replace:true,revision:7})).status,400);
 assert.equal((await call('/people/'+child,'mom','DELETE',{revision:7})).status,200);
 assert.equal((await call('/restore','mom','POST',{backup,confirm_replace:true,revision:8})).status,200);state=await (await call()).json();assert.equal(state.people.length,2);assert.equal(state.relations.length,1);assert.equal(state.revision,9);
 assert.deepEqual(Buffer.from(await (await call('/photos/'+photo.id,'grandpa')).arrayBuffer()),png);
 // Restoring either order of two deleted endpoints restores their automatically removed relationship.
 assert.equal((await call('/people/'+mother,'mom','DELETE',{revision:9})).status,200);
 assert.equal((await call('/people/'+child,'mom','DELETE',{revision:10})).status,200);
 for(const path of ['', '/trash','/backup','/photos/'+photo.id])assert.equal((await call(path,'foreign')).status,403);
 assert.equal((await call('/restore-item','foreign','POST',{kind:'person',id:mother,revision:11})).status,403);
 assert.equal((await call('/people/'+mother,'foreign','PUT',{name:'他家庭から変更',revision:11},'other')).status,403);
 assert.equal((await call('/restore-item','grandpa','POST',{kind:'person',id:mother,revision:11})).status,403);
 assert.equal((await call('/restore-item','mom','POST',{kind:'person',id:mother,revision:11})).status,200);
 state=await (await call()).json();assert.equal(state.relations.length,0);
 assert.equal((await call('/restore-item','mom','POST',{kind:'person',id:child,revision:12})).status,200);
 state=await (await call()).json();assert.equal(state.people.length,2);assert.equal(state.relations.length,1);assert.equal(state.relations[0].id,relation);
 // A relationship deleted on its own stays in the trash when its person is restored.
 assert.equal((await call('/relations/'+relation,'mom','DELETE',{revision:13})).status,200);
 assert.equal((await call('/people/'+mother,'mom','DELETE',{revision:14})).status,200);
 assert.equal((await call('/restore-item','mom','POST',{kind:'person',id:mother,revision:15})).status,200);
 state=await (await call()).json();assert.equal(state.relations.length,0);
 assert.equal((await call('/restore-item','mom','POST',{kind:'relation',id:relation,revision:16})).status,200);
 state=await (await call()).json();assert.equal(state.relations.length,1);
 // Knowing another household's person ID does not grant read, edit, delete or restore access.
 await home.prepare("INSERT INTO home_member_attributes VALUES ('other','foreign','adult','foreign','now')").run();
 for(const [path,method,body] of [['/people/'+mother,'PUT',{name:'侵入',revision:0}],['/people/'+mother,'DELETE',{revision:0}],['/restore-item','POST',{kind:'person',id:mother,revision:0}]])assert.equal((await call(path,'foreign',method,body,'other')).status,404);
 const otherState=await (await call('','foreign','GET',null,'other')).json();assert.equal(otherState.people.length,0);assert.equal(JSON.stringify(otherState).includes(mother),false);
 // Person and initial relation commit together, with household and revision checks.
 state=await (await call()).json();const combinedRevision=state.revision;
 const beforeCombined=state.people.length;
 let combined=await call('/people','mom','POST',{name:'追加する子',revision:combinedRevision,initial_relationship:{person_id:'missing',role:'child'}});
 assert.equal(combined.status,400);state=await (await call()).json();assert.equal(state.people.length,beforeCombined);assert.equal(state.revision,combinedRevision);
 combined=await call('/people','mom','POST',{name:'追加する子',revision:combinedRevision-1,initial_relationship:{person_id:mother,role:'child'}});
 assert.equal(combined.status,409);state=await (await call()).json();assert.equal(state.people.length,beforeCombined);
 combined=await call('/people','grandpa','POST',{name:'追加する子',revision:combinedRevision,initial_relationship:{person_id:mother,role:'child'}});assert.equal(combined.status,403);
 combined=await call('/people','mom','POST',{name:'追加する子',revision:combinedRevision,initial_relationship:{person_id:mother,role:'child'}});assert.equal(combined.status,201);
 const newPerson=await combined.json();state=await (await call()).json();assert.equal(state.people.length,beforeCombined+1);assert.equal(state.revision,combinedRevision+1);
 assert.ok(state.relations.some(r=>r.id===newPerson.relationship_id&&r.from_person===mother&&r.to_person===newPerson.id&&r.kind==='biological_parent'));
 const noLogin=await call('/photos/'+photo.id,null);assert.equal(noLogin.status,401);assert.equal(Buffer.from(await noLogin.arrayBuffer()).equals(png),false);
 const photoResponse=await call('/photos/'+photo.id,'grandpa');assert.equal(photoResponse.headers.get('Cache-Control'),'private, no-store');
 assert.equal((await home.prepare('SELECT COUNT(*) n FROM users').first()).n,countBefore);
 await home.prepare("UPDATE sessions SET revoked_at=? WHERE user_id='grandpa'").bind(now).run();assert.equal((await call('','grandpa')).status,401);
 }finally{await mf.dispose();}
});
