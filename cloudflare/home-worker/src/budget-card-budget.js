import {shiftBillingMonth} from './budget-forecast.js';
import {projectAccountMonth} from './budget-account-month.js';

export const incomeDefaults = [
 {id:'salary',name:'給与',amount:220000,frequency:'monthly',receiptOffset:-1},
 {id:'child',name:'児童手当',amount:40000,frequency:'even',receiptOffset:0},
 {id:'support',name:'児童扶養手当',amount:100000,frequency:'odd',receiptOffset:0},
 {id:'maintenance',name:'養育費',amount:25000,frequency:'monthly',receiptOffset:0},
].map(row=>({...row,enabled:true,day:null,accountId:''}));
const sum=rows=>rows.reduce((n,row)=>n+row.amount,0);
const kindOf=row=>{
 const label=[row.name,row.memo,row.category,...(row.splits||[]).flatMap(p=>[p.category,p.middle])].filter(Boolean).join(' ').normalize('NFKC');
 if(/児童扶養手当/.test(label))return 'support';
 if(/児童手当/.test(label))return 'child';
 if(/養育費/.test(label))return 'maintenance';
 if(/給与|給料/.test(label))return 'salary';
 if(/手当/.test(label))return 'benefit';
 return 'other';
};
const dateFor=(month,day)=>day?month+'-'+String(Math.min(day,new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).getUTCDate())).padStart(2,'0'):null;
const applies=(rule,month)=>rule.enabled&&(rule.frequency==='monthly'||Number(month.slice(5))%2===(rule.frequency==='even'?0:1));

