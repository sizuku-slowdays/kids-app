export function shiftBillingMonth(month, offset) {
 const [year, number] = month.split('-').map(Number);
 return new Date(Date.UTC(year, number - 1 + offset, 1)).toISOString().slice(0, 7);
}

export function ruleCoversMonth(rule, month) {
 if (rule.firstMonth && month < rule.firstMonth) return false;
 const term = rule.term;
 if (!term || term.kind === 'ongoing') return true;
 if (month > term.endMonth) return false;
 return term.kind !== 'installments' || month >= term.firstMonth;
}

export function ruleNeedsPlan(rule, month) {
 if (!rule.enabled || !ruleCoversMonth(rule, month)) return false;
 const term = rule.term;
 return term?.kind !== 'installments' || month >= shiftBillingMonth(term.firstMonth, term.priorPaid);
}

const sum = items => items.reduce((total, item) => total + item.amount, 0);
const signedAmount = entry => ['refund','recovery','income'].includes(entry.type) ? -entry.amount : entry.amount;
const entrySignature = entry => JSON.stringify([entry.date, entry.amount, entry.type]);

export function billEvidence(state, bill, cardDue) {
 const card = state.cards.find(item => item.id === bill.cardId);
 const entries = state.entries.filter(entry => {
  if (entry.void || entry.payment !== bill.cardId || entry.csvBilling?.status === 'pending') return false;
  if (entry.ledgerIncluded) return entry.dueDate?.slice(0, 7) === bill.month;
  return state.startDate && bill.dueDate >= state.startDate && entry.csvImported &&
    entry.date < state.startDate && entry.csvBilling?.month === bill.month;
 }).map(entry => ({
  id: entry.id, date: entry.date, amount: signedAmount(entry), signature: entrySignature(entry),
  name: entry.merchant || entry.memo || 'カード利用'
 }));
 const plans = state.plans.filter(plan => plan.status === 'planned' && plan.payment === card.id &&
  cardDue(card, plan.manualDue ? plan.dueDate : plan.nominalDate, state.holidays)?.slice(0, 7) === bill.month
 ).map(plan => ({id:plan.id, name:plan.name, date:plan.manualDue ? plan.dueDate : plan.nominalDate, amount:plan.amount, version:plan.version}));
 const completed = state.plans.filter(plan => plan.status === 'confirmed' && plan.payment === card.id && plan.entryId);
 return {entries, plans, completed};
}

export function projectBill(bill, evidence, legacy) {
 const snapshot = bill.appEstimate;
 const known = new Map((snapshot?.known || []).map(row => [row.id,row.signature]));
 const decisions = new Map((snapshot?.decisions || []).map(row => [row.id, row]));
 const future = new Map((snapshot?.future || []).map(row => [row.id, row]));
 const inherited = new Set(evidence.completed.filter(plan => {
  const choice = future.get(plan.id);
  return choice?.coverage === 'extra' && plan.version === choice.version + 1;
 }).map(plan => plan.entryId));
 const entries = evidence.entries.map(entry => {
  const decision = decisions.get(entry.id);
  return {...entry, addedSinceSnapshot:!!snapshot && !known.has(entry.id), coverage: decision?.signature === entry.signature ? decision.coverage : inherited.has(entry.id) ? 'extra' : 'review'};
 });
 const plans = evidence.plans.map(plan => {
  const choice = future.get(plan.id);
  // Keep an already linked fixed cost out of the recurring forecast even if its plan changes.
  const reviewed = choice?.version === plan.version && (!choice.linkedEntryId ||
   entries.some(entry => entry.id === choice.linkedEntryId && entry.signature === choice.linkedSignature));
  return {...plan, reviewed, add:reviewed && choice.coverage === 'extra'};
 });
 const separate = sum(entries.filter(entry => entry.coverage === 'extra'));
 const recurring = sum(plans.filter(plan => plan.add));
 const included = sum(entries.filter(entry => entry.coverage === 'included'));
 const useAmount = snapshot ? Math.max(0,snapshot.amount + separate) : Math.max(0,legacy - sum(evidence.plans));
 const projected = bill.actual ?? Math.max(0, snapshot ? snapshot.amount + separate + recurring : legacy);
 const recurringContribution = bill.actual == null ? Math.max(0,projected-useAmount) : 0;
 return {
  projected, entries, plans, separate, recurring, recurringContribution, included, registered:sum(entries),
  review:!!snapshot && (entries.some(entry => entry.coverage === 'review') || plans.some(plan => !plan.reviewed)),
  uncertain:bill.actual == null,
  unknown:bill.actual == null && !snapshot && legacy <= 0,
 };
}

