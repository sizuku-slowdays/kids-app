import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
test('tap and drag use the same non-destructive HOME move operation',async()=>{
 const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8'),ctx={};vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function moveHomeLayout('),source.indexOf('async function editHome(')),ctx);
 const original=[{id:'a',section:'favorite'},{id:'b',section:'list'},{id:'c',section:'list'},{id:'d',section:'hidden'}];
 const move=ctx.moveHomeLayout;
 const next=move(original,'c','favorite','a');assert.deepEqual(Array.from(next.filter(a=>a.section==='favorite'),a=>a.id),['c','a']);assert.equal(original[2].section,'list');
 assert.deepEqual(Array.from(move(original,'c','list','b'),a=>a.id),['a','c','b','d']);
 assert.deepEqual(Array.from(move(original,'a','hidden'),a=>a.id),['b','c','d','a']);
 assert.equal(move(original,'a','favorite','a'),original);assert.equal(move(original,'missing','list'),original);assert.equal(move(original,'a','invalid'),original);
 assert.deepEqual(Array.from(next,a=>a.id).sort(),['a','b','c','d']);
});
