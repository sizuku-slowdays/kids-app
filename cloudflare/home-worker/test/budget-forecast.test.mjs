import assert from 'node:assert/strict';
import test from 'node:test';
import {budgetCalendarItems} from '../src/budget-calendar.ts';
import {applyBudgetCommand, budgetSummary, missingBudgetMonths, newBudget} from '../src/budget-core.js';

const today = '2026-11-13';
const firstMonth = '2026-11', secondMonth = '2026-12';
let event = 0;
const apply = (state,type,data,date=today) => applyBudgetCommand(state,{type,data},{today:date,eventId:'forecast-test-'+(++event)});
function started(){
 let state = newBudget();
 for (const id of ['pink','visa']) state = apply(state,'card.configure',{id,accountId:'bank-0',closingDay:31,paymentDay:27,monthOffset:1});
 return apply(state,'start',{
  startDate:'2026-11-01',confirm:true,
  accounts:[{id:'bank-0',amount:200000},{id:'cash',amount:100000},{id:'bank-1',amount:0}],
  cards:[{id:'pink',amount:0},{id:'visa',amount:0}],
 });
}
function bill(state,cardId='pink',month=secondMonth){
 return state.bills.find(bill=>bill.cardId===cardId&&bill.month===month);
}
function estimate(state,cardId,month,amount,status='estimate',date=today){
 return apply(state,'bill.estimate',{cardId,month,amount,status,checkedDate:date,version:bill(state,cardId,month)?.version},date);
}
function projection(state,cardId='pink',month=secondMonth,date=today){
 return bill(budgetSummary(state,date).cards.find(card=>card.id===cardId),cardId,month);
}
function csv(state,rows,date=today){
 return apply(state,'csv.import',{cardId:'pink',statementMonth:secondMonth,confirm:true,rows},date);
}
const csvRow = (key,signedAmount,date,extra={}) => ({
 key:key.repeat(64),merchant:'Example Store',signedAmount,date,action:'add',category:'食費',...extra
});
function reconcile(state,decisions=[],future=[],date=today){
 const b=bill(state);
 return apply(state,'bill.reconcile',{id:b.id,version:b.version,decisions,future},date);
}

test('confirmed November and provisional December reserve money once without posting to bank or ledger',()=>{
 let state=started();
 state=estimate(state,'pink',firstMonth,100000,'confirmed');
 state=estimate(state,'visa',firstMonth,75000,'confirmed');
 state=estimate(state,'pink',secondMonth,42000);
 state=estimate(state,'visa',secondMonth,15000);
 const summary=budgetSummary(state,today);
 assert.equal(summary.assets,300000);
 assert.equal(summary.debt,0);
 assert.equal(summary.expense,0);
 assert.equal(summary.funds.monthEnd,125000);
 assert.equal(summary.funds.confirmed,175000);
 assert.equal(summary.funds.estimated,57000);
 assert.equal(summary.funds.available,null);
 state=apply(state,'cashPlan.save',{id:'future-income',kind:'income',date:'2026-11-30',to:'bank-0',amount:6000,name:'Future income'});
 state=apply(state,'cashflow.funds',{month:firstMonth,living:2000,goals:[{name:'Travel',amount:3000}]});
 const funds=budgetSummary(state,today).funds;
 assert.equal(funds.monthEnd,131000);
 assert.equal(funds.income,6000);
 assert.equal(funds.available,63000);
 assert.equal(funds.tentative,true);
 assert.deepEqual(funds.accountForecasts[0].future,{date:'2026-12-28',amount:26000,additional:26000});
 assert.equal(funds.cardAllowance,63000);
 assert.equal(funds.currentAllowance,120000);
 assert.deepEqual(state.journal,[]);
 const calendar=budgetCalendarItems(state);
 assert.equal(calendar.filter(row=>row.kind==='bill').length,4);
 assert.equal(calendar.find(row=>row.id===bill(state).id).amount,42000);
 assert.match(calendar.find(row=>row.id===bill(state).id).description,/暫定/);
 assert.throws(()=>apply(state,'bill.confirm',{id:bill(state).id,version:bill(state).version},'2026-12-28'),/実際の請求額/);
 assert.equal(budgetSummary(state,'2026-12-15').funds.reserves,null);
});

