import test from 'node:test';import assert from 'node:assert/strict';
import {westPaymentEstimates,calculate} from '../public/apps/dining-prices/calculator.js';
test('West coupon estimates use household totals and nearest-yen payment rounding',()=>{
 const west={id:'west-hashimoto'};
 assert.deepEqual(westPaymentEstimates(west,11616),{cash:10454,other:11035});
 assert.deepEqual(westPaymentEstimates(west,13816),{cash:12434,other:13125});
 assert.deepEqual(westPaymentEstimates(west,101),{cash:91,other:96});
 assert.deepEqual(westPaymentEstimates(west,0),{cash:0,other:0});
});
test('other restaurants and pending totals never receive the West coupon',()=>{
 for(const id of ['western-meinohama','nurubon-fukushige','custom-store'])assert.equal(westPaymentEstimates({id},11616),null);
 assert.equal(westPaymentEstimates({id:'west-hashimoto'},null),null);
 assert.throws(()=>westPaymentEstimates({id:'west-hashimoto'},-1));
});
test('base course totals and price differences remain undiscounted',()=>{
 const result=calculate([{id:'a',prices:[5808,2904]},{id:'b',prices:[6908,3454]}],[1,2]);
 assert.equal(result.courses[0].total,11616);assert.equal(result.courses[1].difference,2200);
 westPaymentEstimates({id:'west-hashimoto'},result.courses[0].total);assert.equal(result.courses[0].total,11616);
});