export function installmentProgress(state, rule) {
 const term = rule.term;
 if (term?.kind !== 'installments') return null;
 const entries = new Map(state.entries.filter(entry => !entry.void).map(entry => [entry.id,entry]));
 const plans = new Map(state.plans.filter(plan => plan.ruleId === rule.id).map(plan => [plan.month,plan]));
 const paidBills = new Set(state.bills.filter(bill => bill.status === 'confirmed').map(bill => bill.cardId+':'+bill.month));
 const firstUnpaid = shiftBillingMonth(term.firstMonth, term.priorPaid);
 let paid = term.priorPaid, remaining = 0, skipped = 0, projected = 0, defaultAmount = rule.amount;
 for (let month = term.firstMonth; month <= term.endMonth; month = shiftBillingMonth(month, 1)) {
  const plan = plans.get(month);
  if (rule.variable && plan && plan.status !== 'cancelled') defaultAmount = plan.amount;
  if (month < firstUnpaid) continue;
  const entry = entries.get(plan?.entryId) || (plan?.recordedEntryId && state.entries.find(item => !item.void && (item.id===plan.recordedEntryId || item.legacyIds?.includes(plan.recordedEntryId))));
  const card = entry && state.cards.some(item => item.id === entry.payment);
  if (entry && (
   plan.status === 'confirmed' && (!card || paidBills.has(entry.payment+':'+entry.dueDate?.slice(0,7))) ||
   plan.status === 'excluded' && (!card || paidBills.has(entry.payment+':'+(entry.dueDate?.slice(0,7) || entry.csvBilling?.month)))
  )) paid++;
  else if (plan?.status === 'cancelled') skipped++;
  else {
   remaining++;
   projected += plan?.amount ?? defaultAmount;
  }
 }
 return {paid, remaining, projected, skipped};
}

const incomeKey = (account, date, amount) => JSON.stringify([account,date,amount]);
const transferKey = plan => JSON.stringify([plan.from,plan.to,plan.date,plan.amount]);

const benefitName = name => (name || '').normalize('NFKC').match(/児童扶養手当|児童手当/)?.[0];

export function plannedCashFlows(state, asOf) {
 const actualIncome=state.entries.filter(entry=>entry.type==='income'&&entry.ledgerIncluded&&!entry.void&&entry.date<=asOf);
 const actualBenefits=new Map(),postedIncome=new Map();
 for(const entry of actualIncome){
  const key=incomeKey(entry.payment,entry.date,entry.amount);
  if(!postedIncome.has(key))postedIncome.set(key,[]);
  postedIncome.get(key).push(entry);
  const benefit=benefitName(entry.memo)||entry.splits?.map(part=>benefitName(part.category)||benefitName(part.middle)).find(Boolean);
  if(!benefit)continue;
  const month=entry.date.slice(0,7);
  if(!actualBenefits.has(month))actualBenefits.set(month,new Set());
  actualBenefits.get(month).add(benefit);
 }
 const duplicatePostedIncome=[...postedIncome.values()].filter(entries=>entries.length>1)
  .map(entries=>({date:entries[0].date,accountId:entries[0].payment,amount:entries[0].amount}));
 const paidBenefitConflicts=[...actualBenefits].filter(([,names])=>names.size>1).map(([month])=>month);
 const postedTransfers=new Set(state.transfers.filter(transfer=>!transfer.void&&transfer.date<=asOf).map(transferKey));
 const incomePlans=new Map();
 const benefits = new Map();
 const pending = (state.cashPlans || []).filter(plan => plan.status === 'planned');
 for (const plan of pending) {
  if (plan.kind !== 'income') continue;
  const key=incomeKey(plan.to,plan.date,plan.amount);
  if(!incomePlans.has(key))incomePlans.set(key,[]);
  incomePlans.get(key).push(plan);
  if (!benefitName(plan.name) && !benefitName(plan.memo) && !benefitName(plan.category)) continue;
  const month = plan.date.slice(0,7);
  if (!benefits.has(month)) benefits.set(month,[]);
  benefits.get(month).push(plan);
 }
 const conflicts = [...benefits].filter(([month,plans]) => actualBenefits.has(month) || plans.length > 1);
 const duplicateIncome=[...incomePlans].flatMap(([key,plans])=>postedIncome.has(key)||plans.length>1?plans:[]);
 const duplicateTransfers=pending.filter(plan=>plan.kind==='transfer'&&postedTransfers.has(transferKey(plan)));
 const excluded = new Set([...conflicts.flatMap(([,plans]) => plans),...duplicateIncome,...duplicateTransfers].map(plan=>plan.id));
 return {active:pending.filter(plan => !excluded.has(plan.id)),
  duplicateIncome,duplicateTransfers,duplicatePostedIncome,paidBenefitConflicts,conflicts:conflicts.map(([month,plans]) => ({month,ids:plans.map(plan => plan.id)}))};
}

