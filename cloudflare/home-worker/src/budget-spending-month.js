import {shiftBillingMonth} from './budget-forecast.js';

const benefitPattern=/児童扶養手当|児童手当/;
const salaryPattern=/給与|給料/;
const incomeType=labels=>{
 const description=labels.filter(Boolean).join(' ').normalize('NFKC');
 return benefitPattern.test(description)||labels.includes('手当')?'benefit':salaryPattern.test(description)?'salary':'other';
};
const sum=rows=>rows.reduce((total,row)=>total+row.amount,0);
const within=(date,month)=>date?.slice(0,7)===month;

export function spendingMonthSummary(state,funds,asOf,defaults=null){
 const current=asOf.slice(0,7),previous=shiftBillingMonth(current,-1),next=shiftBillingMonth(current,1);
 const rule=state.monthlyBenefit??defaults;
 const openingAccounts=state.accounts.filter(account=>account.opening!==null&&account.openingDate<=asOf);
 const managed=new Set(openingAccounts.map(account=>account.id));
 const accounts=new Map(state.accounts.map(account=>[account.id,account]));
 const entries=new Map(state.entries.map(entry=>['entry:'+entry.id,entry]));
 const transfers=new Set(state.transfers.map(transfer=>transfer.id));
 const firstDay=current+'-01';
 const opening=openingAccounts.length?openingAccounts.reduce((balance,account)=>balance+account.opening,0):null;
 const openingMovements=state.journal.filter(line=>line.scope==='account'&&managed.has(line.target)&&line.date<firstDay&&line.date<=asOf);
 const allOpening=opening===null?null:opening+openingMovements.reduce((total,line)=>total+line.delta,0);
 const actual=[];
 for(const line of state.journal){
  if(line.scope!=='account'||!managed.has(line.target)||line.date>asOf||line.date.slice(0,7)<previous)continue;
  if(transfers.has(line.source.replace(/^undo:/,'')))continue;
  const source=line.source.replace(/^undo:/,'');
  const entry=entries.get(source);
  const kind=line.reversal&&entry?.type==='income'?'adjustment':entry?.type==='income'?incomeType([entry.memo,...entry.splits.flatMap(part=>[part.category,part.middle])]):
   source.startsWith('payment:bill:')?'card':entry?accounts.get(line.target).kind==='cash'?'cash':'bank':'adjustment';
  actual.push({id:line.id,date:line.date,kind,amount:line.delta,status:'posted',name:entry?.memo||line.reason||accounts.get(line.target).name});
 }
 const plans=new Map((state.cashPlans||[]).map(plan=>[plan.id,plan]));
 const planned=funds.rows.flatMap(row=>{
  if(row.kind==='transfer'||!managed.has(row.from||row.to))return [];
  const plan=plans.get(row.id);
  const kind=row.kind==='income'?incomeType([row.name,plan?.memo,plan?.category]):
   row.kind==='bill'?'card':accounts.get(row.from).kind==='cash'?'cash':'bank';
  return [{id:row.id,date:row.date,kind,amount:row.kind==='income'?row.amount:-row.amount,
   status:'planned',name:row.name,unknown:row.unknown,uncertain:row.uncertain||row.virtual||row.overdue}];
 });
 const movements=[...actual,...planned];
 const previousSalary=actual.filter(row=>row.kind==='salary'&&within(row.date,previous));
 let carry=allOpening===null?null:allOpening-sum(previousSalary);
 let priorUncertain=openingAccounts.some(account=>account.openingDate>firstDay);
 const months=[current,next].map(month=>{
  const payrollMonth=shiftBillingMonth(month,-1);
  const salary=movements.filter(row=>row.kind==='salary'&&within(row.date,payrollMonth));
  const recorded=movements.filter(row=>within(row.date,month)&&row.kind!=='salary');
  const hasBenefit=recorded.some(row=>row.kind==='benefit') ||
   (state.cashPlans||[]).some(plan=>plan.status==='planned'&&plan.kind==='income'&&within(plan.date,month)&&
    incomeType([plan.name,plan.memo,plan.category])==='benefit') ||
   state.entries.some(entry=>!entry.void&&entry.type==='income'&&within(entry.date,month)&&
    incomeType([entry.memo,...entry.splits.flatMap(part=>[part.category,part.middle])])==='benefit');
  const benefitAmount=Number(month.slice(5))%2===0?rule?.even:rule?.odd;
  if(rule?.enabled&&benefitAmount>0&&!hasBenefit)recorded.push({kind:'benefit',amount:benefitAmount,name:'手当（自動見込）',status:'estimate'});
  const benefit=recorded.filter(row=>row.kind==='benefit'),other=recorded.filter(row=>['other','adjustment'].includes(row.kind));
  const payments=recorded.filter(row=>['bank','cash','card'].includes(row.kind));
  const totals=Object.fromEntries(['bank','cash','card'].map(kind=>[kind,-sum(payments.filter(row=>row.kind===kind))||0]));
  const remaining=carry===null?null:carry+sum(salary)+sum(benefit)+sum(other)+sum(payments);
  const benefitUnresolved=hasBenefit&&!benefit.length;
  const uncertain=priorUncertain||benefitUnresolved||!salary.length||[...salary,...recorded].some(row=>row.status!=='posted')||funds.currentUnknown;
  const result={month,payrollMonth,carry,salary:sum(salary),salaryKnown:salary.length>0,
   benefit:sum(benefit),benefitUnresolved,other:sum(other),payments:totals,remaining,uncertain,items:[...salary,...recorded]};
  carry=remaining;
  priorUncertain=uncertain;
  return result;
 });
 return {rule,months};
}
