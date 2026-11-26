import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
test('HOME issues a short-lived signed chat launch only to an authenticated allowlisted user',async()=>{
 const secret='test-only-home-bridge-secret-1234567890';
 const mf=new Miniflare(convertV4MiniflareOptions({name:'home-test',modules:true,scriptPath:new URL('../.wrangler/test-build/index.js',import.meta.url).pathname,compatibilityDate:'2026-10-01',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'home-link-test'},r2Buckets:['PRIVATE_FILES'],bindings:{BOOTSTRAP_SECRET:'test-bootstrap-secret',OSHABERI_HOME_LINK_SECRET:secret,OSHABERI_HOME_USER_IDS:'bootstrap-admin'},serviceBindings:{ASSETS:()=>new Response('shell')}}));
 try{
  const db=await mf.getD1Database('DB');
  const initial=await readFile(new URL('../migrations/0001_foundation.sql',import.meta.url),'utf8');
  for(const sql of initial.split(';').filter(s=>s.trim()))await db.prepare(sql).run();
  async function call(path,method='GET',data,cookie){return mf.dispatchFetch('https://home.test'+path,{method,headers:{Origin:'https://home.test','Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1',...(cookie?{Cookie:cookie}:{})},body:data?JSON.stringify(data):undefined,redirect:'manual'});}
  const challenge='a'.repeat(64);
  assert.equal((await call('/api/oshaberi/launch','POST',{challenge})).status,401);
  async function user(id,raw){
   const now=Math.floor(Date.now()/1000);
   await db.prepare("INSERT INTO users(id,login_name,display_name,password_salt,password_hash,password_iterations,created_at) VALUES(?,?,?,?,?,?,?)").bind(id,id,'fixture','test','test',1,now).run();
   const digest=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw))).toString('hex');
   await db.prepare('INSERT INTO sessions(id,token_hash,user_id,device_name,created_at,last_seen_at,expires_at) VALUES(?,?,?,?,?,?,?)').bind(id,digest,id,'fixture',now,now,now+3600).run();
   return '__Host-home_session='+raw;
  }
  const cookie=await user('bootstrap-admin','1'.repeat(64));
  const other=await user('other-fixture','2'.repeat(64));
  assert.equal((await call('/api/oshaberi/launch','POST',{challenge},other)).status,403);
  assert.equal((await call('/api/oshaberi/launch','POST',{challenge:'x'},cookie)).status,400);
  const launch=await call('/api/oshaberi/launch','POST',{challenge},cookie);assert.equal(launch.status,200);
  const url=new URL((await launch.json()).url),[payload,signature]=new URLSearchParams(url.hash.slice(1)).get('home').split('.');
  const claims=JSON.parse(Buffer.from(payload,'base64url'));assert.equal(claims.sub,'bootstrap-admin');assert.equal(claims.challenge,challenge);assert.equal(claims.aud,'oshaberi-home-v1');assert.ok(claims.exp>Date.now()&&claims.exp<=Date.now()+120000);
  const enc=new TextEncoder(),key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  assert.ok(await crypto.subtle.verify('HMAC',key,Buffer.from(signature,'base64url'),enc.encode(payload)));
 }finally{await mf.dispose();}
});