function possiblePaymentDuplicates(state, asOf, month, rows) {
 const posted=state.entries.filter(entry=>!entry.void&&entry.ledgerIncluded&&entry.date<=asOf);
 const byAccountDateAmount=new Map();
 for(const entry of posted){
  if(entry.type!=='expense')continue;
  const key=incomeKey(entry.payment,entry.date,entry.amount);
  if(!byAccountDateAmount.has(key))byAccountDateAmount.set(key,[]);
  byAccountDateAmount.get(key).push(entry);
 }
 const fixed=rows.filter(row=>row.kind==='plan'&&row.date.slice(0,7)<=month&&
  byAccountDateAmount.has(incomeKey(row.from,row.originalDate||row.date,row.amount)));
 const csv=[...byAccountDateAmount.values()].filter(entries=>entries.some(entry=>entry.csvImported)&&
  entries.some(entry=>!entry.csvImported)&&entries.some(entry=>!entry.dueDate||entry.dueDate.slice(0,7)<=month))
  .map(entries=>({date:entries[0].date,accountId:entries[0].payment,amount:entries[0].amount}));
 return {fixed,csv};
}

function projectAccounts(accounts, rows, current, committedOnly = false) {
 const results = new Map(accounts.filter(account => account.balance !== null).map(account =>
  [account.id,{accountId:account.id,currentBalance:account.balance,balance:account.balance,days:[]}]));
 const dates = new Map();
 for (const row of rows) {
  if (!dates.has(row.date)) dates.set(row.date,[]);
  dates.get(row.date).push(row);
 }
 for (const [date, movements] of dates) {
  const affected = new Map();
  function day(accountId) {
   const result = results.get(accountId);
   if (!result) return null;
   if (!affected.has(accountId)) affected.set(accountId,{
    date,before:result.balance,plannedIncome:0,transferIn:0,transferOut:0,payments:0,
    sameDay:false,uncertain:false,unknown:false,items:[]
   });
   return affected.get(accountId);
  }
  for (const row of movements) {
   const out = day(row.from), incoming = day(row.to);
   if (out) {
    if (row.kind === 'transfer') out.transferOut += row.amount;
    else out.payments += row.amount;
    out.unknown ||= !!row.unknown;
    out.uncertain ||= !!(row.uncertain || row.virtual || row.review || row.overdue || row.kind==='transfer');
    out.items.push(row);
   }
   if (incoming) {
    if (!committedOnly) {
     if (row.kind === 'income') incoming.plannedIncome += row.amount;
     else incoming.transferIn += row.amount;
    }
    incoming.uncertain=true;
    incoming.items.push(row);
   }
  }
  for (const [accountId, item] of affected) {
   const result = results.get(accountId), inflows = item.plannedIncome + item.transferIn;
   const outflows = item.transferOut + item.payments;
   result.balance = item.before + inflows - outflows;
   item.sameDay = inflows > 0 && outflows > 0 && item.before < outflows;
   item.balance = result.balance;
   item.shortage = Math.max(0,-item.balance);
   result.days.push(item);
  }
 }
 return [...results.values()].map(result => {
  const currentDays = result.days.filter(day => day.date.slice(0,7)<=current);
  const later = result.days.filter(day => day.date.slice(0,7)>current);
  let required = 0;
  const needs = currentDays.flatMap(day => {
   if (day.shortage <= required || !day.items.some(item => item.from===result.accountId)) return [];
   const additional = day.shortage - required;
   required = day.shortage;
   return [{date:day.date,additional,total:required}];
  });
  const futurePeak = later.reduce((best,day) => day.shortage > (best?.shortage||0) ? day : best,null);
  const monthlyPeaks = new Map();
  for (const day of later) {
   const month=day.date.slice(0,7);
   if(day.shortage>(monthlyPeaks.get(month)?.shortage||0)) monthlyPeaks.set(month,day);
  }
  let funded=required;
  const futureMonths=[...monthlyPeaks].map(([month,day])=>{
   const additional=Math.max(0,day.shortage-funded);
   funded+=additional;
   return {month,date:day.date,amount:day.shortage,additional};
  });
  return {accountId:result.accountId,currentBalance:result.currentBalance,currentDays,
   monthEnd:currentDays.at(-1)?.balance ?? result.currentBalance,needs,required,futureMonths,
   future:futurePeak && {date:futurePeak.date,amount:futurePeak.shortage,
    additional:Math.max(0,futurePeak.shortage-required)}};
 });
}

