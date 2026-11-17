import test from 'node:test';
import assert from 'node:assert/strict';
import {accountBalance,applyBudgetCommand,billProjection,budgetSummary,cardBalance,newBudget} from '../src/budget-core.js';
import {savingsCalendarItems,savingsOverview} from '../src/budget-savings.js';

const today='2026-11-17';
let sequence=0;
const run=(state,type,data,date=today)=>applyBudgetCommand(state,{type,data},{today:date,eventId:'saving-'+(++sequence)});
function start(){
 let s=newBudget();
 for(const id of ['pink','visa'])s=run(s,'card.configure',{id,accountId:'bank-0',closingDay:31,paymentDay:27,monthOffset:1});
 s=run(s,'start',{confirm:true,startDate:'2026-11-01',accounts:[{id:'bank-0',amount:250000},{id:'bank-1',amount:0},{id:'cash',amount:20000}],cards:[{id:'pink',amount:0},{id:'visa',amount:0}]});
 for(const b of budgetSummary(s,today).generation)s=run(s,'plans.generate',{month:b});
 for(const b of s.bills.filter(b=>b.month==='2026-11'))s=run(s,'bill.edit',{id:b.id,version:b.version,actual:0,dueDate:b.dueDate,openingAllocation:0});
 return run(s,'cashflow.funds',{month:'2026-11',living:10000,goals:[]});
}
const defaults={name:'合成旅行目標',category:'旅行',target:140000,startMonth:'2026-11',deadline:'2027-02-28',day:25,accountId:'bank-0',frequency:'monthly',mode:'auto',status:'active'};
const save=(s,settings={})=>run(s,'savings.goal.save',{...defaults,...settings});
const overview=s=>savingsOverview(s,today);
const record=(s,kind,amount,rest={})=>run(s,'savings.goal.record',{id:s.savingsGoals[0].id,accountId:'bank-0',kind,date:today,amount,...rest});

test('independent goals support automatic, fixed, alternate, once, irregular and rounded installments',()=>{
 let s=save(start());
 s=save(s,{name:'美容',target:10001});
 s=save(s,{name:'隔月',target:40000,frequency:'alternate',mode:'manual',amount:10000});
 s=save(s,{name:'一括',frequency:'once',target:900});
 s=save(s,{name:'不定期',frequency:'irregular',target:1000});
 const {goals}=overview(s);
 assert.deepEqual(goals.map(goal=>goal.plans.map(p=>p.amount)),[[35000,35000,35000,35000],[2501,2501,2501,2498],[10000,10000],[900],[]]);
 assert.equal(goals[2].onTrack,false);
 s=run(s,'savings.goal.plan',{id:goals[4].id,date:'2026-12-06',amount:1000});
 assert.equal(overview(s).goals[4].onTrack,true);
 s=run(s,'savings.goal.plan',{id:goals[4].id,date:'2027-01-06',previousDate:'2026-12-06',amount:1000});
 assert.equal(overview(s).goals[4].plans[0].date,'2027-01-06');
 assert.equal(overview(s).goals[4].plans.length,1);
});

test('confirmed partial contributions recalculate the balance over future installments and cannot confirm twice',()=>{
 let s=save(start());
 s=record(s,'confirm',20000,{period:'2026-11'});
 const o=overview(s);
 assert.equal(o.confirmed,20000);assert.equal(o.plannedConfirmed,35000);assert.equal(o.pending,0);
 assert.deepEqual(o.goals[0].plans.map(plan=>plan.amount),[40000,40000,40000]);
 assert.throws(()=>record(s,'confirm',20000,{period:'2026-11'}));
 const december=savingsOverview(s,'2026-12-30');
 assert.equal(december.pending,40000);
});

