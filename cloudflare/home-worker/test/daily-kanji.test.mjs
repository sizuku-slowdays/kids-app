import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
const catalog=JSON.parse(await readFile(new URL('../public/apps/daily-kanji/catalog.json',import.meta.url),'utf8'));
test('all 1,026 curriculum characters have readings, a meaning, a full example and bundled ordered strokes',async()=>{
 const expected=[80,160,200,202,193,191];assert.equal(catalog.entries.length,1026);assert.equal(new Set(catalog.entries.map(x=>x.character)).size,1026);
 for(let g=1;g<=6;g++){
  const entries=catalog.entries.filter(x=>x.grade===g);assert.equal(entries.length,expected[g-1]);
  const strokes=JSON.parse(await readFile(new URL('../public/apps/daily-kanji/strokes-'+g+'.json',import.meta.url),'utf8'));
  assert.equal(Object.keys(strokes).length,entries.length);
  for(const x of entries){assert.ok(x.on.length||x.kun.length,x.character);assert.ok(x.meaning&&x.meaning_reading&&x.example_reading);assert.ok(x.example.includes(x.character));assert.ok(strokes[x.character].length>0);assert.ok(strokes[x.character].every(d=>/^[Mm]/.test(d)));}
 }
 assert.equal(catalog.entries.filter(x=>x.grade<=3).length,440);
 const get=c=>catalog.entries.find(x=>x.character===c);assert.equal(get('雲').example,'雲海');assert.equal(get('会').example_reading,'あさのかい');assert.equal(get('福').example_reading,'ふくのかみ');
});
test('Japan midnight and April progression, plus unseen-first selection with no duplicates',async()=>{
 const source=await readFile(new URL('../src/daily-kanji.ts',import.meta.url),'utf8'),exports={};
 const context=vm.createContext({exports,require:()=>({}),Date,Set,Uint32Array,crypto:globalThis.crypto});vm.runInContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
 assert.equal(exports.schoolClock(new Date('2026-10-14T14:59:59Z')).day,'2026-10-14');assert.equal(exports.schoolClock(new Date('2026-10-14T15:00:00Z')).day,'2026-10-15');
 assert.equal(exports.schoolClock(new Date('2027-03-31T14:59:59Z')).year,2026);assert.equal(exports.schoolClock(new Date('2027-03-31T15:00:00Z')).year,2027);
 assert.equal(exports.currentGrade({base_grade:6,base_school_year:2026,auto_advance:1},2027),7);
 assert.equal(exports.currentGrade({base_grade:4,base_school_year:2026,auto_advance:1},2027),5);assert.equal(exports.currentGrade({base_grade:2,base_school_year:2026,auto_advance:0},2027),2);
 const choice=Array.from(exports.chooseThree(['一','二','三','四','五'],new Set(['一','二']),()=>.25));assert.equal(choice.length,3);assert.equal(new Set(choice).size,3);assert.ok(choice.every(c=>!['一','二'].includes(c)));
});
test('HOME family permissions, school setup, stable daily sets and idempotent cross-device learning',async()=>{
 const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'home-worker',modules:true,scriptPath:new URL('../.wrangler/test-build/index.js',import.meta.url).pathname,compatibilityDate:'2026-10-01',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'kanji-test'},serviceBindings:{ASSETS:async req=>{const file=new URL(req.url).pathname;return new Response(await readFile(new URL('../public'+file,import.meta.url)),{headers:{'Content-Type':file.endsWith('.html')?'text/html':file.endsWith('.json')?'application/json':'text/javascript'}});}}}]}));
 try{
  const db=await mf.getD1Database('DB','home-worker');
  for(const file of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort()){const sql=(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8')).replace(/^--.*$/gm,'');for(const st of sql.match(/\s*CREATE TRIGGER[\s\S]*?\nEND;|[^;]+;/g)||[])await db.prepare(st).run();}
  const now=Math.floor(Date.now()/1000),tokens={mom:'a'.repeat(64),big:'b'.repeat(64),small:'c'.repeat(64),other:'d'.repeat(64),otherKid:'e'.repeat(64)};
  for(const id of Object.keys(tokens)){await db.prepare("INSERT INTO users(id,login_name,display_name,password_salt,password_hash,password_iterations,platform_role,created_at) VALUES(?,?,?,'s','h',1,'user',?)").bind(id,id,id,now).run();await db.prepare("INSERT INTO sessions VALUES(?,?,?,'test',?,?,?,NULL)").bind(id,createHash('sha256').update(tokens[id]).digest('hex'),id,now,now,now+10000).run();}
  await db.prepare("INSERT INTO groups VALUES('h','家族','household','mom',?),('other','別家庭','household','other',?)").bind(now,now).run();
  await db.prepare("INSERT INTO memberships VALUES('h','mom','owner'),('h','big','member'),('h','small','member'),('other','other','owner'),('other','otherKid','member')").run();
  await db.prepare("INSERT INTO group_apps VALUES('h','daily-kanji'),('other','daily-kanji')").run();
  await db.prepare("INSERT INTO children VALUES('cb','h','上の子','big'),('cs','h','下の子','small'),('co','other','別家庭の子','otherKid')").run();
  await db.prepare("INSERT INTO home_member_attributes VALUES('h','big','child','mom','now'),('h','small','child','mom','now'),('other','otherKid','child','other','now')").run();
  const usersBefore=JSON.stringify((await db.prepare('SELECT * FROM users ORDER BY id').all()).results);
  const call=(who='big',path='',method='GET',body,household='h')=>mf.dispatchFetch('https://cetus.fun/wagaya/api/daily-kanji'+path+'?household='+household,{method,headers:{Origin:'https://cetus.fun','Content-Type':'application/json',...(who?{Cookie:'__Host-home_session='+tokens[who]}:{})},body:body?JSON.stringify(body):undefined});
  assert.equal((await call(null)).status,401);assert.equal((await call('other')).status,403);assert.equal((await call('big','/family')).status,403);
  assert.equal((await (await call()).json()).profile,null);
  assert.equal((await call('big','/profile','PUT',{user_id:'big',grade:4,auto_advance:true})).status,403);
  assert.equal((await call('mom','/profile','PUT',{user_id:'otherKid',grade:4,auto_advance:true})).status,403);
  for(const [id,grade]of [['big',4],['small',2]])assert.equal((await call('mom','/profile','PUT',{user_id:id,grade,auto_advance:true})).status,200);
  const [one,two]=await Promise.all([call().then(r=>r.json()),call().then(r=>r.json())]);assert.equal(one.pool_size,440);assert.deepEqual(one.today.characters,two.today.characters);assert.equal(new Set(one.today.characters).size,3);
  assert.equal((await (await call('small')).json()).pool_size,80);
  const c=one.today.characters[0],body={day:one.day,character:c,user_id:'small'};
  const confirms=await Promise.all([call('big','/confirm','POST',body),call('big','/confirm','POST',body)]);assert.ok(confirms.every(r=>r.status===200));
  assert.equal((await db.prepare('SELECT confirmations FROM kanji_mastery WHERE user_id=? AND character=?').bind('big',c).first()).confirmations,1);
  assert.equal((await (await call('small')).json()).mastery.length,0);
  assert.equal((await call('big','/confirm','POST',{day:'1999-01-01',character:c})).status,409);
  const notToday=catalog.entries.find(x=>!one.today.characters.includes(x.character)).character;assert.equal((await call('big','/confirm','POST',{day:one.day,character:notToday})).status,400);
  for(const char of one.today.characters)assert.equal((await call('big','/confirm','POST',{day:one.day,character:char})).status,200);
  const done=await (await call()).json();assert.equal(done.today.confirmed.length,3);assert.equal(done.mastery.length,3);
  assert.equal((await call('big','/review','POST',{character:c})).status,200);assert.equal((await call('big','/review','POST',{character:notToday})).status,400);
  const summary=await (await call('mom','/family')).json();assert.equal(summary.children.length,2);assert.ok(summary.children.every(x=>x.user_id!=='otherKid'));assert.equal(summary.children.find(x=>x.user_id==='big').mastered,3);
  assert.equal((await (await call('other','/family','GET',null,'other')).json()).children.length,1);
  assert.equal((await call('mom','/profile','PUT',{user_id:'big',grade:3,auto_advance:true})).status,200);assert.deepEqual((await (await call()).json()).today.characters,one.today.characters);
  // Expanding the new API does not modify existing accounts or prior application data.
  assert.equal(JSON.stringify((await db.prepare('SELECT * FROM users ORDER BY id').all()).results),usersBefore);
  const home=await mf.dispatchFetch('https://cetus.fun/wagaya/api/home',{headers:{Cookie:'__Host-home_session='+tokens.small}});assert.ok((await home.json()).some(x=>x.id==='daily-kanji'));
  const anonymous=await mf.dispatchFetch('https://cetus.fun/wagaya/apps/daily-kanji/',{redirect:'manual'});assert.equal(anonymous.status,303);
  const asset=await mf.dispatchFetch('https://cetus.fun/wagaya/apps/daily-kanji/',{headers:{Cookie:'__Host-home_session='+tokens.small}});assert.equal(asset.status,200);assert.match(await asset.text(),/まいにち/);
 }finally{await mf.dispose();}
});
