import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';

test('local test paths decode drive letters, spaces and Japanese characters on Windows and POSIX',async()=>{
 const url=new URL('file:///C:/Users/test%20user/%E6%97%A5%E6%9C%AC/.build/index.js');
 assert.equal(fileURLToPath(url,{windows:true}),'C:\\Users\\test user\\日本\\.build\\index.js');
 assert.equal(fileURLToPath(new URL('file:///tmp/test%20user/%E6%97%A5%E6%9C%AC/.build/index.js'),{windows:false}),'/tmp/test user/日本/.build/index.js');
 for(const name of ['chat.test.mjs','release-guard.test.mjs','owner-fixture.test.mjs','browser-qa.mjs']){
  const source=await readFile(new URL(name,import.meta.url),'utf8');
  assert.match(source,/import \{fileURLToPath\} from 'node:url'/);
  assert.doesNotMatch(source,/new URL\('\.\.\/(?:\.build|scripts)\/[^']+',import\.meta\.url\)\.pathname/);
 }
});
