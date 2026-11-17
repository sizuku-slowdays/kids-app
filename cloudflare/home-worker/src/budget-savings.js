import {shiftBillingMonth} from './budget-forecast.js';

export function savingsLegacy(state) {
 const groups = new Map();
 for (const event of state.savingsAllocations || []) {
  const group = groups.get(event.purpose) || {purpose:event.purpose, balance:0, history:[]};
  group.balance += event.amount;
  group.history.push(event);
  groups.set(event.purpose, group);
 }
 return [...groups.values()].filter(group => !(state.savingsGoals || []).some(goal => goal.legacyPurpose === group.purpose));
}

export function savingsSchedule(goal, events, asOf) {
 if (goal.status !== 'active') return [];
 const first = goal.startMonth;
 if (goal.frequency === 'irregular') {
  const confirmed = new Set(events.filter(event=>event.kind==='confirm').map(event=>event.period));
  return Object.values(goal.manualPlans||{}).filter(plan=>!confirmed.has(plan.period)).sort((a,b)=>a.date.localeCompare(b.date));
 }
 if (!first) return [];
 const last = goal.deadline?.slice(0,7) || (goal.frequency === 'once' ? first : '');
 if (!last) return [];
 const remaining = goal.target === null ? Infinity : Math.max(0, goal.target - savingsGoalBalance(goal) - debtPaid(goal, events));
 if (!remaining) return [];
 const months = [];
 const interval = goal.frequency === 'alternate' ? 2 : 1;
 const confirmed = new Set(events.filter(event => event.kind === 'confirm' && event.period).map(event => event.period));
 for (let month = first; month <= last; month = shiftBillingMonth(month, interval)) {
  if (month >= asOf.slice(0,7) && !confirmed.has(month)) months.push(month);
  if (goal.frequency === 'once') break;
 }
 const amount = goal.mode === 'manual' ? goal.amount : Number.isFinite(remaining) && months.length ? Math.ceil(remaining / months.length) : 0;
 let outstanding = remaining;
 return months.flatMap(month => {
  const [year, number] = month.split('-').map(Number);
  const date = month + '-' + String(Math.min(goal.day, new Date(Date.UTC(year,number,0)).getUTCDate())).padStart(2,'0');
  const scheduled = goal.deadline && date > goal.deadline ? goal.deadline : date;
  const value = Math.min(outstanding, amount);
  outstanding -= value;
  return value > 0 ? [{period:month,date:scheduled,amount:value}] : [];
 });
}

export const savingsGoalBalance = goal => Object.values(goal.holdings).reduce((sum, amount) => sum + amount, 0) + (goal.unassigned || 0);
export const debtPaid = (goal, events) => goal.debt ? events.reduce((sum,event) => sum + (event.principal || 0),0) : 0;

export function savingsHoldings(state) {
 const goals=(state.savingsGoals || []).filter(goal=>!goal.deleted);
 const legacy = savingsLegacy(state);
 const holdings = Object.create(null);
 for (const goal of goals) for (const [account, amount] of Object.entries(goal.holdings)) holdings[account] = (holdings[account] || 0) + amount;
 const unassigned = legacy.reduce((sum,group) => sum + Math.max(0,group.balance),0) + goals.reduce((sum,goal) => sum + (goal.unassigned || 0),0);
 const reserved = unassigned + Object.values(holdings).reduce((sum,amount) => sum + amount,0);
 return {legacy,holdings,unassigned,reserved};
}

export function savingsOverview(state, asOf) {
 const month = asOf.slice(0,7);
 const goals = (state.savingsGoals || []).filter(goal => !goal.deleted).map(goal => {
  const history = (state.savingsGoalEvents || []).filter(event => event.goalId === goal.id || event.destination === goal.id);
  const balance = savingsGoalBalance(goal);
  const principalPaid = debtPaid(goal, history);
  const remaining = goal.target === null ? null : Math.max(0,goal.target - balance - principalPaid);
  const plans = savingsSchedule(goal, history, goal.scheduleAsOf);
  const planned = plans.reduce((sum, plan) => sum + plan.amount, 0);
  return {...goal,history,balance,principalPaid,remaining,plans,displayStatus:goal.status==='active'&&remaining===0?'achieved':goal.status,onTrack:remaining === null || !goal.deadline ? null : remaining <= planned};
 });
 const {legacy,holdings,unassigned,reserved}=savingsHoldings(state);
 const plans = goals.flatMap(goal => goal.plans.map(plan => ({...plan,goalId:goal.id,name:goal.name,accountId:goal.accountId})));
 const confirmed = (state.savingsGoalEvents || []).filter(event => ['confirm','add','opening'].includes(event.kind) && event.date.slice(0,7) === month).reduce((sum,event) => sum + event.amount,0);
 const pending = plans.filter(plan => plan.period === month).reduce((sum,plan) => sum + plan.amount,0);
 const overdue = plans.filter(plan => plan.period < month).reduce((sum,plan) => sum + plan.amount,0);
 const plannedConfirmed=(state.savingsGoalEvents||[]).filter(event=>event.kind==='confirm'&&event.period===month).reduce((sum,event)=>sum+event.plannedAmount,0);
 const confirmedScheduled=(state.savingsGoalEvents||[]).filter(event=>event.kind==='confirm'&&event.period===month).reduce((sum,event)=>sum+event.amount,0);
 return {goals,legacy,holdings,unassigned,reserved,plans,confirmed,pending,overdue,plannedConfirmed,confirmedScheduled};
}

export function savingsCalendarItems(state) {
 const items = [];
 for (const goal of (state.savingsGoals || []).filter(goal => !goal.deleted)) {
  const history = (state.savingsGoalEvents || []).filter(event => event.goalId === goal.id);
  for (const plan of savingsSchedule(goal, history, goal.scheduleAsOf)) {
   items.push({key:'saving:' + goal.id + ':' + plan.period,id:goal.id,kind:'saving',date:plan.date,name:goal.name + 'の積立',amount:plan.amount,account:goal.accountId,status:'planned',description:'目的別積立'});
  }
  for (const event of history.filter(event => event.kind === 'confirm' && event.period && event.scheduledDate)) {
   items.push({key:'saving:' + goal.id + ':' + event.period,id:goal.id,kind:'saving',date:event.scheduledDate,name:goal.name + 'の積立',amount:event.amount,account:event.accountId,status:'confirmed',description:'積立確定'});
  }
  if (goal.deadline && ['active','paused'].includes(goal.status)) {
   items.push({key:'saving-deadline:' + goal.id,id:goal.id,kind:'saving',date:goal.deadline,name:goal.name + (goal.debt ? 'の返済期限' : 'の積立期限'),amount:goal.target || 0,account:goal.accountId,status:'planned',description:'目標期限'});
  }
 }
 return items;
}
