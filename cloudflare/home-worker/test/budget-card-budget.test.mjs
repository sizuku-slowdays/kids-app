import test from 'node:test';
import assert from 'node:assert/strict';
import {newBudget,applyBudgetCommand,budgetSummary} from '../src/budget-core.js';
import {incomeDefaults} from '../src/budget-card-budget.js';
let seq=0;
const now='2026-11-27';
const apply=(s,type,data,date=now)=>applyBudgetCommand(s,{type,data},{today:date,eventId:'outlook-'+(++seq)});
function base(){
 let s=newBudget();
 for(const id of ['pink','visa'])s=apply(s,'card.configure',{id,accountId:'bank-0',closingDay:31,paymentDay:27,monthOffset:1});
 s=apply(s,'start',{startDate:'2026-11-01',confirm:true,accounts:[{id:'bank-0',amount:70000},{id:'bank-1',amount:0},{id:'cash',amount:0}],cards:[{id:'pink',amount:0},{id:'visa',amount:0}]});
 for(const month of ['2026-11','2026-12'])s=apply(s,'cashflow.funds',{month,living:0,carry:0,goals:[]});
 for(const [cardId,amount] of [['pink',70000],['visa',30000]])s=apply(s,'bill.estimate',{cardId,month:'2026-12',amount,status:'estimate',checkedDate:now});
 // Current month is known to have no remaining debit.
 for(const cardId of ['pink','visa'])s=apply(s,'bill.estimate',{cardId,month:'2026-11',amount:0,status:'confirmed',checkedDate:now});
 return s;
}
const settings=s=>apply(s,'cashflow.incomeRules',{rules:incomeDefaults.map(r=>({...r,day:r.id==='salary'?31:11,accountId:'bank-0'}))});
const budget=(s,date=now)=>budgetSummary(s,date).cardBudget;

test('synthetic budget uses carry plus income, alternating benefit, and the existing reconciled card totals',()=>{
 let s=settings(base());const before=structuredClone(s);
 let b=budget(s);
 assert.equal(b.currentCarry,70000);assert.equal(b.carry,70000);
 assert.equal(b.totalIncome,285000);assert.equal(b.totalFunds,355000);
 assert.equal(b.registered,100000);assert.equal(b.estimate,255000);assert.equal(b.usable,255000);
 assert.equal(b.incomes.filter(i=>['child','support'].includes(i.id)).length,1);
 assert.equal(b.incomes.find(i=>i.id==='child').amount,40000);
 assert.deepEqual(s,before);
 s=apply(s,'cashflow.funds',{month:'2026-12',living:40000,carry:50000,goals:[{name:'purpose',amount:10000}]});
 b=budget(s);assert.equal(b.usable,155000);
 s=apply(s,'plan.add',{id:'bank-debit',name:'Bank debit',dueDate:'2026-12-10',amount:10000,payment:'bank-0',category:'その他'});
 assert.equal(budget(s).usable,145000);
});

test('rules and overrides are budget-only; require explicit missing reserve values and immutable source state',()=>{
 let s=base();const original=structuredClone(s);let b=budget(s);
 assert.equal(b.usable,null);assert.ok(b.issues.includes('incomeSettings'));
 s=settings(s);
 assert.deepEqual(s.journal,original.journal);assert.deepEqual(s.cashPlans,original.cashPlans);assert.deepEqual(s.accounts,original.accounts);
 delete s.fundReserves['2026-12'].carry;
 assert.equal(budget(s).usable,null);assert.ok(budget(s).issues.includes('reserves'));
 assert.equal(budgetSummary(s,now).assets,70000);
});

test('actual payroll is already in carry and replaces the forecast even if amount and day differ',()=>{
 let s=settings(base());
 s=apply(s,'entry.add',{id:'paid-salary',type:'income',date:'2026-11-26',amount:210000,payment:'bank-0',category:'給与',memo:'11月給与'});
 const b=budget(s);
 assert.equal(b.currentCarry,280000);assert.equal(b.embedded,210000);assert.equal(b.carry,70000);
 assert.equal(b.totalFunds,345000);assert.equal(b.usable,245000);
 assert.equal(b.incomes.find(i=>i.id==='salary').status,'posted');
 assert.equal(budgetSummary(s,now).accounts.find(a=>a.id==='bank-0').balance,280000);
 s=apply(s,'entry.void',{id:'paid-salary',reason:'test'});
 assert.equal(budget(s).totalFunds,355000);
});

