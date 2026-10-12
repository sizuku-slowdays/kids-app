import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {calculate,yen} from '../public/apps/dining-prices/calculator.js';
const prices=[[3828,3498,3608,1914,0],[4708,4268,4378,2354,0],[5808,5368,5478,2904,0],[6908,6468,6578,3454,0]];
test('dining totals and differences match every category in the supplied flyer',()=>{
 const courses=prices.map((p,i)=>({id:String(i),name:String(i),prices:p}));
 assert.deepEqual(calculate(courses,[0,0,0,0,0]).courses.map(c=>c.total),[0,0,0,0]);
 for(let i=0;i<5;i++){const counts=[0,0,0,0,0];counts[i]=1;assert.deepEqual(calculate(courses,counts).courses.map(c=>c.total),prices.map(p=>p[i]));}
 const family=calculate(courses,[1,0,0,2,0]);assert.equal(family.people,3);assert.deepEqual(family.courses.map(c=>c.total),[7656,9416,11616,13816]);assert.deepEqual(family.courses.map(c=>c.difference),[0,1760,3960,6160]);assert.equal(family.courses[2].total-family.courses[1].total,2200);
 const relatives=calculate(courses,[1,2,1,3,1]);assert.equal(relatives.people,8);assert.deepEqual(relatives.courses.map(c=>c.total),[20174,24684,30734,36784]);assert.equal(yen(20174),'20,174円');assert.throws(()=>calculate(courses,[-1,0,0,0,0]));
});
test('HOME auth, household separation, persistent CRUD and concurrent saves preserve existing data',async()=>{
 const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'home-worker',modules:true,scriptPath:new URL('../.wrangler/test-build/index.js',import.meta.url).pathname,compatibilityDate:'2026-10-01',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'dining-test'},serviceBindings:{ASSETS:async req=>{const file=new URL(req.url).pathname;return new Response(await readFile(new URL('../public'+file,import.meta.url)),{headers:{'Content-Type':file.endsWith('.html')?'text/html':'text/javascript'}});}}}]}));
 try{
  const db=await mf.getD1Database('DB','home-worker');
  for(const file of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort()){const sql=(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8')).replace(/^--.*$/gm,'');for(const statement of sql.match(/\s*CREATE TRIGGER[\s\S]*?\nEND;|[^;]+;/g)||[])await db.prepare(statement).run();}
  const now=Math.floor(Date.now()/1000),tokens={mom:'a'.repeat(64),kid:'b'.repeat(64),other:'c'.repeat(64)};
  for(const id of Object.keys(tokens)){
   await db.prepare("INSERT INTO users(id,login_name,display_name,password_salt,password_hash,password_iterations,platform_role,created_at) VALUES(?,?,?,'s','h',1,'user',?)").bind(id,id,id,now).run();
   await db.prepare("INSERT INTO sessions VALUES(?,?,?,'test',?,?,?,NULL)").bind(id,createHash('sha256').update(tokens[id]).digest('hex'),id,now,now,now+10000).run();
  }
  await db.prepare("INSERT INTO groups VALUES('h','家族','household','mom',?),('other','別家庭','household','other',?)").bind(now,now).run();
  await db.prepare("INSERT INTO memberships VALUES('h','mom','owner'),('h','kid','member'),('other','other','owner')").run();
  await db.prepare("INSERT INTO group_apps VALUES('h','dining-prices'),('other','dining-prices')").run();
  await db.prepare("INSERT INTO home_member_attributes VALUES('h','kid','child','mom','now')").run();
  const before=JSON.stringify((await db.prepare('SELECT * FROM users ORDER BY id').all()).results);
  const call=(who='mom',method='GET',body,household='h')=>mf.dispatchFetch('https://cetus.fun/wagaya/api/dining-prices?household='+household,{method,headers:{Origin:'https://cetus.fun','Content-Type':'application/json',...(who?{Cookie:'__Host-home_session='+tokens[who]}:{})},body:body?JSON.stringify(body):undefined});
  assert.equal((await call(null)).status,401);assert.equal((await call('other')).status,403);
  const first=await (await call()).json();assert.equal(first.editable,true);assert.deepEqual(first.stores[0].courses.map(c=>c.prices),prices);
  assert.equal((await (await call('kid')).json()).editable,false);assert.equal((await call('kid','PUT',{revision:first.revision,stores:[]})).status,403);
  const stores=structuredClone(first.stores);stores.push({id:'another',name:'別のお店',note:'税込',courses:[{id:'c',name:'コース',prices:[1000,900,800,500,0]}]});
  assert.equal((await call('mom','PUT',{revision:first.revision,stores})).status,200);assert.equal((await (await call()).json()).stores.length,3);
  assert.equal((await call('mom','PUT',{revision:first.revision,stores:[]})).status,409);
  let latest=await (await call()).json();const bad=structuredClone(latest.stores);bad[0].courses[0].prices[0]=-1;assert.equal((await call('mom','PUT',{revision:latest.revision,stores:bad})).status,400);
  const other=await (await call('other','GET',null,'other')).json();assert.equal(other.stores.length,2);assert.deepEqual(other.stores[0].courses.map(c=>c.prices),prices);
  assert.equal((await call('mom','PUT',{revision:latest.revision,stores:[]})).status,200);assert.deepEqual((await (await call()).json()).stores,[]);
  // Existing custom buffet prices are appended to, backed up and never reset.
  await db.prepare("INSERT INTO groups VALUES('late','後からの家庭','household','mom',?)").bind(now).run();
  await db.prepare("INSERT INTO memberships VALUES('late','mom','owner')").run();await db.prepare("INSERT INTO group_apps VALUES('late','dining-prices')").run();
  const oldStores=[structuredClone(first.stores[0]),{id:'my-store',name:'保存済みの店',note:'残すメモ',courses:[]}];oldStores[0].courses[0].prices[0]=4001;
  await db.prepare("INSERT INTO dining_price_states VALUES('late',?,9,'mom','now')").bind(JSON.stringify(oldStores)).run();
  const imported=await (await call('mom','GET',null,'late')).json();assert.equal(imported.stores.length,3);assert.deepEqual(imported.stores.slice(0,2),oldStores);assert.equal(imported.revision,10);
  const backup=await db.prepare("SELECT stores_json,revision FROM dining_price_backups WHERE household_id='late'").first();assert.equal(backup.stores_json,JSON.stringify(oldStores));assert.equal(backup.revision,9);
  const again=await (await call('mom','GET',null,'late')).json();assert.equal(again.revision,10);
  const restaurant=again.stores.find(s=>s.type==='order');assert.equal(restaurant.products.length,106);assert.equal(restaurant.products.reduce((n,p)=>n+p.variants.length,0),189);
  const changes=structuredClone(again.stores);changes.find(s=>s.type==='order').products[0].variants[0].price=9999;
  assert.equal((await call('mom','PUT',{revision:again.revision,stores:changes},'late')).status,200);
  assert.equal((await (await call('mom','GET',null,'late')).json()).stores.find(s=>s.type==='order').products[0].variants[0].price,9999);
  let saved=await (await call('mom','GET',null,'late')).json();assert.equal(saved.stores[0].courses[0].prices[0],4001);
  assert.equal((await call('mom','PUT',{revision:saved.revision,stores:oldStores},'late')).status,200);
  assert.deepEqual((await (await call('mom','GET',null,'late')).json()).stores,oldStores);
  assert.equal(JSON.stringify((await db.prepare('SELECT * FROM users ORDER BY id').all()).results),before);
  const homeApps=await mf.dispatchFetch('https://cetus.fun/wagaya/api/home',{headers:{Cookie:'__Host-home_session='+tokens.mom}});assert.ok((await homeApps.json()).some(a=>a.id==='dining-prices'&&a.path==='/wagaya/apps/dining-prices/'));
  const page=await mf.dispatchFetch('https://cetus.fun/wagaya/apps/dining-prices/',{headers:{Cookie:'__Host-home_session='+tokens.mom}});assert.equal(page.status,200);assert.ok((await page.text()).includes('外食料金'));
  assert.equal((await mf.dispatchFetch('https://cetus.fun/wagaya/apps/dining-prices/',{redirect:'manual'})).status,303);
 }finally{await mf.dispose();}
});

