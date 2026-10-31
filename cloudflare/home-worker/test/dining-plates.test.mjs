import test from 'node:test';
import assert from 'node:assert/strict';
import {plateTotals} from '../public/apps/dining-prices/plates.js';

test('plate totals combine tax-inclusive price bands and side menus',()=>{
  assert.deepEqual(plateTotals([{price:'150',count:'4'},{price:'220',count:'3'},{price:'500',count:'1'}]),{total:1760,count:8});
});
test('unused blank rows and free items are valid',()=>{
  assert.deepEqual(plateTotals([{price:'',count:'0'},{price:'0',count:'2'}]),{total:0,count:2});
});
test('missing prices with quantities and invalid values block a misleading total',()=>{
  for(const row of [{price:'',count:'1'},{price:'150',count:''},{price:'-1',count:'1'},{price:'1.5',count:'1'},{price:'100',count:'-1'},{price:'100',count:'2.5'},{price:'1000001',count:'1'},{price:'100',count:'10000'},{price:'NaN',count:'1'}])assert.equal(plateTotals([row]),null);
});
test('maximum supported amounts remain exact integers',()=>{
  assert.deepEqual(plateTotals(Array.from({length:40},()=>({price:'1000000',count:'9999'}))),{total:399960000000,count:399960});
});