export function forecastFunds(state, accounts, cards, asOf, missing, availablePlans = state.plans, savings = {holdings:{},plans:[],reserved:0,unassigned:0}, through = asOf.slice(0,7)) {
 const current = asOf.slice(0,7), next = shiftBillingMonth(current,1);
 const rows = [];
 for (const plan of availablePlans) {
  if (plan.status !== 'planned' || !state.accounts.some(account => account.id === plan.payment)) continue;
  rows.push({kind:'plan',id:plan.id,name:plan.name,date:plan.dueDate,amount:plan.amount,from:plan.payment,virtual:!!plan.virtual});
 }
 for (const card of cards) for (const bill of card.bills) {
  if (bill.status !== 'planned') continue;
  rows.push({kind:'bill',id:bill.id,name:card.name,date:bill.dueDate,amount:bill.projected,from:card.accountId,
   uncertain:bill.forecast.uncertain,unknown:bill.forecast.unknown,review:bill.forecast.review,
   futureRecurring:bill.forecast.recurringContribution,
   virtual:!!bill.virtual});
 }
 const horizon = rows.reduce((month, row) => row.date.slice(0,7) > month ? row.date.slice(0,7) : month, through>next?through:next);
 const cash = plannedCashFlows(state,asOf);
 const managed = new Map(accounts.filter(account => account.balance !== null).map(account => [account.id,account.balance]));
 const untrackedTransfers=[];
 const overdueIncome = [];
 for (const plan of cash.active) {
  if (plan.date.slice(0,7)>horizon) continue;
  if(plan.kind==='transfer'&&(!managed.has(plan.from)||!managed.has(plan.to))){
   untrackedTransfers.push(plan);
   continue;
  }
  if (plan.date<asOf && plan.kind==='income') { overdueIncome.push(plan);continue; }
  // Overdue outflows are still reserved. An overdue transfer is kept whole, with a warning.
  rows.push({kind:plan.kind,id:plan.id,name:plan.name,amount:plan.amount,from:plan.from,to:plan.to,
   date:plan.date<asOf?asOf:plan.date,originalDate:plan.date,overdue:plan.date<asOf});
 }
 for (const row of rows) if(row.date<asOf){
  row.originalDate=row.date;row.overdue=true;row.date=asOf;
 }
 rows.sort((a,b) => a.date.localeCompare(b.date));
 const currentAssets = managed.size ? [...managed.values()].reduce((total, amount) => total+amount,0) : null;
 const accountForecasts = projectAccounts(accounts,rows,current);
 const withoutPending = new Map(projectAccounts(accounts,rows,current,true).map(account=>[account.accountId,account]));
 for (const account of accountForecasts) {
  const confirmed = withoutPending.get(account.accountId);
  const days = new Map(confirmed.currentDays.map(day=>[day.date,day.balance]));
  for (const day of account.currentDays) {
   day.withoutPending = days.get(day.date) ?? day.balance;
  }
  account.requiredWithoutPending = confirmed.required;
 }
 const monthEndTotals={plannedIncome:0,transferIn:0,transferOut:0,payments:0};
 for(const account of accountForecasts)for(const day of account.currentDays){
  for(const key of Object.keys(monthEndTotals))monthEndTotals[key]+=day[key];
 }
 const monthEnd = currentAssets === null ? null : currentAssets + monthEndTotals.plannedIncome +
  monthEndTotals.transferIn - monthEndTotals.transferOut - monthEndTotals.payments;
 const withdrawals=rows.filter(row=>row.kind==='bill'||row.kind==='plan');
 const cardTotal = sum(withdrawals.filter(row => row.kind === 'bill'));
 const recurring = withdrawals.reduce((total,row) => total + (row.futureRecurring || 0),0);
 const confirmed = sum(withdrawals.filter(row => row.kind === 'bill' && !row.uncertain));
 const income = sum(rows.filter(row => row.kind === 'income' && managed.has(row.to)));
 const missingAccount = untrackedTransfers.length>0 || rows.some(row => row.from && !managed.has(row.from) || row.to && !managed.has(row.to));
 const pendingEntries=state.entries.filter(entry=>!entry.void&&entry.csvBilling?.status==='pending'&&
  (entry.ledgerIncluded||entry.csvImported&&state.startDate));
 const openingUnassigned=cards.some(card => (card.opening || 0) > card.bills.filter(bill => bill.status !== 'cancelled').reduce((total,bill) => total + (bill.openingAllocation || 0),0));
 const unassigned=openingUnassigned||pendingEntries.length>0;
 const unmappedPlans=state.plans.filter(plan => plan.status === 'planned' &&
  !state.accounts.some(account => account.id === plan.payment) &&
  !cards.some(card => card.id === plan.payment && card.accountId && card.closingDay && card.paymentDay));
 const unprojectedMonths=state.entries.flatMap(entry => {
  if (entry.void) return [];
  const card = cards.find(item => item.id === entry.payment);
  if (!card) return [];
  const month = entry.ledgerIncluded ? entry.dueDate?.slice(0,7) :
    entry.csvImported && state.startDate && entry.csvBilling?.month >= state.startDate.slice(0,7) ? entry.csvBilling.month : null;
  return month && !card.bills.some(bill => bill.month === month && bill.status !== 'cancelled') ? [month] : [];
 });
 const unprojected=unmappedPlans.length>0||unprojectedMonths.length>0;
 const currentRows=rows.filter(row=>row.date.slice(0,7)<=current);
 const paymentDuplicates=possiblePaymentDuplicates(state,asOf,current,rows);
 const currentUnknown=missing||openingUnassigned||pendingEntries.some(entry=>!entry.csvBilling.earliestMonth||entry.csvBilling.earliestMonth<=current)||
  unmappedPlans.some(plan=>plan.dueDate.slice(0,7)<=current)||unprojectedMonths.some(month=>month<=current)||
  currentRows.some(row=>row.unknown||row.from&&!managed.has(row.from)||row.to&&!managed.has(row.to))||
  cash.conflicts.some(conflict=>conflict.month<=current)||overdueIncome.length>0||
  paymentDuplicates.fixed.length>0||paymentDuplicates.csv.length>0||
  cash.duplicatePostedIncome.some(entry=>entry.date.slice(0,7)===current)||cash.paidBenefitConflicts.includes(current)||
  [...cash.duplicateIncome,...cash.duplicateTransfers].some(plan=>plan.date.slice(0,7)<=current)||untrackedTransfers.some(plan=>plan.date.slice(0,7)<=current);
 const unknown = rows.some(row => row.unknown) || missing || missingAccount || unassigned || unprojected;
 const reserves = state.fundReserves?.[current] ?? null;
 const reserved = reserves ? reserves.living + sum(reserves.goals) : null;
 const savingsPlans=savings.plans.filter(plan=>plan.period<=horizon);
 const currentSavings=sum(savingsPlans.filter(plan=>plan.period<=current));
 const futureSavings=sum(savingsPlans);
 const savingsNameConflict=reserves?.goals.some(reserve=>savings.goals?.some(goal=>goal.name===reserve.name)||savings.legacy?.some(group=>group.purpose===reserve.name));
 const available = currentAssets === null || reserved === null || unknown || savingsNameConflict ? null : currentAssets - sum(withdrawals) - reserved - savings.reserved - futureSavings;
 // Keep the previous field available to clients with an older cached bundle.
 const shortfalls = accountForecasts.flatMap(account => {
  if(account.future?.amount>account.required)return [{accountId:account.accountId,date:account.future.date,amount:account.future.amount}];
  if(!account.required)return [];
  return [{accountId:account.accountId,date:account.needs.at(-1).date,amount:account.required}];
 });
 const currentPayments = sum(withdrawals.filter(row=>row.date.slice(0,7)<=current));
 const fundingGap=accountForecasts.some(account=>account.currentBalance<0||account.requiredWithoutPending>0);
 const savingsRows=savingsPlans.filter(plan=>plan.accountId&&managed.has(plan.accountId)).map(plan=>({kind:'plan',from:plan.accountId,amount:plan.amount,date:plan.date<asOf?asOf:plan.date}));
 const afterSavings=projectAccounts(accounts.map(account=>({...account,balance:account.balance===null?null:account.balance-(savings.holdings[account.id]||0)})),[...rows,...savingsRows].sort((a,b)=>a.date.localeCompare(b.date)),current,true);
 const savingsIssue=savings.unassigned>0||savingsNameConflict||
  savingsPlans.some(plan=>plan.period<=current&&(!plan.accountId||!managed.has(plan.accountId)))||
  (savings.reserved>0||currentSavings>0)&&afterSavings.some(account=>account.currentBalance<0||account.required>0);
 const allowanceIssues=[
  ...(!reserves?['reserves']:[]),
  ...(currentAssets===null||currentUnknown?['month']:[]),
  ...(currentRows.some(row=>row.kind==='bill'&&(row.uncertain||row.unknown))?['currentCard']:[]),
  ...(fundingGap?['funding']:[]),
  ...(savingsIssue?['savings']:[]),
 ];
 const currentAllowance = allowanceIssues.length?null:Math.max(0,currentAssets-currentPayments-reserved-savings.reserved-currentSavings);
 const currentAllowanceEstimate = currentAssets===null?null:currentAssets-currentPayments-(reserved??0)-savings.reserved-currentSavings;
 const cardAllowance = available===null||currentAllowance===null||
  rows.some(row=>row.review&&row.uncertain)?null:Math.max(0,Math.min(available,currentAllowance));
 return {currentSavings,futureSavings,savingsReserved:savings.reserved,currentAssets,monthEnd,monthEndTotals,available,reserves,horizon,income,unknown,missingAccount,unassigned,unprojected,
  tentative:unknown || rows.some(row => row.uncertain || row.virtual),
  monthTentative:currentUnknown || currentRows.some(row => row.kind==='income'||row.kind==='transfer'||row.uncertain||row.virtual||row.review),
  currentUnknown,accountForecasts,cardAllowance,currentAllowance,currentAllowanceEstimate,currentPayments,currentReserved:reserved,allowanceIssues,benefitConflicts:cash.conflicts,duplicateIncome:cash.duplicateIncome,duplicateTransfers:cash.duplicateTransfers,duplicatePostedIncome:cash.duplicatePostedIncome,paidBenefitConflicts:cash.paidBenefitConflicts,paymentDuplicates,untrackedTransfers,overdueIncome,
  confirmed,estimated:cardTotal-confirmed-recurring,recurring,other:sum(withdrawals)-cardTotal,rows,shortfalls};
}