test('CSV evidence is included only as reviewed, refunds net off, and later confirmation takes precedence',()=>{
 let state=estimate(started(),'pink',secondMonth,42000);
 const rows=[csvRow('a',30000,'2026-11-03'),csvRow('b',5000,'2026-11-15'),csvRow('c',-1000,'2026-11-16')];
 state=csv(state,rows,'2026-11-17');
 state=csv(state,rows,'2026-11-17');
 assert.equal(state.entries.length,3);
 let forecast=projection(state,'pink',secondMonth,'2026-11-17').forecast;
 assert.equal(forecast.projected,42000);
 assert.equal(forecast.registered,34000);
 assert.ok(forecast.entries.every(entry=>entry.addedSinceSnapshot));
 assert.equal(forecast.review,true);
 state=reconcile(state,forecast.entries.map(entry=>({id:entry.id,signature:entry.signature,coverage:entry.date<=today?'included':'extra'})),[],'2026-11-17');
 forecast=projection(state,'pink',secondMonth,'2026-11-17').forecast;
 assert.equal(forecast.projected,46000);
 assert.equal(forecast.review,false);
 assert.equal(budgetSummary(state,'2026-11-17').assets,300000);
 state=estimate(state,'pink',secondMonth,47000,'estimate','2026-11-17');
 assert.equal(projection(state).projected,47000);
 assert.ok(projection(state).forecast.entries.every(entry=>!entry.addedSinceSnapshot));
 state=estimate(state,'pink',secondMonth,46500,'confirmed','2026-11-20');
 assert.equal(projection(state).projected,46500);
 assert.equal(bill(state).amountHistory.length,3);
 assert.throws(()=>estimate(state,'pink',secondMonth,100,'estimate','2026-11-20'),/確定した請求額/);
 assert.equal(budgetSummary(state,'2026-11-20').assets,300000);
});

test('unincurred recurring charge, linked CSV use, confirmed bill and actual debit reserve the cost once',()=>{
 let state=started();
 state=apply(state,'rule.save',{id:'monthly-service',name:'Service',amount:3500,payment:'pink',day:20});
 state=apply(state,'plans.generate',{month:firstMonth});
 state=estimate(state,'pink',secondMonth,42000);
 const plan=state.plans[0];
 assert.equal(projection(state).projected,42000);
 state=reconcile(state,[],[{id:plan.id,version:plan.version,coverage:'extra'}]);
 assert.equal(projection(state).projected,45500);
 state=csv(state,[csvRow('a',3500,'2026-11-20',{action:'plan',planId:plan.id})],'2026-11-22');
 assert.equal(projection(state).forecast.recurring,0);
 assert.equal(projection(state).projected,45500);
 assert.equal(budgetSummary(state,'2026-11-22').cardCharges[plan.id].status,'used');
 state=estimate(state,'pink',secondMonth,47000,'confirmed','2026-11-22');
 assert.equal(budgetSummary(state,'2026-11-22').cardCharges[plan.id].status,'billed');
 const b=bill(state);
 state=apply(state,'bill.confirm',{id:b.id,version:b.version},'2026-12-28');
 const final=budgetSummary(state,'2026-12-28',firstMonth);
 assert.equal(final.cardCharges[plan.id].status,'paid');
 assert.equal(final.assets,253000);
 assert.equal(final.expense,3500);
});