// Budget-only income: these rows never post a ledger entry or generate cash/calendar plans.
export function nextCardBudget(state,funds,cards,savings,asOf) {
 const current=asOf.slice(0,7),month=shiftBillingMonth(current,1);
 const configured=!!state.incomeOutlook;
 const rules=state.incomeOutlook?.rules||incomeDefaults;
 const overrides=state.incomeOutlook?.months?.[month]||{};
 const managed=new Set(state.accounts.filter(a=>a.opening!==null).map(a=>a.id));
 const actual=state.entries.filter(e=>e.type==='income'&&!e.void&&e.ledgerIncluded&&e.date<=asOf&&managed.has(e.payment));
 const pending=(state.cashPlans||[]).filter(p=>p.kind==='income'&&p.status==='planned');
 const issues=new Set(),consumedActual=new Set(),consumedPlans=new Set(),suppressedPlans=new Set();
 if(!configured)issues.add('incomeSettings');
 const incomes=[];
 for(const rule of rules){
  const override=overrides[rule.id];
  const receiptMonth=shiftBillingMonth(month,rule.receiptOffset);
  const selected={...rule,...override};
  // The two child benefits share a single slot, even when a legacy label is simply 手当.
  const benefit=['child','support'].includes(rule.id);
  if(!applies(rule,receiptMonth)||override?.enabled===false)continue;
  const candidate=row=>kindOf(row)==='other'&&row.amount===selected.amount&&(!selected.accountId||(row.payment||row.to)===selected.accountId);
  const matches=row=>(benefit?['child','support','benefit'].includes(kindOf(row)):kindOf(row)===rule.id)||candidate(row);
  const posted=actual.filter(e=>!consumedActual.has(e.id)&&e.date.slice(0,7)===receiptMonth&&matches(e));
  const plans=pending.filter(p=>!consumedPlans.has(p.id)&&p.date.slice(0,7)===receiptMonth&&matches(p));
  posted.forEach(e=>consumedActual.add(e.id));plans.forEach(p=>consumedPlans.add(p.id));
  if([...posted,...plans].some(candidate))issues.add('incomeConflict');
  if(benefit&&[...posted,...plans].some(r=>!['benefit',rule.id].includes(kindOf(r))))issues.add('benefitConflict');
  // Actual income supersedes the estimate, including when the actual amount/date differs.
  // An unresolved old plan is never added on top of the posted amount.
  let amount,date,accountId,status,sourceIds;
  if(posted.length){
   amount=sum(posted);date=posted[0].date;accountId=posted[0].payment;status='posted';sourceIds=posted.map(e=>e.id);
   if(plans.length){issues.add('incomeConflict');plans.forEach(p=>suppressedPlans.add(p.id));}
   if(benefit&&posted.length>1){issues.add('benefitConflict');amount=0;}
  }else if(plans.length){
   // Several plans for a single recurring source need review rather than an optimistic sum.
   amount=plans.length===1?plans[0].amount:0;date=plans[0].date;accountId=plans[0].to;status='planned';sourceIds=plans.map(p=>p.id);
   if(plans.length>1)issues.add(benefit?'benefitConflict':'incomeConflict');
  }else{
   amount=configured?selected.amount:0;date=override?.date||dateFor(receiptMonth,selected.day);accountId=selected.accountId;status=configured?'estimate':'unset';sourceIds=[];
   if(status==='unset')issues.add('incomeSettings');
  }
  if(!date)issues.add('incomeDate');
  if(!accountId||!managed.has(accountId))issues.add('incomeAccount');
  if(date&&date<asOf&&status!=='posted')issues.add('overdueIncome');
  const embedded=status==='posted'?sum(posted):sum((funds.rows||[]).filter(r=>r.kind==='income'&&sourceIds.includes(r.id)&&r.date.slice(0,7)<=current));
  incomes.push({id:rule.id,name:rule.name,amount,date,accountId,status,sourceIds,embedded,receiptMonth});
 }
 // Preserve ordinary explicitly registered income outside the recurring settings.
 for(const row of actual.filter(e=>e.date.slice(0,7)===month&&!consumedActual.has(e.id)))incomes.push({id:row.id,name:row.memo||'その他の収入',amount:row.amount,date:row.date,accountId:row.payment,status:'posted',sourceIds:[row.id],embedded:row.amount});
 for(const row of (funds.rows||[]).filter(r=>r.kind==='income'&&r.date.slice(0,7)===month&&!consumedPlans.has(r.id)))incomes.push({id:row.id,name:row.name,amount:row.amount,date:row.date,accountId:row.to,status:'planned',sourceIds:[row.id],embedded:0});
 const reserve=state.fundReserves?.[month];
 const currentReserve=funds.currentReserved;
 // Month-end includes pending current-month deposits; remove already-embedded budget income before showing it separately.
 const effectiveRows=(funds.rows||[]).filter(r=>!suppressedPlans.has(r.id));
 const suppressedCurrent=sum((funds.rows||[]).filter(r=>suppressedPlans.has(r.id)&&r.date.slice(0,7)<=current));
 const currentCarry=funds.monthEnd===null?null:funds.monthEnd-suppressedCurrent-(currentReserve??0)-funds.savingsReserved-funds.currentSavings;
 const embedded=sum(incomes.map(row=>({amount:row.embedded})));
 const carry=currentCarry===null?null:currentCarry-embedded;
 const totalIncome=sum(incomes),totalFunds=carry===null?null:carry+totalIncome;
 const rows=(funds.rows||[]).filter(r=>r.date.slice(0,7)===month);
 const rakutenIds=new Set(state.cards.filter(c=>['pink','visa'].includes(c.id)||/楽天|rakuten/i.test(c.name)).map(c=>c.id));
 const bills=rows.filter(r=>r.kind==='bill');
 const billIds=new Set(cards.filter(c=>rakutenIds.has(c.id)).flatMap(c=>c.bills.filter(b=>b.month===month&&b.status==='planned').map(b=>b.id)));
 const rakuten=bills.filter(r=>billIds.has(r.id));
 const registered=sum(rakuten),otherPayments=sum(rows.filter(r=>r.kind==='plan'||r.kind==='bill'&&!billIds.has(r.id)));
 const living=reserve?.living??null,goals=reserve?sum(reserve.goals||[]):null,carryReserve=reserve?.carry??null;
 const saving=sum(savings.plans.filter(p=>p.period===month));
 if(!reserve||living===null||carryReserve===null)issues.add('reserves');
 if(currentReserve===null)issues.add('currentReserves');
 if(funds.currentUnknown)issues.add('currentUnknown');
 if((funds.allowanceIssues||[]).includes('savings')||savings.unassigned>0)issues.add('savings');
 if(funds.unassigned||funds.unprojected)issues.add('unassigned');
 if(rows.some(r=>r.unknown||r.review))issues.add('payments');
 if(!rakuten.length||state.cards.filter(c=>rakutenIds.has(c.id)).some(c=>!rakuten.some(r=>billIds.has(r.id)&&cards.find(x=>x.id===c.id)?.bills.some(b=>b.id===r.id))))issues.add('card');
 if(funds.benefitConflicts.some(c=>c.month===month))issues.add('benefitConflict');
 const estimate=totalFunds===null?null:totalFunds-otherPayments-(living??0)-(goals??0)-(carryReserve??0)-saving-registered;
 const blocking=['incomeSettings','reserves','currentReserves','currentUnknown','unassigned','payments','card','incomeConflict','benefitConflict','overdueIncome','savings'];
 const usable=estimate===null||blocking.some(code=>issues.has(code))?null:Math.max(0,estimate);
 // Keep all registered transfers/outflows and include only additional forecast income once.
 // Existing account projections run from today's real balances; forecasts never update those balances.
 const supplemental=incomes.filter(i=>i.status==='estimate'&&i.date&&i.date>=asOf&&managed.has(i.accountId)).map(i=>({kind:'income',id:'income-outlook:'+i.id,name:i.name,date:i.date,amount:i.amount,to:i.accountId}));
 const balances=new Map(funds.accountForecasts.map(a=>[a.accountId,a.currentBalance]));
 const accounts=state.accounts.map(a=>({...a,balance:balances.get(a.id)??null}));
 const timeline=projectAccountMonth(state,accounts,cards,[...effectiveRows,...supplemental].sort((a,b)=>a.date.localeCompare(b.date)),savings.holdings,asOf,month);
 const timing=timeline.flatMap(account=>account.deadlines.map(deadline=>{
  const movements=account.transactions.filter(t=>t.status==='planned'&&t.date===deadline.date);
  const out=movements.filter(t=>t.delta<0),incoming=movements.filter(t=>t.delta>0).reduce((n,t)=>n+t.delta,0);
  const first=movements[0],before=first?first.balance-first.delta:account.basis;
  const payments=-out.reduce((n,t)=>n+t.delta,0);
  return {accountId:account.id,date:deadline.date,payments,income:incoming,before,balance:movements.at(-1)?.balance,shortage:deadline.amount,sameDay:incoming>0&&before<payments};
 }));
 if(timing.length)issues.add('timing');
 return {month,configured,rules,incomes,carry,currentCarry,embedded,totalIncome,totalFunds,otherPayments,living,goals,carryReserve,saving,registered,rakuten,estimate,usable,shortage:estimate===null?null:Math.max(0,-estimate),issues:[...issues],timing,tentative:true};
}
