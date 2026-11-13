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

export function forecastFunds(state, accounts, cards, asOf, missing, availablePlans = state.plans) {
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
 const horizon = rows.reduce((month, row) => row.date.slice(0,7) > month ? row.date.slice(0,7) : month, next);
 for (const plan of state.cashPlans || []) {
  if (plan.status !== 'planned' || plan.date.slice(0,7) > horizon) continue;
  rows.push({kind:plan.kind,id:plan.id,name:plan.name,date:plan.date,amount:plan.amount,from:plan.from,to:plan.to});
 }
 rows.sort((a,b) => a.date.localeCompare(b.date) || Number(!!a.to && !a.from) - Number(!!b.to && !b.from));
 const managed = new Map(accounts.filter(account => account.balance !== null).map(account => [account.id,account.balance]));
 const balance = new Map(managed);
 const currentAssets = managed.size ? [...managed.values()].reduce((total, amount) => total+amount,0) : null;
 const shortfalls = new Map();
 let monthEnd = currentAssets;
 for (const row of rows) {
  const from = managed.has(row.from), to = managed.has(row.to);
  if (row.date.slice(0,7) <= current && monthEnd !== null) monthEnd += (to ? row.amount : 0) - (from ? row.amount : 0);
  if (from) {
   balance.set(row.from,balance.get(row.from)-row.amount);
   const shortage = -balance.get(row.from);
   if (shortage > (shortfalls.get(row.from)?.amount || 0)) shortfalls.set(row.from,{accountId:row.from,amount:shortage,date:row.date});
  }
  if (to) balance.set(row.to,balance.get(row.to)+row.amount);
 }
 const withdrawals = rows.filter(row => row.kind === 'bill' || row.kind === 'plan' || row.kind === 'transfer' && managed.has(row.from) && !managed.has(row.to));
 const cardTotal = sum(withdrawals.filter(row => row.kind === 'bill'));
 const recurring = withdrawals.reduce((total,row) => total + (row.futureRecurring || 0),0);
 const confirmed = sum(withdrawals.filter(row => row.kind === 'bill' && !row.uncertain));
 const income = sum(rows.filter(row => row.kind === 'income' && managed.has(row.to)));
 const missingAccount = rows.some(row => row.from && !managed.has(row.from) || row.to && !managed.has(row.to));
 const unassigned = state.entries.some(entry => !entry.void && entry.csvBilling?.status === 'pending' && (entry.ledgerIncluded || entry.csvImported && state.startDate)) ||
  cards.some(card => (card.opening || 0) > card.bills.filter(bill => bill.status !== 'cancelled').reduce((total,bill) => total + (bill.openingAllocation || 0),0));
 const unprojected = state.plans.some(plan => plan.status === 'planned' &&
  !state.accounts.some(account => account.id === plan.payment) &&
  !cards.some(card => card.id === plan.payment && card.accountId && card.closingDay && card.paymentDay)) ||
  state.entries.some(entry => {
  if (entry.void) return false;
  const card = cards.find(item => item.id === entry.payment);
  if (!card) return false;
  const month = entry.ledgerIncluded ? entry.dueDate?.slice(0,7) :
    entry.csvImported && state.startDate && entry.csvBilling?.month >= state.startDate.slice(0,7) ? entry.csvBilling.month : null;
  return month && !card.bills.some(bill => bill.month === month && bill.status !== 'cancelled');
 });
 const unknown = rows.some(row => row.unknown) || missing || missingAccount || unassigned || unprojected;
 const reserves = state.fundReserves?.[current] ?? null;
 const reserved = reserves ? reserves.living + sum(reserves.goals) : null;
 const available = currentAssets === null || reserved === null || unknown ? null : currentAssets - sum(withdrawals) - reserved;
 return {currentAssets,monthEnd,available,reserves,horizon,income,unknown,missingAccount,unassigned,unprojected,
  tentative:unknown || rows.some(row => row.uncertain || row.virtual),
  monthTentative:missing || missingAccount || unassigned || unprojected || rows.some(row => row.date.slice(0,7)<=current && (row.uncertain || row.virtual)),
  confirmed,estimated:cardTotal-confirmed-recurring,recurring,other:sum(withdrawals)-cardTotal,rows,shortfalls:[...shortfalls.values()]};
}
