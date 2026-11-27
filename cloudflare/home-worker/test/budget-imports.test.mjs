import {budgetCalendarItems} from '../src/budget-calendar.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {newBudget,applyBudgetCommand,budgetSummary,accountBalance,cardBalance,missingBudgetMonths} from '../src/budget-core.js';
import {parseCsv,parseRakutenCsv,decodeCardCsv,fingerprint,suggestCategory,merchantKey,matchCsvRows} from '../public/apps/household-budget/card-csv.js';
let serial=0;
const run=(s,type,data,today='2026-11-07')=>applyBudgetCommand(s,{type,data},{today,eventId:'import-test-'+(++serial)});
function started(){let s=newBudget();s.startDate='2026-11-01';s.accounts[0].opening=100000;s.accounts[0].openingDate=s.startDate;for(const c of s.cards)Object.assign(c,{opening:0,accountId:'bank-0',closingDay:31,paymentDay:27,monthOffset:1});return s;}
const source={id:'legacy-synthetic-1',name:'Synthetic monthly fee',amount:1000,payment:'楽天銀行',day:15,dateMode:'monthly',category:'その他'};
const fixed=(overrides={})=>({source,payment:'bank-0',day:15,...overrides});
async function csvRow(amount=1200,merchant='SYNTHETIC SHOP',date='2026-11-04',occurrence=1){const row={date,merchant,signedAmount:amount,method:'1回払い',occurrence};row.canonical=JSON.stringify([date,merchant,amount,row.method]);return {...row,key:await fingerprint('visa',row),category:'その他',action:'add'};}
const csv=(rows,extra={})=>({cardId:'visa',statementMonth:'2026-12',confirm:true,rows,...extra});
test('CSV quoting, embedded commas, newlines, BOM and malformed quotes',()=>{assert.deepEqual(parseCsv('\uFEFFa,b\r\n"c,d","line\n2"\r\n'),[['a','b'],['c,d','line\n2']]);assert.throws(()=>parseCsv('"unclosed'));});
test('UTF-8 and Shift_JIS decoding; headers, refund signs and invalid rows',()=>{assert.equal(decodeCardCsv(new TextEncoder().encode('利用日').buffer).encoding,'UTF-8');assert.equal(decodeCardCsv(Uint8Array.from([0x82,0xa0]).buffer).encoding,'Shift_JIS');const rows=parseRakutenCsv('利用日,利用店名・商品名,利用金額,支払方法\n2026/11/4,SYNTHETIC,1200,1回払い\n2026/11/5,SYNTHETIC,-200,1回払い\n合計,,1000,');assert.equal(rows[0].date,'2026-11-04');assert.equal(rows[1].signedAmount,-200);assert.ok(rows[2].error);});
test('Unsupported fees and two-line records remain visible as review rows',()=>{const rows=parseRakutenCsv('利用日,利用店名・商品名,利用金額,分割手数料\n2026/11/4,SYNTHETIC,1200,50\n,続き,100,');assert.ok(rows[0].error);assert.ok(rows[1].error);});
test('Fixed migration after start preserves all balances and is repeatable',()=>{const s=started(),next=run(s,'fixed.import',{month:'2026-11',confirm:true,rules:[fixed()]});assert.equal(next.rules.length,1);assert.equal(next.plans.length,1);assert.equal(next.journal.length,0);assert.equal(accountBalance(next,'bank-0','2026-11-07'),100000);assert.equal(run(next,'fixed.import',{month:'2026-11',confirm:true,rules:[fixed()]}).rules.length,1);});
test('Confirmed records are preserved; explicit replacement only cancels pending plans',()=>{let s=started();s=run(s,'rule.save',{id:'manual-fee',name:'manual',amount:1000,payment:'bank-0',day:5});s=run(s,'plans.generate',{month:'2026-11'});const planned=s.plans[0];const next=run(s,'fixed.import',{month:'2026-11',confirm:true,rules:[fixed({replaceRuleId:'manual-fee'})]});assert.equal(next.plans.find(p=>p.id===planned.id).status,'cancelled');assert.equal(next.plans.filter(p=>p.status==='planned').length,1);});
test('Reviewed paid legacy record skips only selected month and never posts money',()=>{const s=started(),entry={id:'legacy-paid-row',date:'2026-11-05',type:'expense',amount:1000,payment:'楽天銀行',category:'その他'};const next=run(s,'fixed.import',{month:'2026-11',confirm:true,rules:[fixed({recordedKind:'old',recordedEntry:entry})]});assert.equal(next.plans.find(p=>p.ruleId===next.rules[0].id).status,'excluded');assert.equal(next.journal.length,0);assert.ok(!budgetCalendarItems(next).some(p=>p.kind==='plan'));const e=next.entries[0];assert.equal(e.balanceIncludedExternally,true);assert.throws(()=>run(next,'entry.apply',{id:e.id,payment:'bank-0',confirm:true}));const december=run(next,'plans.generate',{month:'2026-12'});assert.equal(december.plans.find(p=>p.month==='2026-12'&&p.ruleId===next.rules[0].id).status,'planned');});
test('Deleted rules, unresolved day, duplicate plans and old month are guarded',()=>{const s=started();assert.throws(()=>run(s,'fixed.import',{month:'2026-11',confirm:true,rules:[fixed({source:{...source,deletedAt:'synthetic'}})]}));assert.throws(()=>run(s,'fixed.import',{month:'2026-11',confirm:true,rules:[fixed({day:0})]}));const next=run(s,'fixed.import',{month:'2026-12',confirm:true,rules:[fixed()]});assert.equal(run(next,'plans.generate',{month:'2026-11'}).plans.filter(p=>p.ruleId===next.rules[0].id&&p.month==='2026-11').length,0);});
test('Missing-month detection catches settings added mid-month without recreating cancelled plans',()=>{let s=started();s=run(s,'plans.generate',{month:'2026-11'});s=run(s,'plans.generate',{month:'2026-12'});assert.deepEqual(missingBudgetMonths(s,'2026-11-07'),[]);s=run(s,'rule.save',{id:'new-midmonth',name:'new',amount:100,payment:'bank-0',day:20});assert.deepEqual(missingBudgetMonths(s,'2026-11-07'),['2026-11','2026-12']);s=run(s,'plans.generate',{month:'2026-11'});s=run(s,'plans.generate',{month:'2026-12'});s=run(s,'plan.cancel',{id:s.plans[0].id,version:1});assert.deepEqual(missingBudgetMonths(s,'2026-11-07'),[]);});
test('CSV purchase changes expense and card debt, never bank cash; repeated import is idempotent',async()=>{const s=started(),row=await csvRow(),next=run(s,'csv.import',csv([row]));assert.equal(accountBalance(next,'bank-0','2026-11-07'),100000);assert.equal(cardBalance(next,'visa','2026-11-07'),1200);assert.equal(budgetSummary(next,'2026-11-07').expense,1200);const repeated=run(next,'csv.import',csv([row]));assert.equal(repeated.entries.length,1);assert.equal(repeated.journal.length,1);});
test('PINK is independent of VISA, refunds reduce debt and expense',async()=>{const purchase=await csvRow(),refund=await csvRow(-200);let s=run(started(),'csv.import',csv([purchase,refund]));assert.equal(cardBalance(s,'visa','2026-11-07'),1000);assert.equal(budgetSummary(s,'2026-11-07').expense,1000);s=run(s,'csv.import',csv([{...purchase,key:'a'.repeat(64)}],{cardId:'pink'}));assert.equal(cardBalance(s,'pink','2026-11-07'),1200);assert.equal(accountBalance(s,'bank-0','2026-11-07'),100000);});
test('Manual matches retain classification and do not post again',async()=>{let s=started();s=run(s,'entry.add',{id:'manual-1',date:'2026-11-04',type:'expense',amount:1200,payment:'visa',memo:'different memo',category:'食費'});const row=await csvRow();assert.throws(()=>run(s,'csv.import',csv([row])));const next=run(s,'csv.import',csv([{...row,action:'match',entryId:'manual-1'}]));assert.equal(next.entries.length,1);assert.equal(next.journal.length,1);assert.equal(suggestCategory(next,'SYNTHETIC SHOP').category,'食費');});
test('Same date/shop/amount purchases use distinct occurrences; re-import is stable',async()=>{const a=await csvRow(),b=await csvRow(1200,'SYNTHETIC SHOP','2026-11-04',2);assert.notEqual(a.key,b.key);const next=run(started(),'csv.import',csv([a,b]));assert.equal(next.entries.length,2);assert.equal(run(next,'csv.import',csv([a,b])).entries.length,2);});
test('CSV links an unconfirmed card fixed charge without doubling future bills',async()=>{let s=started();s=run(s,'rule.save',{id:'card-fee',name:'synthetic',amount:1200,payment:'visa',day:4});s=run(s,'plans.generate',{month:'2026-11'});s=run(s,'plans.generate',{month:'2026-12'});const row=await csvRow();assert.throws(()=>run(s,'csv.import',csv([row])));s=run(s,'csv.import',csv([{...row,action:'plan',planId:s.plans[0].id}]));assert.equal(s.plans[0].status,'confirmed');const bill=budgetSummary(s,'2026-11-07').cards.find(c=>c.id==='visa').bills.find(b=>b.month==='2026-12');assert.equal(bill.expected,1200);});
test('Pre-start CSV records do not add opening debt; invalid batch is atomic',async()=>{const row=await csvRow(1200,'SYNTHETIC SHOP','2026-10-04'),s=started();const next=run(s,'csv.import',csv([row]));assert.equal(next.entries[0].ledgerIncluded,false);assert.equal(cardBalance(next,'visa','2026-11-07'),0);const valid=await csvRow();assert.throws(()=>run(s,'csv.import',csv([valid,{...valid,key:'b'.repeat(64),category:'missing-category'}])));assert.equal(s.entries.length,0);assert.equal(s.journal.length,0);});

