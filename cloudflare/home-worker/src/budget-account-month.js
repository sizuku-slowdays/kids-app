import {plannedCashFlows, shiftBillingMonth} from './budget-forecast.js';

export function accountMonthBounds(current) {
 const min=shiftBillingMonth(current,-12),max=shiftBillingMonth(current,12);
 return {min:min<'2000-01'?'2000-01':min,max:max>'2100-12'?'2100-12':max};
}

export function projectAccountMonth(state, accounts, cards, rows, holdings, today, month) {
 const current=today.slice(0,7), first=month+'-01', historical=month<current;
 const journal=state.journal.filter(entry=>entry.scope==='account'&&entry.date<=today);
 const cash=plannedCashFlows(state,today);
 const knownIds=new Set(accounts.filter(account=>account.balance!==null).map(account=>account.id));
 const ignoredCash=[...(state.cashPlans||[]).filter(plan=>cash.conflicts.some(conflict=>conflict.ids.includes(plan.id))),
  ...cash.duplicateIncome,...cash.duplicateTransfers];
 return accounts.map(account=>{
  const id=account.id;
  const known=account.opening!==null&&account.openingDate.slice(0,7)<=month;
  const openedMidMonth=known&&account.openingDate>first;
  const entries=journal.filter(entry=>entry.target===id);
  const posted=entries.filter(entry=>entry.date.slice(0,7)===month);
  const related=rows.filter(row=>row.from===id||row.to===id);
  const items=historical?[]:related.filter(row=>row.date.slice(0,7)===month);
  const prior=historical?[]:related.filter(row=>row.date<first);
  const change=(balance,item)=>balance+(item.to===id?item.amount:-item.amount);
  const opening=!known?null:month>current?prior.reduce(change,account.balance):
   account.opening+entries.filter(entry=>entry.date<first).reduce((total,entry)=>total+entry.delta,0);
  const basis=month===current?account.balance:opening;
  const reserved=historical?0:holdings[id]||0;
  let balance=basis, required=0;
  const deadlines=[];
  const days=new Map();
  const totals={income:0,transferIn:0,payments:0,transferOut:0};
  for(const item of items){
   const key=item.kind==='income'?'income':item.kind!=='transfer'?'payments':item.to===id?'transferIn':'transferOut';
   totals[key]+=item.amount;
   if(!days.has(item.date))days.set(item.date,[]);
   days.get(item.date).push(item);
  }
  if(balance!==null&&!historical)for(const [date,movements] of days){
   const out=movements.filter(item=>item.from===id);
   const cost=out.reduce((sum,item)=>sum+item.amount,0);
   // A same-day credit has no guaranteed ordering relative to a debit.
   const gap=cost ? Math.max(0,reserved+cost-balance) : 0;
   if(gap>required){
    deadlines.push({date,amount:gap-required,total:gap,items:out.map(item=>item.name)});
    required=gap;
   }
   balance=movements.reduce(change,balance);
  }
  const accountCards=cards.filter(card=>card.accountId===id);
  const unassignedCard=accountCards.some(card=>
   (card.opening||0)>card.bills.filter(bill=>bill.status!=='cancelled').reduce((sum,bill)=>sum+(bill.openingAllocation||0),0)||
   state.entries.some(entry=>!entry.void&&entry.payment===card.id&&entry.csvBilling?.status==='pending'&&
    (!entry.csvBilling.earliestMonth||entry.csvBilling.earliestMonth<=month)));
  const unresolved=related.some(row=>row.date.slice(0,7)<=month&&(row.unknown||row.review));
  const unavailableCash=ignoredCash.some(plan=>plan.date.slice(0,7)<=month&&(plan.from===id||plan.to===id))||
   cash.active.some(plan=>plan.date.slice(0,7)<=month&&(
    plan.kind==='income'&&plan.to===id&&plan.date<today||
    plan.kind==='transfer'&&(plan.from===id||plan.to===id)&&
     (!knownIds.has(plan.from)||!knownIds.has(plan.to))
   ));
  return {id,postedChange:known?posted.reduce((total,entry)=>total+entry.delta,0):null,opening:openedMidMonth?null:opening,openedMidMonth,monthEnd:historical&&opening!==null?
   opening+posted.reduce((total,entry)=>total+entry.delta,0):balance,
   reserved,totals,items,deadlines,required:!historical&&basis!==null?required:null,
   incomplete:!historical&&(unresolved||unassignedCard||unavailableCash),
   unknownPayment:items.some(item=>item.unknown),estimatedPayment:items.some(item=>(item.kind==='bill'&&item.uncertain)||item.virtual),
  };
 });
}
