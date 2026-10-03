import test from 'node:test';import assert from 'node:assert/strict';
import bank from '../legacy-retirement/mama-bank-api.js';import chores from '../legacy-retirement/otetsudai-api.js';
const retired={HOME_PASSBOOK_MIGRATED:'1',APP_PASSWORD:'test'};
const request=(path,method='GET',data)=>new Request('https://api.test'+path,{method,headers:{Origin:'https://cetus.fun',...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});
test('legacy bank closes bank routes only and retains other app password gates',async()=>{
 for(const [path,method,data] of [['/api/balance','GET'],['/api/balance','POST',{account:'kuma',amount:1}],['/api/app-data-public?key=mama-bank-view','GET'],['/api/app-data/mama-bank','PUT',{data:{}}],['/api/app-data','POST',{key:'mama-bank',data:{}}],['/api/app-data?app=mama-bank&key=main','DELETE'],['/api/app-data-public/%6dama-bank-view','GET']])assert.equal((await bank.fetch(request(path,method,data),retired)).status,410,path);
 for(const key of ['kakeibo-app','school-check'])assert.equal((await bank.fetch(request('/api/app-data?key='+key),retired)).status,401);
 const info=await bank.fetch(request('/api/home-passbook-status'),retired);assert.equal((await info.json()).retired,true);assert.equal((await bank.fetch(request('/api/home-passbook-status'),{})).status,200);
 assert.equal((await bank.fetch(request('/api/app-data?key=mama-bank'),{APP_PASSWORD:'test'})).status,401);
});
test('legacy chores closes reads, completions, exchange approval and bank sync',async()=>{
 for(const [path,method] of [['/api/members','GET'],['/api/chores/complete','POST'],['/api/rewards/resolve','POST'],['/api/bank/sync','POST']])assert.equal((await chores.fetch(request(path,method),retired)).status,410);
 const info=await chores.fetch(request('/api/home-passbook-status'),retired);assert.equal((await info.json()).service,'chores');assert.equal((await chores.fetch(request('/api/unknown'),{})).status,404);
 assert.equal((await chores.fetch(request('/api/chores/complete','OPTIONS'),retired)).status,200);
});
