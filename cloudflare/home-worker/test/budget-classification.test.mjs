import test from 'node:test';
import assert from 'node:assert/strict';
import {newBudget,applyBudgetCommand,budgetSummary,accountBalance,cardBalance} from '../src/budget-core.js';
import {budgetClassificationPreview} from '../src/budget-classification.js';
import {budgetCalendarItems} from '../src/budget-calendar.ts';
import {suggestCategory,parseRakutenCsv,fingerprint} from '../public/apps/household-budget/card-csv.js';

let seq=0;
const run=(s,type,data,today='2026-11-13')=>applyBudgetCommand(s,{type,data},{today,eventId:'classification-'+(++seq)});
const migrate=(s,merchants)=>run(s,'classification.migrate',{confirm:true,expectedRevision:0,merchants});
function started(){
 const s=newBudget();s.startDate='2026-11-01';
 Object.assign(s.accounts[0],{opening:100000,openingDate:s.startDate});
 for(const card of s.cards)Object.assign(card,{opening:0,accountId:'bank-0',closingDay:12,paymentDay:27,monthOffset:0});
 return s;
}

test('Migration preview is read-only and classification preserves balances, calendar and CSV identity',async()=>{
 let s=started();
 s.categories.tree['支払']={};
 const row=parseRakutenCsv('利用日,利用店名・商品名,利用金額,支払方法\n2026/10/22,SYNTHETIC,825,1回払い')[0];
 const key=await fingerprint('visa',row);
 const csv={cardId:'visa',statementMonth:'2026-11',confirm:true,rows:[{...row,key,action:'add',category:'支払'}]};
 s=run(s,'csv.import',csv);
 delete s.entries[0].merchant;
 s=run(s,'entry.edit',{id:s.entries[0].id,memo:'changed memo'});
 s=run(s,'rule.save',{id:'rule',name:'合成保険料',category:'税金',payment:'bank-0',amount:1000,day:30});
 s=run(s,'plans.generate',{month:'2026-11'});
 const before=structuredClone(s),id=s.entries[0].id;
 assert.equal(budgetClassificationPreview(s).unorganized,1);
 assert.deepEqual(s,before);
 const next=migrate(s,{[id]:'SYNTHETIC'});
 assert.equal(Object.keys(next.categories.tree).length,12);
 assert.equal(next.entries[0].splits[0].middle,'未整理');
 assert.equal(next.entries[0].splits[0].originalClassification.category,'支払');
 assert.equal(next.entries[0].merchant,'SYNTHETIC');
 assert.equal(next.rules[0].middle,'保険料');
 assert.deepEqual(next.csvImports,s.csvImports);
 assert.deepEqual(next.bills,s.bills);
 assert.deepEqual(next.journal,s.journal);
 assert.deepEqual(budgetCalendarItems(next),budgetCalendarItems(s));
 assert.deepEqual(migrate(next),next);
 assert.equal(run(next,'csv.import',csv).entries.length,1);
});

test('Metadata edits, merchant rules, split targets and purchase text are independent of the ledger',()=>{
 let s=migrate(started());
 s=run(s,'entry.add',{id:'split-test',date:'2026-11-04',amount:1000,payment:'visa',merchant:'SYNTHETIC',purchase:'学校用品',spendingKind:'予定外',splits:[
  {amount:700,category:'教育',middle:'学校',person:'長女'},{amount:300,category:'日用品',person:'犬'}
 ]});
 const journal=structuredClone(s.journal);
 s=run(s,'classification.entries',{items:[{id:'split-test',indices:[0]}],category:'衣服',spendingKind:'突発的'});
 s=run(s,'entry.edit',{id:'split-test',purchase:'体操服'});
 s=run(s,'classification.people',{old:'長女',name:'子A'});
 assert.deepEqual(s.journal,journal);
 assert.equal(s.entries[0].purchase,'体操服');
 assert.equal(s.entries[0].splits[0].person,'子A');
 assert.equal(s.entries[0].splits[1].person,'犬');
 const result=budgetSummary(s,'2026-11-13');
 assert.equal(result.categoryBreakdown.filter(p=>p.person!=='犬').reduce((n,p)=>n+p.amount,0),700);
 assert.ok(result.categoryBreakdown.every(p=>p.kind==='突発的'));
 s=run(s,'classification.merchant',{key:'AMAZON',category:'日用品',person:'祖父'});
 assert.equal(suggestCategory(s,'Ａｍａｚｏｎ').review,true);
 s=run(s,'classification.merchant',{key:'AMAZON',disabled:true});
 assert.equal(suggestCategory(s,'Amazon').category,'');
});

test('Purpose savings and NISA card payments remain separate',async()=>{
 let s=migrate(started());
 const row=parseRakutenCsv('利用日,利用店名・商品名,利用金額,支払方法\n2026/11/4,SYNTHETIC NISA,3000,1回払い')[0];
 const key=await fingerprint('visa',row);
 s=run(s,'csv.import',{cardId:'visa',statementMonth:'2026-11',confirm:true,rows:[{...row,key,action:'add',category:'貯金・積立',middle:'NISA',remember:false,savingsKind:'カード投資積立'}]});
 s=run(s,'plans.generate',{month:'2026-11'});
 const bill=s.bills.find(b=>b.cardId==='visa');
 assert.equal(budgetSummary(s,'2026-11-13').expense,0);
 assert.equal(budgetSummary(s,'2026-11-13').savings.NISA,3000);
 assert.equal(cardBalance(s,'visa','2026-11-13'),3000);
 s=run(s,'savings.allocate',{purpose:'ゲーム貯金',amount:2000,date:'2026-11-13'});
 assert.equal(accountBalance(s,'bank-0','2026-11-13'),100000);
 s=run(s,'bill.confirm',{id:bill.id,version:bill.version},'2026-11-27');
 assert.equal(accountBalance(s,'bank-0','2026-11-27'),97000);
 assert.equal(cardBalance(s,'visa','2026-11-27'),0);
 assert.equal(budgetSummary(s,'2026-11-27').savings.NISA,3000);
});

test('Partial and grouped advance settlements post cash only for amounts received',()=>{
 let s=migrate(started());
 for(const [id,amount] of [['advance-a',8912],['advance-b',1000]])s=run(s,'entry.add',{id,date:'2026-11-04',amount,payment:'bank-0',category:'医療・健康',person:'祖母',counterparty:'祖母',type:'advance'});
 const balance=accountBalance(s,'bank-0','2026-11-13');
 s=run(s,'advance.settle',{accountId:'bank-0',date:'2026-11-13',items:[{id:'advance-a',received:8500,waived:0},{id:'advance-b',received:1000,waived:0}]});
 assert.equal(budgetSummary(s,'2026-11-13').advances[0].remaining,412);
 assert.equal(accountBalance(s,'bank-0','2026-11-13'),balance+9500);
 const journal=structuredClone(s.journal);
 s=run(s,'advance.settle',{date:'2026-11-13',items:[{id:'advance-a',received:0,waived:412}]});
 const summary=budgetSummary(s,'2026-11-13');
 assert.equal(summary.advances[0].remaining,0);
 assert.equal(summary.waived,412);
 assert.equal(summary.expense,412);
 assert.equal(summary.income,0);
 assert.deepEqual(s.journal,journal);
});