test('installment boundaries, variable amounts and payment-based progress preserve existing schedules',()=>{
 const phone={id:'phone',name:'Example phone',amount:3000,payment:'bank-0',day:10,variable:true,term:{kind:'installments',firstMonth:'2026-05',total:24,priorPaid:6}};
 let state=apply(started(),'rule.save',phone);
 assert.equal(state.rules[0].term.endMonth,'2028-04');
 for(const month of ['2026-10','2026-11','2026-12','2028-04','2028-05'])state=apply(state,'plans.generate',{month});
 assert.deepEqual(state.plans.map(plan=>plan.month),['2026-11','2026-12','2028-04']);
 assert.equal(budgetSummary(state,today).installments.phone.paid,6);
 let p=state.plans[0];
 state=apply(state,'plan.edit',{id:p.id,version:p.version,amount:4000});
 p=state.plans[0];
 state=apply(state,'plans.confirm',{items:[{id:p.id,version:p.version}]});
 let progress=budgetSummary(state,today).installments.phone;
 assert.equal(progress.paid,7);
 assert.equal(progress.remaining,17);
 assert.equal(progress.projected,51000);
 state=apply(state,'plan.undo',{id:p.id});
 assert.equal(budgetSummary(state,today).installments.phone.paid,6);
 state=apply(state,'rule.save',{...phone,term:{kind:'end',endMonth:'2026-11'}});
 assert.deepEqual(budgetSummary(state,today).installments.phone.outside,['2026-12','2028-04']);
 assert.ok(state.plans.some(plan=>plan.month==='2028-04'&&plan.status==='planned'));
 assert.deepEqual(missingBudgetMonths(state,today),[]);
 assert.equal(budgetSummary(state,today).assets,300000);
});

test('stale reconciliation cannot add an edited recurring amount or a mismatched CSV row',()=>{
 let state=apply(started(),'rule.save',{id:'service',name:'Service',amount:500,payment:'pink',day:20});
 state=apply(state,'plans.generate',{month:firstMonth});
 state=estimate(state,'pink',secondMonth,5000);
 const p=state.plans[0];
 state=reconcile(state,[],[{id:p.id,version:p.version,coverage:'extra'}]);
 assert.equal(projection(state).projected,5500);
 state=apply(state,'plan.edit',{id:p.id,version:p.version,amount:750});
 assert.equal(projection(state).projected,5000);
 assert.equal(projection(state).forecast.review,true);
 assert.throws(()=>reconcile(state,[],[{id:p.id,version:p.version,coverage:'extra'}]),/照合/);
 assert.throws(()=>reconcile(state,[{id:'unrelated-row',signature:'fake',coverage:'extra'}]),/照合/);
});

test('card installment progress waits for the bank withdrawal and goes back on undo',()=>{
 let state=apply(started(),'rule.save',{
  id:'card-phone',name:'Example phone',amount:2000,payment:'pink',day:10,
  term:{kind:'installments',firstMonth,total:2},
 });
 state=apply(state,'plans.generate',{month:firstMonth});
 const plan=state.plans[0];
 state=apply(state,'plans.confirm',{items:[{id:plan.id,version:plan.version}]});
 assert.equal(budgetSummary(state,today).installments['card-phone'].paid,0);
 state=estimate(state,'pink',secondMonth,2000,'confirmed');
 const b=bill(state);
 state=apply(state,'bill.confirm',{id:b.id,version:b.version},'2026-12-28');
 assert.equal(budgetSummary(state,'2026-12-28').installments['card-phone'].paid,1);
 state=apply(state,'bill.undo',{id:b.id},'2026-12-28');
 assert.equal(budgetSummary(state,'2026-12-28').installments['card-phone'].paid,0);
});


