import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
test('family invitations stay disabled until explicit activation and a compatible calendar service',async()=>{
 const s=await readFile(new URL('../src/families.ts',import.meta.url),'utf8'),ctx={Request};vm.createContext(ctx);vm.runInContext(s.slice(s.indexOf('export async function familyReady'),s.indexOf('async function eligible')).replace('export ','').replace('env:FamilyEnv','env').replace(' as {protocol?:string}',''),ctx);
 let calls=0,protocol='legacy';const service={fetch:async()=>{calls++;return {ok:true,json:async()=>({protocol})};}};
 assert.equal(await ctx.familyReady({CALENDAR_SERVICE:service}),false);assert.equal(calls,0);
 assert.equal(await ctx.familyReady({FAMILY_INVITES_ENABLED:'1',CALENDAR_SERVICE:service}),false);
 protocol='multi-family-v1';assert.equal(await ctx.familyReady({FAMILY_INVITES_ENABLED:'1',CALENDAR_SERVICE:service}),true);
 assert.equal(await ctx.familyReady({FAMILY_INVITES_ENABLED:'1',CALENDAR_SERVICE:{fetch:()=>{throw Error('unavailable');}}}),false);
});
