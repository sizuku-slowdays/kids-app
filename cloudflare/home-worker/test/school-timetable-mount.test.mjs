import test from 'node:test';
import assert from 'node:assert/strict';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
test('legacy timetable image HTML is preserved with only an authenticated school bridge added',async()=>{
 const legacy='<html><body><main><div class="week-tabs"></div><img src="unchanged-image.jpg"></main></body></html>';
 const requests=[];
 const mf=new Miniflare(convertV4MiniflareOptions({name:'timetable-mount',modules:true,scriptPath:new URL('../.wrangler/test-build/index.js',import.meta.url).pathname,compatibilityDate:'2026-10-01',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'mount'},outboundService:async request=>{requests.push(request.url);return new Response(legacy,{headers:{'Content-Type':'text/html','ETag':'old','Cache-Control':'public,max-age=3600'}});},serviceBindings:{ASSETS:()=>new Response('asset')}}));
 try{
 const response=await mf.dispatchFetch('https://cetus.fun/wagaya/timetable.html?child=c&day=2026-10-20');
 assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert.equal(response.headers.get('ETag'),null);
 const text=await response.text();assert.equal(text,legacy.replace('</body>','<script type="module" src="/wagaya/apps/school-prep/timetable-link.js"></script></body>'));
 assert.match(requests[0],/child=c&day=2026-10-20/);
 }finally{await mf.dispose();}
});