test('reserve plans and reservations reduce available funds separately from actual bank/cash balances and month-end',()=>{
 const initial=start(),base=budgetSummary(initial,today);
 const planned=save(initial);
 const forecast=budgetSummary(planned,today);
 assert.equal(forecast.funds.monthEnd,base.funds.monthEnd);
 assert.equal(forecast.funds.currentAllowance,base.funds.currentAllowance-35000);
 assert.deepEqual(planned.journal,initial.journal);
 const s=record(planned,'confirm',35000,{period:'2026-11'});
 assert.equal(accountBalance(s,'bank-0',today),250000);
 assert.equal(budgetSummary(s,today).funds.currentAllowance,forecast.funds.currentAllowance);
 assert.equal(overview(s).reserved,35000);
 assert.throws(()=>record(s,'add',220000),/自由残高/);
 const cash=record(s,'add',20000,{accountId:'cash'});
 assert.equal(accountBalance(cash,'cash',today),20000);
 assert.throws(()=>record(cash,'add',1,{accountId:'cash'}),/自由残高/);
});

test('an actual bank transfer posts exactly two movements without income or spending; changing allocations adds no movements',()=>{
 let s=save(start());s=save(s,{name:'別の積立'});
 s=record(s,'add',30000,{to:'bank-1'});
 assert.deepEqual([accountBalance(s,'bank-0',today),accountBalance(s,'bank-1',today)],[220000,30000]);
 assert.equal(s.journal.length,2);
 assert.equal(budgetSummary(s,today).income,0);assert.equal(budgetSummary(s,today).expense,0);
 assert.throws(()=>run(s,'transfer.undo',{id:s.transfers[0].id}),/積立/);
 s=record(s,'move',4000,{accountId:'bank-1',destination:s.savingsGoals[1].id});
 s=record(s,'release',1000,{accountId:'bank-1'});
 assert.deepEqual(overview(s).goals.map(g=>g.balance),[25000,4000]);
 assert.equal(accountBalance(s,'bank-1',today),30000);
 assert.equal(s.journal.length,2);
});

test('an already posted transfer can be allocated without moving the same funds again',()=>{
 let s=save(start());
 s=run(s,'transfer',{from:'bank-0',to:'bank-1',date:today,amount:30000});
 const transferId=s.transfers.at(-1).id;
 assert.throws(()=>record(s,'add',30000,{to:'bank-1'}),/既存の振替/);
 s=record(s,'add',30000,{to:'bank-1',transferId});
 assert.equal(s.journal.length,2);
 assert.equal(overview(s).reserved,30000);
 assert.throws(()=>record(s,'add',30000,{to:'bank-1',transferId}),/すでに積立に使用/);
});

test('spending uses reserved funds and links already recorded payments without a second expense',()=>{
 let s=save(start(),{initial:30000});
 s=record(s,'pay',4000);
 assert.equal(overview(s).reserved,26000);assert.equal(accountBalance(s,'bank-0',today),246000);
 assert.throws(()=>record(s,'pay',4000),/既存の支出/);
 s=run(s,'entry.add',{id:'existing',date:today,type:'expense',bankEntry:true,amount:3000,payment:'bank-0'});
 s=record(s,'pay',3000,{entryId:'existing'});
 assert.equal(overview(s).reserved,23000);assert.equal(accountBalance(s,'bank-0',today),243000);
 assert.equal(budgetSummary(s,today).expense,7000);
 assert.throws(()=>record(s,'pay',3000,{entryId:'existing'}),/充当済み/);
 assert.throws(()=>run(s,'entry.void',{id:'existing'}),/積立/);
});

test('loan funds and actual principal repayments are separate and interest records only on payment',()=>{
 let s=save(start(),{category:'借金返済',debt:{principal:300000,rate:2.5},target:300000});
 s=record(s,'add',15000);
 assert.equal(overview(s).goals[0].principalPaid,0);
 s=record(s,'repay',15000,{principal:14500});
 assert.equal(overview(s).goals[0].balance,0);
 assert.equal(overview(s).goals[0].principalPaid,14500);
 assert.equal(s.savingsGoalEvents.at(-1).interest,500);
 assert.equal(budgetSummary(s,today).expense,15000);
});