test('Rakuten extended columns check fees and unresolved payment months',()=>{const header='利用日,利用店名・商品名,利用者,支払方法,利用金額,手数料/利息,支払総額,支払月,11月支払金額,当月請求額,12月繰越残高,12月以降請求額';const rows=parseRakutenCsv(header+'\n2026/10/10,SYNTHETIC,本人,1回払い,900,0,900,11月,900,900,0,0\n2026/10/11,SYNTHETIC,本人,1回払い,800,0,800,12月以降,0,0,800,800\n2026/10/12,SYNTHETIC,本人,分割,700,30,730,11月,100,100,630,630');assert.equal(rows[0].error,'');assert.equal(rows[0].billingMonthNumber,11);assert.equal(rows[1].error,'');assert.equal(rows[1].billingDeferred,true);assert.equal(rows[1].billingMonthNumber,12);assert.match(rows[2].error,/手数料/);});
test('CSV payment month mismatch is rejected without changing the ledger',async()=>{const s=started(),row=await csvRow();assert.throws(()=>run(s,'csv.import',csv([{...row,billingMonthNumber:11}])));assert.equal(s.journal.length,0);const next=run(s,'csv.import',csv([{...row,billingMonthNumber:12}]));assert.equal(next.entries.length,1);});

test('Half-width kana and full-width merchant names share fingerprints and learned categories',async()=>{
 const a=parseRakutenCsv('利用日,利用店名・商品名,利用金額,支払方法\n2026/11/4,ﾃｽﾄ ｼｮｯﾌﾟ,1200,１回払い')[0],b=parseRakutenCsv('利用日,利用店名・商品名,利用金額,支払方法\n2026/11/4,テスト　ショップ,1200,1回払い')[0];
 assert.equal(await fingerprint('visa',a),await fingerprint('visa',b));let s=started();s=run(s,'csv.import',csv([{...a,key:await fingerprint('visa',a),category:'食費',action:'add'}]));assert.equal(suggestCategory(s,b.merchant).category,'食費');assert.equal(s.entries[0].memo,a.merchant);assert.equal(run(s,'csv.import',csv([{...b,key:await fingerprint('visa',b),category:'食費',action:'add'}])).entries.length,1);
});
test('Deferred CSV adds expense and card debt but no monthly bank forecast, then assigns without posting again',async()=>{
 const row={...await csvRow(),paymentMonth:'12月以降'};let s=run(started(),'csv.import',csv([row],{statementMonth:'2026-11'}));
 const e=s.entries[0];assert.equal(e.dueDate,null);assert.deepEqual(e.csvBilling,{status:'pending',earliestMonth:'2026-12'});assert.equal(cardBalance(s,'visa','2026-11-07'),1200);assert.equal(budgetSummary(s,'2026-11-07').expense,1200);assert.equal(accountBalance(s,'bank-0','2026-11-07'),100000);
 s=run(s,'plans.generate',{month:'2026-12'});assert.equal(budgetSummary(s,'2026-11-07','2026-12').accounts[0].upcoming,0);
 const journal=structuredClone(s.journal);assert.throws(()=>run(s,'csv.billing.assign',{entryId:e.id,month:'2026-11',confirm:true}));s=run(s,'csv.billing.assign',{entryId:e.id,month:'2026-12',confirm:true});assert.deepEqual(s.journal,journal);assert.equal(s.entries.length,1);assert.equal(s.entries[0].dueDate,'2026-12-28');assert.equal(budgetSummary(s,'2026-11-07','2026-12').accounts[0].upcoming,1200);assert.equal(accountBalance(s,'bank-0','2026-11-07'),100000);assert.throws(()=>run(s,'csv.billing.assign',{entryId:e.id,month:'2026-12',confirm:true}));
});
test('A later confirmed CSV resolves the same deferred entry exactly once without reclassifying or reposting',async()=>{
 const row={...await csvRow(),paymentMonth:'12月以降'};let s=run(started(),'csv.import',csv([row],{statementMonth:'2026-11'}));const journal=structuredClone(s.journal);s=run(s,'csv.import',csv([{...row,paymentMonth:'12月',category:'食費',action:'assign'}]));assert.equal(s.entries.length,1);assert.equal(s.entries[0].csvBilling.status,'confirmed');assert.equal(s.entries[0].splits[0].category,'その他');assert.deepEqual(s.journal,journal);assert.equal(run(s,'csv.import',csv([row],{statementMonth:'2026-11'})).entries[0].csvBilling.status,'confirmed');
});
test('Deferred billing crosses years; pre-start history does not double opening debt',async()=>{
 const row={...await csvRow(900,'SYNTHETIC','2026-10-04'),paymentMonth:'1月以降'};let s=run(started(),'csv.import',csv([row],{statementMonth:'2026-12'}));assert.equal(s.entries[0].csvBilling.earliestMonth,'2027-01');assert.equal(cardBalance(s,'visa','2026-11-07'),0);s=run(s,'csv.billing.assign',{entryId:s.entries[0].id,month:'2027-01',confirm:true});assert.equal(cardBalance(s,'visa','2026-11-07'),0);assert.equal(s.journal.length,0);
});
test('Deferred manual match and category edits preserve pending billing and do not duplicate debt',async()=>{
 let s=run(started(),'entry.add',{id:'manual-deferred',date:'2026-11-04',type:'expense',amount:1200,payment:'visa',category:'食費',memo:'Synthetic'});const row={...await csvRow(),paymentMonth:'12月以降',action:'match',entryId:'manual-deferred'};s=run(s,'csv.import',csv([row],{statementMonth:'2026-11'}));assert.equal(s.entries.length,1);assert.equal(s.journal.length,1);assert.equal(s.entries[0].dueDate,null);s=run(s,'entry.edit',{id:'manual-deferred',category:'日用品'});assert.equal(s.entries[0].csvBilling.status,'pending');assert.equal(s.entries[0].dueDate,null);assert.equal(cardBalance(s,'visa','2026-11-07'),1200);
});

