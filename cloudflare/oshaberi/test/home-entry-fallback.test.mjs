import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const clear=code.slice(code.indexOf('function clearHomeVerifier'),code.indexOf('async function beginHomeLink'));
test('blocked Safari session storage cannot block returning to the normal signin screen',async()=>{
 const status={textContent:''};let logins=0,errors=0;
 const context=vm.createContext({sessionStorage:{removeItem(){throw Error('storage blocked');}},homeStart:true,beginHomeLink:async()=>{throw Error('storage blocked');},loginScreen:async()=>{logins++},$:()=>status,showError:()=>errors++,start:async()=>{}});
 await vm.runInContext(clear+'\n'+code.slice(code.lastIndexOf('if(homeStart)beginHomeLink()')),context);
 assert.equal(logins,1);assert.equal(errors,0);assert.match(status.textContent,/自分のID/);
});