test('November funding stays visible after a larger December bill, using balance and dated receipts',()=>{
 let state=started();
 state=apply(state,'account.adjust',{id:'bank-0',actual:2000,reason:'Fixture'});
 state=estimate(state,'pink',firstMonth,179000,'confirmed');
 state=estimate(state,'visa',firstMonth,0,'confirmed');
 state=estimate(state,'pink',secondMonth,60000);
 state=estimate(state,'visa',secondMonth,0,'confirmed');
 const save=(id,kind,to,amount,date,from)=>{state=apply(state,'cashPlan.save',{id,name:id,kind,to,amount,date,from});};
 save('past-pay','income','bank-0',95000,'2026-11-12');
 save('early-pay','income','bank-0',10000,'2026-11-26');
 save('late-pay','income','bank-0',5000,'2026-11-30');
 save('transfer','transfer','bank-0',3000,'2026-11-27','cash');
 state=apply(state,'plan.add',{id:'future-bank',name:'Future bank payment',payment:'bank-1',amount:13000,dueDate:'2026-12-29',category:'その他'});
 const previous=structuredClone(state);
 const funds=budgetSummary(state,'2026-11-14').funds;
 const bank=funds.accountForecasts.find(account=>account.accountId==='bank-0');
 assert.equal(bank.currentBalance,2000);
 const debit=bank.currentDays.find(day=>day.date==='2026-11-27');
 assert.equal(debit.before,12000);
 assert.equal(debit.payments,179000);
 assert.equal(debit.transferIn,3000);
 assert.equal(debit.balance,-164000);
 assert.equal(debit.withoutPending,-177000);
 assert.equal(debit.sameDay,true);
 assert.deepEqual(bank.needs,[{date:'2026-11-27',additional:164000,total:164000}]);
 assert.deepEqual(bank.future,{date:'2026-12-28',amount:219000,additional:55000});
 assert.equal(funds.overdueIncome[0].id,'past-pay');
 const secondBank=funds.accountForecasts.find(account=>account.accountId==='bank-1');
 assert.deepEqual(secondBank.needs,[]);
 assert.deepEqual(secondBank.future,{date:'2026-12-29',amount:13000,additional:13000});
 assert.equal(funds.monthEnd,-62000);
 assert.deepEqual(funds.monthEndTotals,{plannedIncome:15000,transferIn:3000,transferOut:3000,payments:179000});
 assert.equal(funds.accountForecasts.reduce((total,account)=>total+account.monthEnd,0),funds.monthEnd);
 const january=estimate(state,'pink','2027-01',50000);
 const updated=budgetSummary(january,'2026-11-14').funds;
 assert.equal(updated.monthEnd,funds.monthEnd);
 assert.deepEqual(updated.monthEndTotals,funds.monthEndTotals);
 assert.deepEqual(updated.accountForecasts.find(account=>account.accountId==='bank-0').futureMonths,[
  {month:'2026-12',date:'2026-12-28',amount:219000,additional:55000},
  {month:'2027-01',date:'2027-01-27',amount:269000,additional:50000},
 ]);
 assert.deepEqual(state,previous);
});

test('current positives remain visible when a future amount is missing, and confirmed funds count once',()=>{
 let state=started();
 state=estimate(state,'pink',firstMonth,50000,'confirmed');
 state=estimate(state,'visa',firstMonth,0,'confirmed');
 state=apply(state,'cashflow.funds',{month:firstMonth,living:5000,goals:[]});
 state=apply(state,'cashPlan.save',{id:'benefit',name:'児童扶養手当',kind:'income',date:'2026-11-13',to:'bank-0',amount:10000});
 state=apply(state,'cashPlan.confirm',{id:'benefit',version:1,date:'2026-11-13'});
 state=apply(state,'cashPlan.save',{id:'duplicate',name:'児童手当',kind:'income',date:'2026-11-20',to:'bank-0',amount:5000});
 let summary=budgetSummary(state,today);
 assert.equal(summary.assets,310000);
 assert.equal(summary.funds.income,0);
 assert.equal(summary.funds.monthEnd,260000);
 assert.deepEqual(summary.funds.benefitConflicts,[{month:firstMonth,ids:['duplicate']}]);
 state=apply(state,'cashPlan.cancel',{id:'duplicate',version:1});
 summary=budgetSummary(state,today);
 assert.equal(summary.funds.currentUnknown,false);
 assert.equal(summary.funds.currentAllowance,255000);
 assert.equal(summary.funds.cardAllowance,null);
 assert.equal(summary.funds.accountForecasts[0].required,0);
});

test('two conflicting benefit plans are excluded and incremental deadlines do not double count',()=>{
 let state=started();
 state=estimate(state,'pink',firstMonth,260000,'confirmed');
 state=estimate(state,'visa',firstMonth,0,'confirmed');
 state=apply(state,'cashPlan.save',{id:'a',name:'児童手当',kind:'income',date:'2026-11-20',to:'bank-0',amount:5000});
 state=apply(state,'cashPlan.save',{id:'b',name:'児童扶養手当',kind:'income',date:'2026-11-21',to:'bank-0',amount:10000});
 state=apply(state,'plan.add',{id:'direct',name:'Bank payment',payment:'bank-0',amount:20000,dueDate:'2026-11-30',category:'その他'});
 const funds=budgetSummary(state,today).funds;
 assert.equal(funds.income,0);
 assert.equal(funds.currentUnknown,true);
 assert.deepEqual(funds.accountForecasts[0].needs,[
  {date:'2026-11-27',additional:60000,total:60000},
  {date:'2026-11-30',additional:20000,total:80000},
 ]);
});

