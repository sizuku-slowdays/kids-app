import {fileURLToPath} from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
test('release config has no production IDs, domains, service binding, push integration or remote test commands',async()=>{
 const text=await readFile(new URL('../wrangler.jsonc',import.meta.url),'utf8'),config=JSON.parse(text.replace(/^\s*\/\/.*$/gm,''));
 assert.equal(config.workers_dev,false);assert.equal(config.preview_urls,false);assert.equal(config.vars.RELEASE_ENABLED,'0');assert.equal(config.vars.INVITATIONS_ENABLED,'0');assert.equal(config.vars.REGISTRATION_ENABLED,'0');
 assert.equal(config.routes,undefined);assert.equal(config.services,undefined);assert.equal(config.triggers,undefined);assert.equal(config.d1_databases[0].database_id,'00000000-0000-0000-0000-000000000000');assert.equal(config.assets.run_worker_first,true);
 assert.doesNotMatch(text,/fed5c0be|6835690b|fa30f8a0|home-private|NOTIFICATION_SERVICE|HOME_AUTH/);
 for(const file of ['app.js','sw.js']){const source=await readFile(new URL('../public/'+file,import.meta.url),'utf8');assert.doesNotMatch(source,/PushManager|new Notification|Notification\.requestPermission|\.showNotification\s*\(|caches\.open|localStorage/);}
 const source=await readFile(new URL('../src/index.js',import.meta.url),'utf8');assert.doesNotMatch(source,/console\.(?:log|error)\(req|console\.(?:log|error)\(b\b/);
 assert.doesNotMatch(await readFile(new URL('../package.json',import.meta.url),'utf8'),/--remote/);
});

test('private staging denies direct asset/API/media requests before accessing bindings',async()=>{
 const {Miniflare,convertV4MiniflareOptions}=await import('miniflare');let calls=0;
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:fileURLToPath(new URL('../.build/index.js',import.meta.url)),compatibilityDate:'2026-10-01',compatibilityFlags:['nodejs_compat'],bindings:{RELEASE_ENABLED:'1',PRIVATE_TEST_MODE:'1',REGISTRATION_ENABLED:'0',INVITATIONS_ENABLED:'0'},serviceBindings:{ASSETS:()=>{calls++;return new Response('must not appear');}}}));
 try{for(const path of ['/','/app.js','/sw.js','/api/me','/api/media','/media/guess']){const r=await mf.dispatchFetch('https://owner.test'+path);assert.equal(r.status,403);assert.equal(r.headers.get('Cache-Control'),'no-store');assert.equal(r.headers.get('X-Robots-Tag'),'noindex, nofollow, noarchive');}assert.equal(calls,0);}finally{await mf.dispose();}
});
