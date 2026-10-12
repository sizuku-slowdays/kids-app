import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {calculateOrder,orderKey} from '../public/apps/dining-prices/calculator.js';
const text=await readFile(new URL('../src/dining-western.ts',import.meta.url),'utf8');const store=JSON.parse(text.replace(/^export const westernStore = /,'').replace(/;\s*$/,''));
test('all six PDF pages reconcile to 106 products and 189 price choices, including image-only sets',()=>{
 assert.equal(store.products.length,106);assert.equal(store.products.reduce((n,p)=>n+p.variants.length,0),189);
 assert.deepEqual([1,2,3,4,5,6].map(page=>store.products.filter(p=>p.source_page===page).reduce((n,p)=>n+p.variants.length,0)),[29,55,69,7,5,24]);
 assert.deepEqual(store.products.filter(p=>p.source_page===5).map(p=>p.variants[0].price),[2520,2840,2920,2410,3330]);
 const lunch=store.products.find(p=>p.period==='lunch'&&p.name==='うえすたんステーキ（サガリ）');assert.equal(lunch.variants.find(v=>v.label==='150g').price,1800);
 const regular=store.products.find(p=>p.period==='regular'&&p.name==='ビフテキうえすたん（サガリ）');assert.equal(regular.variants.find(v=>v.label==='150g').price,1740);
 assert.equal(store.products.filter(p=>p.period==='lunch'&&p.name==='チーズ')[0].variants[0].price,200);assert.equal(store.products.find(p=>p.name==='チェダーチーズ').variants[0].price,250);
 assert.ok(store.products.every(p=>p.time_note&&store.categories.includes(p.category)));assert.equal(new Set(store.products.flatMap(p=>p.variants.map(v=>v.id))).size,189);
});
test('variant quantities, hidden products and updated prices yield exact subtotals without changing the menu',()=>{
 const products=structuredClone(store.products),quantities={};const add=(name,period,label,qty)=>{const p=products.find(p=>p.name===name&&p.period===period),v=p.variants.find(v=>v.label===label);quantities[orderKey(p,v)]=qty;return {p,v};};
 add('ビフテキうえすたん（サガリ）','regular','150g',2);const hamburger=add('チーズハンバーグ','regular','200g',1);add('小ライス','regular','1品',2);add('コーラ','all','1品',2);
 const snapshot=JSON.stringify(products),result=calculateOrder(products,quantities);assert.equal(result.total,6200);assert.equal(result.quantity,7);assert.deepEqual(result.lines.map(l=>l.subtotal).sort((a,b)=>a-b),[340,600,1780,3480]);assert.equal(JSON.stringify(products),snapshot);
 hamburger.v.price=1880;assert.equal(calculateOrder(products,quantities).total,6300);hamburger.p.hidden=true;assert.equal(calculateOrder(products,quantities).total,4420);
 assert.equal(calculateOrder(products,{}).total,0);quantities[Object.keys(quantities)[0]]=-1;assert.throws(()=>calculateOrder(products,quantities));
});