test('confirmed manual income and a matching income plan do not inflate the forecast',()=>{
 let state=started();
 state=estimate(state,'pink',firstMonth,50000,'confirmed');
 state=estimate(state,'visa',firstMonth,0,'confirmed');
 state=apply(state,'entry.add',{id:'pay',type:'income',amount:22000,date:today,payment:'bank-0',category:'給与',memo:'Salary'});
 state=apply(state,'cashPlan.save',{id:'salary',name:'Salary',kind:'income',date:today,to:'bank-0',amount:22000});
 state=apply(state,'cashflow.funds',{month:firstMonth,living:0,goals:[]});
 const summary=budgetSummary(state,today);
 assert.equal(summary.funds.monthEnd,272000);
 assert.equal(summary.funds.monthEndTotals.plannedIncome,0);
 assert.deepEqual(summary.funds.duplicateIncome.map(plan=>plan.id),['salary']);
 assert.equal(summary.funds.currentAllowance,null);
 assert.equal(state.cashPlans[0].status,'planned');
});

test('cash on another account or an unconfirmed deposit cannot unblock spending before the debit',()=>{
 let state=started();
 state=estimate(state,'pink',firstMonth,210000,'confirmed');
 state=estimate(state,'visa',firstMonth,0,'confirmed');
 state=apply(state,'cashPlan.save',{id:'deposit',name:'Pending deposit',kind:'income',date:'2026-11-23',to:'bank-0',amount:50000});
 state=apply(state,'cashflow.funds',{month:firstMonth,living:0,goals:[]});
 const {funds}=budgetSummary(state,today);
 assert.equal(funds.monthEnd,140000);
 assert.equal(funds.accountForecasts[0].required,0);
 assert.equal(funds.accountForecasts[0].requiredWithoutPending,10000);
 assert.equal(funds.currentAllowance,null);
 assert.ok(funds.allowanceIssues.includes('funding'));
});

test('transfers within the managed set net to zero and a missing-side transfer is flagged',()=>{
 let state=started();
 state=estimate(state,'pink',firstMonth,0,'confirmed');
 state=estimate(state,'visa',firstMonth,0,'confirmed');
 state=apply(state,'cashPlan.save',{id:'internal',name:'Internal',kind:'transfer',date:today,from:'bank-0',to:'cash',amount:300});
 state=apply(state,'cashPlan.save',{id:'untracked',name:'Untracked',kind:'transfer',date:today,from:'bank-2',to:'bank-0',amount:1000});
 const {funds}=budgetSummary(state,today);
 assert.equal(funds.monthEnd,300000);
 assert.equal(funds.monthEndTotals.transferIn,300);
 assert.equal(funds.monthEndTotals.transferOut,300);
 assert.equal(funds.untrackedTransfers[0].id,'untracked');
 assert.equal(funds.currentUnknown,true);
});

test('a matching bank expense and pending pull are kept for review without offering a spending amount',()=>{
 let state=started();
 state=estimate(state,'pink',firstMonth,0,'confirmed');
 state=estimate(state,'visa',firstMonth,0,'confirmed');
 state=apply(state,'entry.add',{id:'bank-debit',type:'expense',bankEntry:true,amount:900,date:today,payment:'bank-0',category:'その他'});
 state=apply(state,'plan.add',{id:'bank-pending',name:'Pending pull',payment:'bank-0',amount:900,dueDate:today,category:'その他'});
 state=apply(state,'cashflow.funds',{month:firstMonth,living:0,goals:[]});
 const {funds}=budgetSummary(state,today);
 assert.equal(funds.paymentDuplicates.fixed[0].id,'once:bank-pending');
 assert.equal(funds.currentAllowance,null);
 assert.equal(state.plans.find(plan=>plan.id==='once:bank-pending').status,'planned');
});