test('A deferred manual match cannot move an already confirmed card bill',async()=>{
 let s=run(started(),'entry.add',{id:'manual-paid-card',date:'2026-11-04',type:'expense',amount:1200,payment:'visa',category:'食費'});s.bills.push({id:'synthetic-confirmed',cardId:'visa',month:'2026-12',status:'confirmed'});const before=structuredClone(s),row={...await csvRow(),paymentMonth:'12月以降',action:'match',entryId:'manual-paid-card'};assert.throws(()=>run(s,'csv.import',csv([row],{statementMonth:'2026-11'})));assert.deepEqual(s,before);
});

test('Existing pre-start CSV entries can be reassigned to an open bill without reposting',async()=>{
 const rows=[await csvRow(1200,'SYNTHETIC PURCHASE','2026-10-10'),await csvRow(-200,'SYNTHETIC REFUND','2026-10-11')];
 const imported=run(started(),'csv.import',csv(rows,{statementMonth:'2026-10'}));
 // Previously imported files without a payment-month column had no billing metadata.
 delete imported.entries[0].csvBilling;
 const entryIds=imported.entries.map(e=>e.id);
 const command={entryIds,month:'2026-11',confirm:true};
 const state=run(imported,'csv.billing.assign',command);
 const summary=budgetSummary(state,'2026-11-07','2026-11');
 const bill=summary.cards.find(c=>c.id==='visa').bills.find(b=>b.month==='2026-11');
 assert.equal(bill.expected,0);
 assert.equal(bill.projected,1000);
 assert.equal(summary.accounts[0].upcoming,1000);
 assert.equal(accountBalance(state,'bank-0','2026-11-07'),100000);
 assert.equal(cardBalance(state,'visa','2026-11-07'),0);
 assert.deepEqual(state.journal,imported.journal);
 assert.equal(state.entries.length,2);
 assert.deepEqual(run(state,'csv.billing.assign',command),state);
 assert.throws(()=>run(state,'bill.confirm',{id:bill.id,version:bill.version},'2026-11-27'),/実際の請求額/);
 const allocated=structuredClone(state);
 allocated.bills.find(b=>b.id===bill.id).openingAllocation=800;
 assert.equal(budgetSummary(allocated,'2026-11-07').cards.find(c=>c.id==='visa').bills[0].projected,1000);
 const confirmed=structuredClone(state);
 confirmed.bills.find(b=>b.id===bill.id).status='confirmed';
 assert.throws(()=>run(confirmed,'csv.billing.assign',{...command,month:'2026-12'}),/引落済み/);
});