test('a registered salary plan is counted once before and after confirming it',()=>{
 let s=settings(base());
 s=apply(s,'cashPlan.save',{id:'payroll',kind:'income',name:'11月給与',date:'2026-11-30',amount:215000,to:'bank-0',category:'給与'});
 let b=budget(s);assert.equal(b.totalFunds,350000);assert.equal(b.currentCarry,285000);assert.equal(b.carry,70000);
 s=apply(s,'cashPlan.confirm',{id:'payroll',version:1},'2026-11-30');
 b=budget(s,'2026-11-30');assert.equal(b.totalFunds,350000);assert.equal(b.incomes.find(i=>i.id==='salary').status,'posted');
});

test('month overrides, year boundary, zero income, and reset retain reusable rules',()=>{
 let s=settings(base());
 const items=incomeDefaults.map(r=>({id:r.id,enabled:true,amount:r.id==='salary'?230000:r.amount,date:r.id==='salary'?'2026-11-30':'2026-12-11',accountId:'bank-0'}));
 s=apply(s,'cashflow.incomeMonth',{month:'2026-12',items});
 assert.equal(budget(s).totalFunds,365000);
 s=apply(s,'cashflow.incomeMonth.reset',{month:'2026-12'});assert.equal(budget(s).totalFunds,355000);
 const b=budget(s,'2026-12-01');assert.equal(b.month,'2027-01');
 assert.equal(b.incomes.find(i=>i.id==='support').amount,100000);assert.ok(!b.incomes.some(i=>i.id==='child'));
 assert.equal(b.incomes.find(i=>i.id==='salary').receiptMonth,'2026-12');
 items.find(i=>i.id==='salary').enabled=false;
 s=apply(s,'cashflow.incomeMonth',{month:'2026-12',items});assert.ok(!budget(s).incomes.some(i=>i.id==='salary'));
});

test('card budget responds to card estimates and balances; negative availability becomes zero plus shortage',()=>{
 let s=settings(base());
 const bill=s.bills.find(b=>b.cardId==='pink'&&b.month==='2026-12');
 s=apply(s,'bill.estimate',{cardId:'pink',month:'2026-12',amount:400000,status:'estimate',checkedDate:now,version:bill.version});
 let b=budget(s);assert.equal(b.usable,0);assert.equal(b.shortage,75000);
 s=apply(s,'entry.add',{id:'cash-spend',type:'expense',date:now,amount:5000,payment:'cash',category:'食費'});
 assert.equal(budget(s).shortage,80000);
});

test('a different amount/date actual and an unresolved salary plan do not add two salaries',()=>{
 let s=settings(base());
 s=apply(s,'cashPlan.save',{id:'old-payroll',kind:'income',name:'給与',date:'2026-11-30',amount:220000,to:'bank-0',category:'給与'});
 s=apply(s,'entry.add',{id:'actual-payroll',type:'income',date:'2026-11-26',amount:210000,payment:'bank-0',category:'給与'});
 const b=budget(s);assert.equal(b.totalFunds,345000);assert.equal(b.usable,null);assert.ok(b.issues.includes('incomeConflict'));
});

test('monthly availability does not hide a debit before income or same-day funding order',()=>{
 let s=settings(base());
 s=apply(s,'plan.add',{id:'early-debit',name:'early debit',dueDate:'2026-12-01',amount:100000,payment:'bank-1',category:'その他'});
 let b=budget(s);assert.ok(b.usable>0);assert.ok(b.timing.some(t=>t.date==='2026-12-01'&&t.accountId==='bank-1'&&t.shortage===100000));
 s=apply(s,'cashPlan.save',{id:'move',kind:'transfer',name:'transfer',date:'2026-12-01',amount:100000,from:'bank-0',to:'bank-1'});
 b=budget(s);assert.equal(b.usable,155000);assert.ok(b.timing.some(t=>t.accountId==='bank-1'&&t.sameDay));
});

test('validation rejects bad settings; old reserve commands preserve carry',()=>{
 let s=settings(base());
 assert.throws(()=>apply(s,'cashflow.incomeRules',{rules:incomeDefaults.map(r=>({...r,day:32}))}),/入金予定日/);
 assert.throws(()=>apply(s,'cashflow.incomeMonth',{month:'2026-12',items:[]}),/月別/);
 s=apply(s,'cashflow.funds',{month:'2026-12',living:0,carry:10000,goals:[]});
 s=apply(s,'cashflow.funds',{month:'2026-12',living:5000,goals:[]});assert.equal(s.fundReserves['2026-12'].carry,10000);
});