test('both posted child benefits are flagged without rewriting the bank ledger',()=>{
 let state=started();
 state=estimate(state,'pink',firstMonth,0,'confirmed');
 state=estimate(state,'visa',firstMonth,0,'confirmed');
 state=apply(state,'cashflow.funds',{month:firstMonth,living:0,goals:[]});
 for(const [id,amount,memo] of [['benefit-a',10000,'児童扶養手当'],['benefit-b',4000,'児童手当']]){
  state=apply(state,'entry.add',{id,type:'income',amount,date:today,payment:'bank-0',category:'手当',memo});
 }
 const {funds}=budgetSummary(state,today);
 assert.equal(funds.currentAssets,314000);
 assert.deepEqual(funds.paidBenefitConflicts,[firstMonth]);
 assert.equal(funds.currentAllowance,null);
});

test('spending month uses previous payroll and cash or bank payment dates, with rolling carryover',()=>{
 let state=started();
 // Begin in October so the preceding payroll is independently tracked.
 state.startDate='2026-10-01';
 for(const account of state.accounts)if(account.openingDate)account.openingDate=state.startDate;
 const post=(id,type,amount,date,payment,category)=>{state=apply(state,'entry.add',{id,type,amount,date,payment,category,bankEntry:true});};
 post('oct-salary','income',100000,'2026-10-30','bank-0','給与');
 post('nov-cash','expense',5000,'2026-11-03','cash','食費');
 post('nov-bank','expense',3000,'2026-11-04','bank-0','固定費');
 post('oct-card','expense',4000,'2026-10-28','pink','食費');
 state=estimate(state,'pink',firstMonth,4000,'confirmed');
 state=estimate(state,'visa',firstMonth,0,'confirmed');
 state=estimate(state,'pink',secondMonth,2000,'confirmed');
 state=estimate(state,'visa',secondMonth,0,'confirmed');
 state=apply(state,'cashPlan.save',{id:'nov-payroll',kind:'income',name:'給与',amount:110000,date:'2026-11-30',to:'bank-0'});
 state=apply(state,'transfer',{from:'bank-0',to:'cash',amount:1000,date:'2026-11-10'});
 const opts={defaultMonthlyBenefit:{enabled:true,even:10000,odd:20000}};
 const [nov,dec]=budgetSummary(state,today,firstMonth,'date',opts).spendingMonths.months;
 assert.equal(nov.carry,300000);
 assert.equal(nov.salary,100000);
 assert.equal(nov.benefit,20000);
 assert.deepEqual(nov.payments,{bank:3000,cash:5000,card:4000});
 assert.equal(nov.remaining,408000);
 assert.equal(dec.carry,408000);
 assert.equal(dec.salary,110000);
 assert.equal(dec.benefit,10000);
 assert.equal(dec.payments.card,2000);
 assert.equal(dec.remaining,526000);
});

test('registered benefit replaces automatic amount and disabled rules do not reappear',()=>{
 const opts={defaultMonthlyBenefit:{enabled:true,even:10000,odd:20000}};
 let state=started();
 state=apply(state,'entry.add',{id:'actual-benefit',type:'income',amount:25000,date:today,payment:'bank-0',category:'手当',memo:'児童扶養手当'});
 const months=()=>budgetSummary(state,today,firstMonth,'date',opts).spendingMonths.months;
 assert.equal(months()[0].benefit,25000);
 assert.equal(months()[1].benefit,10000);
 state=apply(state,'cashflow.monthlyBenefit',{enabled:true,even:12000,odd:23000});
 assert.equal(months()[1].benefit,12000);
 state=apply(state,'cashflow.monthlyBenefit',{enabled:false,even:0,odd:0});
 assert.equal(months()[0].benefit,25000);
 assert.equal(months()[1].benefit,0);
});

const monthlyAccount=(state,month,id='bank-0',date=today)=>
 budgetSummary(state,date,undefined,undefined,{accountMonth:month}).accountMonth.accounts.find(a=>a.id===id);