test('hotel remains outside the travel goal; card estimate, matching card expenses and confirmed bill cannot double it',()=>{
 let s=save(start());
 s=run(s,'card.purchasePlan.save',{name:'ホテル',cardId:'pink',useDate:'2027-03-20',statementMonth:'2027-04',month:'2027-04',amount:56250});
 assert.equal(overview(s).goals[0].target,140000);
 assert.equal(accountBalance(s,'bank-0',today),250000);assert.equal(cardBalance(s,'pink',today),0);
 const b=s.bills.find(bill=>bill.month==='2027-04'&&bill.cardId==='pink');
 assert.equal(billProjection(s,b).projected,56250);
 assert.throws(()=>run(s,'bill.cancel',{id:b.id,version:b.version}));
 s=run(s,'entry.add',{id:'hotel',date:'2027-03-20',type:'expense',amount:56250,payment:'pink'},'2027-03-21');
 assert.equal(billProjection(s,b).projected,56250);
 assert.equal(billProjection(s,b).forecast.review,true);
 s=run(s,'bill.edit',{id:b.id,version:b.version,actual:56250,dueDate:b.dueDate,openingAllocation:0},'2027-04-19');
 assert.equal(billProjection(s,s.bills.find(bill=>bill.id===b.id)).projected,56250);
});

test('moving a standalone card purchase from April to May leaves its amount in May only',()=>{
 let s=start(), plan={name:'ホテル',cardId:'pink',useDate:'2027-03-20',month:'2027-04',amount:56250};
 s=run(s,'card.purchasePlan.save',plan);
 s=run(s,'card.purchasePlan.save',{...plan,id:s.cardPurchasePlans[0].id,month:'2027-05'});
 assert.equal(s.bills.some(b=>b.month==='2027-04'),false);
 assert.deepEqual(s.bills.filter(b=>b.month==='2027-05').map(b=>billProjection(s,b).projected),[56250]);
});

test('legacy signed records are carried forward intact with unknown goal metadata and no second reserve',()=>{
 let s=start();s=run(s,'savings.allocate',{purpose:'積立',date:today,amount:5000});s=run(s,'savings.allocate',{purpose:'積立',date:today,amount:-500});
 const legacy=structuredClone(s.savingsAllocations),journal=structuredClone(s.journal);
 assert.equal(overview(s).unassigned,4500);
 s=save(s,{name:'積立',target:null,deadline:null,startMonth:null,accountId:null,legacyPurpose:'積立'});
 assert.deepEqual(s.savingsAllocations,legacy);
 assert.equal(overview(s).goals[0].remaining,null);
 assert.equal(overview(s).reserved,4500);assert.equal(overview(s).legacy.length,0);
 s=record(s,'assign',4500);
 assert.equal(overview(s).reserved,4500);assert.equal(overview(s).unassigned,0);
 assert.deepEqual(s.journal,journal);
 s=record(s,'delete',0,{confirm:true});
 assert.equal(overview(s).reserved,0);assert.equal(overview(s).goals.length,0);
 assert.deepEqual(s.savingsAllocations,legacy);assert.deepEqual(s.journal,journal);
});

test('calendar keys are stable on edit and confirmation, and deletion removes only the goal projection',()=>{
 let s=save(start()),before=savingsCalendarItems(s);
 assert.equal(before.length,5);
 s=save(s,{id:s.savingsGoals[0].id,name:'旅行名変更'});
 assert.deepEqual(savingsCalendarItems(s).map(x=>x.key),before.map(x=>x.key));
 s=record(s,'confirm',35000,{period:'2026-11'});
 const after=savingsCalendarItems(s);
 assert.equal(new Set(after.map(x=>x.key)).size,5);
 assert.equal(after.find(x=>x.key===before[0].key).status,'confirmed');
 s=record(s,'delete',0,{confirm:true});
 assert.equal(savingsCalendarItems(s).length,0);
});
