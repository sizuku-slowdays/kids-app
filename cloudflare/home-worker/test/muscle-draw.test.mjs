import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,todayExercises,validateState} from '../public/apps/muscle-bank/model.js';
test('daily draw stays small, stable and can be changed without touching records',()=>{
 const s=initialState();assert.deepEqual(todayExercises(s,'2026-10-04'),[]);
 s.exercises=[{id:'one',today:false},{id:'two',today:true}];assert.equal(todayExercises(s,'2026-10-04').length,2);
 s.exercises=Array.from({length:20},(_,i)=>({id:String(i),today:false}));
 const ids=(day='2026-10-04')=>todayExercises(s,day).map(e=>e.id);
 const first=ids();assert.equal(first.length,3);assert.equal(new Set(first).size,3);assert.deepEqual(ids(),first);
 s.exercises.reverse();assert.deepEqual(ids(),first);
 const records=structuredClone(s.records),all=new Set();
 for(let round=0;round<20;round++){s.todayShuffle={day:'2026-10-04',round};ids().forEach(id=>all.add(id))}
 assert.equal(all.size,20);assert.notDeepEqual(ids(),first);assert.deepEqual(s.records,records);
 delete s.todayShuffle;const tomorrow=ids('2026-10-05');s.todayShuffle={day:'2026-10-04',round:7};assert.deepEqual(ids('2026-10-05'),tomorrow);
 assert.notDeepEqual(tomorrow,first);
 s.exercises=s.exercises.slice(0,4);const a=ids();s.todayShuffle.round++;assert.notDeepEqual(new Set(ids()),new Set(a));
});
test('backup accepts daily draw settings and rejects malformed settings',()=>{
 const s=initialState();s.todayShuffle={day:'2026-10-04',round:2};assert.equal(validateState(s),s);
 for(const todayShuffle of [null,{day:'2026-02-30',round:0},{day:'2026-10-04',round:-1},{day:'2026-10-04',round:1.5}])assert.throws(()=>validateState({...s,todayShuffle}));
});
