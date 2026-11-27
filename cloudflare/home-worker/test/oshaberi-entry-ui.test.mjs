import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const code=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const helper=code.slice(code.indexOf('function oshaberiEntryUrl('),code.indexOf('async function home()'));
const entry=vm.runInNewContext(helper+'\noshaberiEntryUrl',{URL});
const canonical='https://oshaberi.example.test/';
test('iOS uses clean chat entry; Android and PC keep verified HOME handoff',()=>{
 for(const device of [{userAgent:'Mozilla iPhone'},{userAgent:'iPad'},{userAgent:'Macintosh',maxTouchPoints:5}]){
  assert.equal(entry(new URL(canonical),true,device),canonical);
 }
 for(const device of [{userAgent:'Android'},{userAgent:'Macintosh',maxTouchPoints:0}]){
  assert.equal(entry(new URL(canonical),true,device),canonical+'?home-start=1');
  assert.equal(entry(new URL(canonical),false,device),canonical);
 }
});
test('HOME no longer injects the osekkai settings or inbox banner',()=>{
 const home=code.slice(code.indexOf('async function home()'), code.indexOf('const visibleApps=apps.filter'));
 assert.doesNotMatch(home,/osekkai/);
});