test('account month carries November closing balance into December and projects the December card bill once',()=>{
 let s=started();
 s=estimate(s,'pink',firstMonth,197000,'confirmed');
 s=estimate(s,'visa',firstMonth,0,'confirmed');
 s=apply(s,'entry.add',{id:'card-nov',type:'expense',date:today,payment:'pink',amount:80000,category:'その他'});
 s=estimate(s,'visa',secondMonth,0,'confirmed');
 assert.equal(monthlyAccount(s,firstMonth).monthEnd,3000);
 let dec=monthlyAccount(s,secondMonth);
 assert.equal(dec.opening,3000);
 assert.equal(dec.totals.payments,80000);
 assert.equal(dec.required,77000);
 assert.equal(dec.estimatedPayment,true);
 assert.deepEqual(dec.deadlines.map(x=>[x.date,x.amount]),[['2026-12-28',77000]]);
 s=estimate(s,'pink',secondMonth,80000,'confirmed');
 dec=monthlyAccount(s,secondMonth);
 assert.equal(dec.totals.payments,80000);
 assert.equal(dec.items.filter(item=>item.kind==='bill'&&item.amount>0).length,1);
 assert.equal(dec.estimatedPayment,false);
});

test('monthly transfer is mirrored and funding ignores later or same-day income; only the peak shortfall is required',()=>{
 let s=started();
 const bank='bank-1';
 s=apply(s,'plan.add',{id:'first',name:'First debit',amount:10000,payment:bank,dueDate:'2026-12-07'});
 s=apply(s,'plan.add',{id:'second',name:'Second debit',amount:10000,payment:bank,dueDate:'2026-12-21'});
 s=apply(s,'cashPlan.save',{id:'move',name:'Transfer',kind:'transfer',from:'bank-0',to:bank,date:'2026-12-01',amount:4000});
 s=apply(s,'cashPlan.save',{id:'salary',name:'Deposit',kind:'income',to:bank,date:'2026-12-07',amount:8000});
 s=apply(s,'cashPlan.save',{id:'late',name:'Later deposit',kind:'income',to:bank,date:'2026-12-22',amount:20000});
 const dec=monthlyAccount(s,secondMonth,bank);
 assert.equal(dec.totals.transferIn,4000);
 assert.equal(monthlyAccount(s,secondMonth).totals.transferOut,4000);
 assert.equal(dec.totals.income,28000);
 assert.equal(dec.required,8000);
 assert.equal(dec.monthEnd,12000);
 assert.deepEqual(dec.deadlines.map(x=>[x.date,x.amount,x.total]),[['2026-12-07',6000,6000],['2026-12-21',2000,8000]]);
});

test('twelve-month outlook is read-only, keeps reservations outside bank balances and records past balances from the journal',()=>{
 let s=started();
 s=apply(s,'rule.save',{id:'month-end',name:'Recurring debit',amount:1000,payment:'bank-1',day:31,firstMonth:secondMonth});
 s=apply(s,'entry.add',{id:'old-debit',type:'expense',date:today,payment:'bank-0',bankEntry:true,amount:500,category:'その他'});
 s=apply(s,'cashPlan.save',{id:'later-pay',name:'Later debit funding',kind:'income',to:'bank-1',date:'2027-11-05',amount:123});
 s.savingsGoals=[{id:'test-goal',name:'Saving',category:'other',target:null,status:'active',holdings:{'bank-0':100000},frequency:'irregular',scheduleAsOf:today}];
 s=estimate(s,'pink',secondMonth,120000,'confirmed');
 const before=structuredClone(s);
 const last=budgetSummary(s,today,undefined,undefined,{accountMonth:'2027-11'}).accountMonth;
 assert.equal(last.max,'2027-11');assert.equal(last.min,'2025-11');
 const far=last.accounts.find(a=>a.id==='bank-1');
 assert.equal(far.totals.payments,2000);assert.equal(far.totals.income,123);
 assert.deepEqual(far.items.filter(item=>item.kind==='plan').map(item=>item.date),['2027-11-01','2027-11-30']);
 const jan=monthlyAccount(s,'2027-01','bank-1');
 assert(jan.items.some(item=>item.date==='2027-01-04'&&item.name==='Recurring debit'));
 const dec=monthlyAccount(s,secondMonth);
 assert.equal(dec.opening,199500);assert.equal(dec.reserved,100000);
 assert.equal(dec.monthEnd,79500);assert.equal(dec.required,20500);
 assert.equal(dec.incomplete,true);
 const nov=monthlyAccount(s,firstMonth,'bank-0','2026-12-10');
 assert.equal(nov.opening,200000);assert.equal(nov.monthEnd,199500);
 assert.equal(nov.required,null);
 assert.deepEqual(s,before);
});