test('card fixed cost and effective app/CSV totals are used once, with actual bank fixed costs separate',()=>{
 let s=settings(base());
 s=apply(s,'rule.save',{id:'card-recurring',name:'card monthly',amount:3000,payment:'pink',category:'通信・サブスク',day:5});
 s=apply(s,'rule.save',{id:'bank-recurring',name:'bank monthly',amount:9000,payment:'bank-1',category:'税金・保険',day:10});
 s.rules.forEach(r=>r.firstMonth=r.payment==='pink'?'2026-11':'2026-12');
 s=apply(s,'plans.generate',{month:'2026-11'});
 s=apply(s,'plans.generate',{month:'2026-12'});
 const before=budget(s);
 // The app snapshot's recurring inclusion needs explicit reconciliation first.
 const b=s.bills.find(b=>b.cardId==='pink'&&b.month==='2026-12');
 const projection=budgetSummary(s,now).cards.find(c=>c.id==='pink').bills.find(x=>x.id===b.id);
 const future=projection.forecast.plans.map(p=>({id:p.id,version:p.version,coverage:'included'}));
 s=apply(s,'bill.reconcile',{id:b.id,version:b.version,decisions:[],future});
 const after=budget(s);
 assert.equal(after.otherPayments,9000);
 assert.equal(after.registered,100000);
 assert.equal(after.usable,246000);
 assert.ok(before.issues.includes('payments'));
});

test('benefit conflicts do not count two child benefits and monthly settings cannot swap the seasons',()=>{
 let s=settings(base());
 for(const [id,name,amount] of [['b1','児童手当',40000],['b2','児童扶養手当',100000]])s=apply(s,'cashPlan.save',{id,kind:'income',name,category:name,amount,date:'2026-12-11',to:'bank-0'});
 const b=budget(s);assert.equal(b.incomes.filter(i=>['child','support'].includes(i.id)).length,1);
 assert.equal(b.incomes.find(i=>i.id==='child').amount,0);assert.equal(b.usable,null);assert.ok(b.issues.includes('benefitConflict'));
 assert.throws(()=>apply(s,'cashflow.incomeRules',{rules:incomeDefaults.map(r=>({...r,receiptOffset:r.id==='child'?-1:r.receiptOffset}))}),/手当/);
});

test('unknown dates and accounts stay explicit, and overdue expected income cannot justify a spendable amount',()=>{
 let s=apply(base(),'cashflow.incomeRules',{rules:incomeDefaults});
 let b=budget(s);assert.ok(b.issues.includes('incomeDate'));assert.ok(b.issues.includes('incomeAccount'));
 s=apply(s,'cashflow.incomeRules',{rules:incomeDefaults.map(r=>({...r,day:1,accountId:'bank-0'}))});
 b=budget(s);assert.equal(b.usable,null);assert.ok(b.issues.includes('overdueIncome'));
});

test('legacy benefit settings and monthly overrides stay aligned with the new income settings',()=>{
 let s=settings(base());
 assert.deepEqual(s.monthlyBenefit,{enabled:true,even:40000,odd:100000});
 s=apply(s,'cashflow.monthlyBenefit',{enabled:true,even:45000,odd:110000});
 assert.equal(budget(s).incomes.find(i=>i.id==='child').amount,45000);
 const items=s.incomeOutlook.rules.map(r=>({id:r.id,enabled:true,amount:r.id==='child'?46000:r.amount,date:null,accountId:'bank-0'}));
 s=apply(s,'cashflow.incomeMonth',{month:'2026-12',items});
 assert.equal(budgetSummary(s,now).spendingMonths.months.find(m=>m.month==='2026-12').benefit,46000);
 assert.equal(budget(s).incomes.find(i=>i.id==='child').amount,46000);
});

test('an unclassified matching deposit is flagged rather than silently adding a second payroll',()=>{
 let s=settings(base());
 s=apply(s,'entry.add',{id:'unclassified-salary',type:'income',date:'2026-11-26',amount:220000,payment:'bank-0',category:'その他'});
 const b=budget(s);assert.equal(b.usable,null);assert.ok(b.issues.includes('incomeConflict'));
 assert.equal(b.totalFunds,355000);
});