test('New pre-start CSV uses the statement month for the forecast only',async()=>{
 const row=await csvRow(1200,'SYNTHETIC PURCHASE','2026-10-20');
 const s=run(started(),'csv.import',csv([{...row,paymentMonth:'11月'}],{statementMonth:'2026-11'}));
 const summary=budgetSummary(s,'2026-11-07');
 assert.equal(summary.cards.find(c=>c.id==='visa').bills[0].projected,1200);
 assert.equal(summary.cards.find(c=>c.id==='pink').bills[0].projected,0);
 assert.equal(summary.expense,0);
 assert.equal(s.journal.length,0);
});

test('Monthly schedule reports actionable gaps and never duplicates existing or cancelled plans',()=>{
 let s=started();
 s.cards[1].paymentDay=null;
 s=run(s,'rule.save',{id:'new',name:'New fee',amount:300,payment:'bank-0',day:15});
 s=run(s,'rule.save',{id:'old',name:'Previously generated',amount:400,payment:'bank-0',day:20});
 s.plans.push({id:'existing-legacy-id',ruleId:'old',month:'2026-11',payment:'bank-0',status:'cancelled',dueDate:'2026-11-20'});
 let status=budgetSummary(s,'2026-11-07').schedule;
 assert.deepEqual(status.missingFixed,['New fee']);
 assert.equal(status.missingCards.length,1);
 assert.equal(status.cancelled,1);
 assert.equal(status.unconfigured.length,1);
 const next=run(s,'plans.generate',{month:'2026-11'});
 status=budgetSummary(next,'2026-11-07').schedule;
 assert.deepEqual(status.missingFixed,[]);
 assert.deepEqual(status.missingCards,[]);
 assert.equal(next.plans.filter(p=>p.ruleId==='old').length,1);
 assert.deepEqual(next.journal,s.journal);
 assert.deepEqual(run(next,'plans.generate',{month:'2026-11'}),next);
});