test('changing the confirmed debit date moves the amount to that month without creating a second charge',()=>{
 let s=started();
 s=estimate(s,'pink',secondMonth,25000,'confirmed');
 const saved=bill(s);
 s=apply(s,'bill.edit',{id:saved.id,version:saved.version,dueDate:'2027-01-08',actual:25000,reason:'Adjusted bank withdrawal date'});
 assert(!monthlyAccount(s,secondMonth).items.some(item=>item.id===saved.id));
 const jan=monthlyAccount(s,'2027-01');
 assert.deepEqual(jan.items.filter(item=>item.id===saved.id).map(item=>[item.date,item.amount,item.uncertain]),[['2027-01-08',25000,false]]);
});

test('account passbook joins dated postings and forecasts without writing either month',()=>{
 let s=started();
 s=apply(s,'entry.add',{id:'benefit-actual',type:'income',date:'2026-11-11',payment:'bank-0',amount:2000,category:'その他',memo:'Deposit'});
 s=apply(s,'transfer',{from:'bank-0',to:'bank-1',date:today,amount:1000,reason:'Transfer'});
 s=apply(s,'plan.add',{id:'late-debit',name:'Debit',payment:'bank-0',dueDate:'2026-11-18',amount:207000});
 s=apply(s,'cashPlan.save',{id:'same-day-credit',kind:'income',name:'Deposit',to:'bank-0',date:'2026-11-18',amount:11000});
 s=apply(s,'cashPlan.save',{id:'earlier-credit',kind:'income',name:'Earlier',to:'bank-0',date:'2026-11-16',amount:500});
 s=estimate(s,'pink',firstMonth,0,'confirmed');
 s=estimate(s,'visa',firstMonth,0,'confirmed');
 const before=structuredClone(s);
 const nov=monthlyAccount(s,firstMonth);
 assert.deepEqual(nov.transactions.filter(row=>row.delta).map(row=>[row.date,row.status,row.delta,row.balance]),[
  ['2026-11-11','posted',2000,202000],
  [today,'posted',-1000,201000],
  ['2026-11-16','planned',500,201500],
  ['2026-11-18','planned',-207000,-5500],
  ['2026-11-18','planned',11000,5500],
 ]);
 assert.deepEqual(nov.nextDebit,{date:'2026-11-18',cost:207000,unknown:false,before:201500,incomingBefore:500,gap:5500});
 assert.equal(nov.required,5500);
 assert.equal(nov.monthEnd,5500);
 assert.equal(monthlyAccount(s,secondMonth).basis,5500);
 assert.equal(monthlyAccount(s,firstMonth,'bank-1').transactions[0].delta,1000);
 assert.deepEqual(s,before);
});

test('unpriced payments are marked and historical passbooks contain only journal rows',()=>{
 let s=started();
 s=apply(s,'entry.add',{id:'oct-record',type:'income',date:'2026-11-01',payment:'bank-0',amount:1200,category:'その他'});
 const past=monthlyAccount(s,firstMonth,'bank-0','2026-12-01');
 assert.equal(past.monthEnd,201200);
 assert.equal(past.required,null);
 assert(past.transactions.every(row=>row.status==='posted'));
 const dec=monthlyAccount(s,secondMonth);
 assert(dec.transactions.some(row=>row.status==='planned'&&row.unknown));
 assert.equal(dec.incomplete,true);
 assert.equal(monthlyAccount(s,secondMonth,'bank-3').basis,null);
});
