import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';

test('original wagaya URL serves HOME, sessions, app assets and redirects on the same origin',async()=>{
 const mf=new Miniflare(convertV4MiniflareOptions({name:'home-worker',modules:true,
  scriptPath:new URL('../.wrangler/test-build/index.js',import.meta.url).pathname,
  compatibilityDate:'2026-10-01',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'mount-test'},
  bindings:{BOOTSTRAP_SECRET:'test-bootstrap-secret'},serviceBindings:{ASSETS:async request=>{
   const path=new URL(request.url).pathname;
   const type=path.endsWith('.js')?'application/javascript':path.endsWith('.webmanifest')?'application/manifest+json':'text/html';
   return new Response(await readFile(new URL('../public'+path,import.meta.url),'utf8'),{headers:{'Content-Type':type}});
  }}}));
 try {
  const db=await mf.getD1Database('DB');
  for(const file of ['0001_foundation.sql','0003_muscle_bank.sql']){
   const sql=await readFile(new URL('../migrations/'+file,import.meta.url),'utf8');
   for(const s of sql.replace(/^--.*$/gm,'').split(';').filter(s=>s.trim()))await db.prepare(s).run();
  }
  async function call(path,{method='GET',body,cookie,origin='https://cetus.fun'}={}){
   return mf.dispatchFetch('https://cetus.fun/wagaya'+path,{method,redirect:'manual',
    headers:{Origin:origin,...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  }
  let r=await call('/');assert.equal(r.status,303);assert.equal(r.headers.get('Location'),'/wagaya/login');
  assert.equal((await call('/api/me')).status,401);
  r=await call('/login');const html=await r.text();assert.equal(r.status,200);
  assert.match(html,/src="\/wagaya\/app.js"/);assert.match(html,/href="\/wagaya\/style.css"/);
  assert.match(html,/mount-pwa.js/);assert.doesNotMatch(html,/home-worker\.sslowdayss\.workers\.dev/);
  r=await call('/app.js');const script=await r.text();
  assert.match(script,/api\("\/wagaya\/api\/me"\)/);
  assert.match(script,/location.replace\("\/wagaya\/"\)/);
  assert.match(script,/pathname.startsWith\('\/wagaya\/apps\/'\)/);
  assert.match(script,/https:\/\/cetus.fun\/wagaya\/old-home.html/);
  const bootstrap={secret:'test-bootstrap-secret',household_name:'家族',display_name:'非公開の親',login_name:'mama',password:'test-password-123',device_name:'端末'};
  assert.equal((await call('/api/bootstrap',{method:'POST',body:bootstrap,origin:'https://evil.test'})).status,403);
  r=await call('/api/bootstrap',{method:'POST',body:bootstrap});assert.equal(r.status,201);
  const cookie=r.headers.get('Set-Cookie').split(';')[0];assert.match(r.headers.get('Set-Cookie'),/Path=\/; HttpOnly; Secure; SameSite=Lax/);
  const me=await (await call('/api/me',{cookie})).json();assert.equal(me.user.display_name,'非公開の親');
  r=await call('/',{cookie});assert.equal(r.status,200);assert.equal(r.headers.get('Location'),null);
  const apps=await (await call('/api/home',{cookie})).json();assert.equal(apps.find(a=>a.id==='muscle-bank').path,'/wagaya/apps/muscle-bank/');
  r=await call('/apps/muscle-bank/',{cookie});assert.match(await r.text(),/href="\/wagaya\/"/);
  r=await call('/apps/muscle-bank/config.js',{cookie});assert.match(await r.text(),/apiBase:'\/wagaya\/api\/muscle-bank'/);
  assert.equal((await call('/apps/muscle-bank/')).status,303);
  assert.equal((await call('/media/private-photo')).status,401);
  const manifest=await (await call('/manifest.json')).json();assert.equal(manifest.id,'/wagaya/');assert.equal(manifest.start_url,'/wagaya/');assert.equal(manifest.scope,'/wagaya/');
  r=await call('/sw.js');assert.match(await r.text(),/wagaya-shell-/);assert.equal(r.headers.get('Cache-Control'),'no-store');
  r=await call('/api/logout',{method:'POST',body:{},cookie});assert.equal(r.status,200);
  assert.equal((await call('/api/me',{cookie})).status,401);
 } finally {await mf.dispose()}
});