test('One-off bank withdrawals affect forecasts and calendar immediately, and the ledger only on confirmation',()=>{
 const original=started();
 const body={id:'irregular-fee',name:'合成の単発請求',payment:'bank-0',amount:1200,dueDate:'2026-11-25',category:'日用品'};
 let state=run(original,'plan.add',body);
 const plan=state.plans[0];
 assert.equal(plan.month,'2026-11');
 assert.equal(accountBalance(state,'bank-0','2026-11-07'),100000);
 assert.equal(budgetSummary(state,'2026-11-07').accounts[0].upcoming,1200);
 assert.equal(budgetCalendarItems(state).find(x=>x.id===plan.id).description,'単発の引落予定');
 assert.throws(()=>run(state,'plan.add',body),/登録済み/);
 assert.throws(()=>run(state,'plan.add',{...body,id:'wrong',payment:'visa'}));
 assert.throws(()=>run(state,'plans.confirm',{items:[{id:plan.id,version:1}]}),/未来/);
 state=run(state,'plan.edit',{id:plan.id,version:1,amount:1350,dueDate:'2026-12-01'});
 assert.equal(state.plans[0].month,'2026-12');
 assert.equal(budgetSummary(state,'2026-11-07').accounts[0].upcoming,0);
 state=run(state,'plans.generate',{month:'2026-12'});
 assert.equal(state.plans.length,1);
 const confirmed=run(state,'plans.confirm',{items:[{id:plan.id,version:2}]},'2026-12-01');
 assert.equal(accountBalance(confirmed,'bank-0','2026-12-01'),98650);
 assert.equal(confirmed.entries.length,1);
 const cancelled=run(state,'plan.cancel',{id:plan.id,version:2});
 assert.ok(!budgetCalendarItems(cancelled).some(x=>x.id===plan.id));
 assert.deepEqual(cancelled.journal,original.journal);
});

test('Preview consumes registered and exact manual transactions once, leaving additional identical occurrences new',async()=>{
 const a=await csvRow(),b=await csvRow(1200,'SYNTHETIC SHOP','2026-11-04',2),c=await csvRow(1200,'SYNTHETIC SHOP','2026-11-04',3);
 let s=run(started(),'csv.import',csv([a]));
 s=run(s,'entry.add',{id:'manual-exact',date:a.date,type:'advance',amount:1200,payment:'visa',memo:a.merchant,category:'食費',counterparty:'Synthetic party'});
 const matches=matchCsvRows(s,'visa',[a,b,c]);
 assert.equal(matches.get(a.key).registered,true);
 assert.equal(matches.get(b.key).id,'manual-exact');
 assert.equal(matches.has(c.key),false);
 s=run(s,'csv.import',csv([{...b,action:'match',entryId:'manual-exact',autoMatch:true},c]));
 assert.equal(s.entries.length,3);
 assert.equal(s.entries.find(e=>e.id==='manual-exact').splits[0].category,'食費');
 assert.equal(cardBalance(s,'visa','2026-11-07'),3600);
 assert.equal(matchCsvRows(s,'visa',[a,b,c]).size,3);
 assert.equal(matchCsvRows(s,'pink',await Promise.all([a,b,c].map(async row=>({...row,key:await fingerprint('pink',row)})))).size,0);
});
test('CSV advances enter existing settlement flow, and reimport does not duplicate debt or cash',async()=>{
 const row={...await csvRow(),advance:true,counterparty:'Synthetic party',remember:false};
 assert.throws(()=>run(started(),'csv.import',csv([{...row,counterparty:' '}])),/立替先/);
 let s=run(started(),'csv.import',csv([row]));
 const entry=s.entries[0];assert.equal(entry.type,'advance');assert.equal(entry.counterparty,'Synthetic party');
 assert.equal(budgetSummary(s,'2026-11-07').advances[0].remaining,1200);
 s=run(s,'advance.settle',{date:'2026-11-07',accountId:'bank-0',items:[{id:entry.id,received:1200,waived:0}]});
 const before=structuredClone(s.journal);
 s=run(s,'csv.import',csv([row]));
 assert.deepEqual(s.journal,before);assert.equal(s.entries.length,1);
 assert.equal(budgetSummary(s,'2026-11-07').advances[0].remaining,0);
 assert.equal(cardBalance(s,'visa','2026-11-07'),1200);
 assert.equal(accountBalance(s,'bank-0','2026-11-07'),101200);
});
