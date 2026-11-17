import {savingsLegacy,savingsSchedule,savingsHoldings,savingsOverview,savingsGoalBalance,debtPaid} from './budget-savings.js';
import {spendingMonthSummary} from './budget-spending-month.js';
import {shiftBillingMonth,ruleNeedsPlan,ruleCoversMonth,billEvidence,projectBill,installmentProgress,forecastFunds,plannedCashFlows} from './budget-forecast.js';
import {budgetPeople, migrateClassification, outstandingAdvance, savingsKinds, spendingKinds} from './budget-classification.js';
import {importFixedRules,importCardRows,assignCardBilling} from './budget-imports.js';
import {dailySpending} from '../public/apps/household-budget/daily-spending.js';

// Pure, integer-yen ledger. No I/O, clock, credentials or cross-user identifiers.
export class BudgetError extends Error {constructor(message,status=400){super(message);this.status=status;}}
const fail=(ok,message,status=400)=>{if(!ok)throw new BudgetError(message,status);};
const clone=x=>structuredClone(x),MAX=1000000000000;
export function yenAmount(n,signed=false){fail(Number.isSafeInteger(n)&&Math.abs(n)<=MAX&&(signed||n>=0),'金額は整数の円で入力してください');return n;}
export function day(value){fail(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value,'日付を確認してください');return value;}
const text=(s,max=200)=>{fail(typeof s==='string'&&s.length<=max,'文字数・入力形式を確認してください');return s.trim();};
const id=s=>{s=text(s,120);fail(/^[\w:.-]{1,120}$/.test(s),'登録番号を確認してください');return s;};
const find=(list,key)=>{const row=list.find(x=>x.id===key);fail(row,'対象が見つかりません',404);return row;};
export function monthDate(month,date){fail(/^\d{4}-\d{2}$/.test(month),'対象月を確認してください');const [y,m]=month.split('-').map(Number);fail(y>=2000&&y<=2100&&m>=1&&m<=12,'対象月を確認してください');fail(Number.isInteger(date)&&date>=1&&date<=31,'毎月の日を確認してください');return month+'-'+String(Math.min(date,new Date(Date.UTC(y,m,0)).getUTCDate())).padStart(2,'0');}
export function monthShift(month,offset){monthDate(month,1);fail(Number.isInteger(offset)&&Math.abs(offset)<=24,'月の指定を確認してください');const [y,m]=month.split('-').map(Number);return new Date(Date.UTC(y,m-1+offset,1)).toISOString().slice(0,7);}
export function businessDate(date,holidays=[]){day(date);for(let i=0;i<40;i++){const d=new Date(date+'T00:00:00Z'),w=d.getUTCDay(),md=date.slice(5);if(w!==0&&w!==6&&!['12-31','01-01','01-02','01-03'].includes(md)&&!holidays.includes(date))return date;d.setUTCDate(d.getUTCDate()+1);date=d.toISOString().slice(0,10);}throw new BudgetError('銀行休日の設定を確認してください');}
export function cardDue(card,date,holidays=[]){if(!card.accountId||!card.closingDay||!card.paymentDay)return null;const cycle=date.slice(0,7),closing=monthDate(cycle,card.closingDay),closeMonth=date>closing?monthShift(cycle,1):cycle;return businessDate(monthDate(monthShift(closeMonth,card.monthOffset),card.paymentDay),holidays);}
const categories=['その他','食費','おやつ','日用品','医療費','祖母・医療費','祖母・利用分','子ども','学校','習い事','ゲーム・娯楽','宝くじ','美容','犬','交通・ガソリン','外食','仕事立替','通信・サブスク','車・ローン','生活費','特別費','被服・美容','ペット'];
export function newBudget(){return {version:1,startDate:null,accounts:['楽天銀行','ゆうちょ','福岡銀行','auじぶん銀行','福岡中央銀行','現金'].map((name,i)=>({id:i===5?'cash':'bank-'+i,name,kind:i===5?'cash':'bank',opening:null,openingDate:null})),cards:[{id:'pink',name:'楽天PINK',accountId:null,closingDay:null,paymentDay:null,monthOffset:1,opening:null},{id:'visa',name:'楽天VISA',accountId:null,closingDay:null,paymentDay:null,monthOffset:1,opening:null}],entries:[],journal:[],rules:[],plans:[],bills:[],adjustments:[],transfers:[],categories:{tree:Object.fromEntries(categories.map(c=>[c,{}])),hidden:[]},holidays:[],preferences:{payment:'pink'},legacy:null,importIssues:[],importHash:null};}
function checkSplit(parts,total){fail(Array.isArray(parts)&&parts.length>0&&parts.length<=50,'内訳を確認してください');let sum=0;const cleaned=parts.map(p=>{const amount=yenAmount(p.amount);fail(amount>0,'内訳は1円以上で入力してください');sum+=amount;return {amount,category:text(p.category||'その他',100),middle:text(p.middle||p.categoryMiddle||'',100),small:text(p.small||p.categorySmall||'',100),person:text(p.person||'',100),...p.originalClassification&&{originalClassification:clone(p.originalClassification)},nature:text(p.nature||p.expenseNature||'必要',100)};});fail(sum===total,'内訳の合計を取引総額と一致させてください');return cleaned;}
function cleanEntry(raw,now){const amount=yenAmount(raw.amount);fail(amount>0,'金額は1円以上で入力してください');const type=raw.type||'expense';fail(['expense','income','advance','recovery','refund'].includes(type),'取引種別を確認してください');const date=day(raw.date);fail(date<=now,'未来の取引は予定として登録してください');const counterparty=text(raw.counterparty||'',100);if(type==='advance'||type==='recovery')fail(counterparty,'立替の相手を入力してください');return {id:id(raw.id),date,type,amount,payment:id(raw.payment),splits:checkSplit(raw.splits||[{amount,category:raw.category||'その他',middle:raw.middle,person:raw.person||''}],amount),memo:text(raw.memo||'',2000),...(raw.purchase!==undefined&&{purchase:text(raw.purchase,500)}),
 ...(raw.merchant&&{merchant:(text(raw.merchant,500),raw.merchant)}),
 ...(raw.spendingKind!==undefined&&{spendingKind:spendingKinds.includes(raw.spendingKind)?raw.spendingKind:''}),
 ...(raw.savingsKind!==undefined&&{savingsKind:savingsKinds.includes(raw.savingsKind)?raw.savingsKind:''}),
 counterparty,linkedAdvanceId:text(raw.linkedAdvanceId||'',120),settleMonth:(monthDate(raw.settleMonth||date.slice(0,7),1),raw.settleMonth||date.slice(0,7)),void:false,ledgerIncluded:false,legacyIds:[]};}
function emit(s,source,date,scope,target,delta,reason=''){yenAmount(delta,true);s.journal.push({id:source+':'+s.journal.length,source,date,scope,target,delta,reason});}
function undoSource(s,source,date,reason){const originals=s.journal.filter(j=>j.source===source&&!j.reversal&&!s.journal.some(r=>r.reversal===j.id));for(const j of originals){const reverse={...j,id:source+':undo:'+s.journal.length,source:'undo:'+source,date,delta:-j.delta,reversal:j.id,reason};s.journal.push(reverse);}}
function postEntry(s,e,now){if(!e.ledgerIncluded)return;fail(s.startDate&&e.date>=s.startDate,'開始日より前の取引は残高へ反映できません');const card=s.cards.find(c=>c.id===e.payment),sign=['income','recovery','refund'].includes(e.type)?1:-1;if(card){fail(!['income','recovery'].includes(e.type),'カードの入金は返金・調整として登録してください');fail(card.opening!==null,'カードの開始時未払金を設定してください');e.dueDate=cardDue(card,e.date,s.holidays);fail(e.dueDate,'カードの締め日・支払日・引落口座を設定してください');if(e.csvBilling?.status==='pending')e.dueDate=null;else if(e.csvBilling?.status==='confirmed')e.dueDate=businessDate(monthDate(e.csvBilling.month,card.paymentDay),s.holidays);emit(s,'entry:'+e.id,e.date,'card',card.id,-sign*e.amount);}else{const a=find(s.accounts,e.payment);fail(a.opening!==null&&e.date>=a.openingDate,'この口座の開始日・開始残高を設定してください');emit(s,'entry:'+e.id,e.date,'account',a.id,sign*e.amount);} }
function validateSavings(s,e){
 if(e.savingsKind==='カード投資積立')fail(['expense','refund'].includes(e.type)&&s.cards.some(c=>c.id===e.payment)&&e.splits.every(p=>p.category==='貯金・積立'),'カード投資積立は、カード払いの貯金・積立明細に設定してください');
}
function activeEntry(s,e,now,include){validateSavings(s,e);e.ledgerIncluded=!!include;postEntry(s,e,now);s.entries.push(e);return e;}
function billExpected(s,b){return s.entries.filter(e=>!e.void&&e.ledgerIncluded&&e.payment===b.cardId&&e.dueDate?.slice(0,7)===b.month).reduce((a,e)=>a+(['refund','recovery','income'].includes(e.type)?-e.amount:e.amount),0)+(b.openingAllocation||0);}
// Opening allocations can already include the same pre-start card charges.
function historicalCardForecast(s,b){
 if(!s.startDate||b.status!=='planned'||b.dueDate<s.startDate)return 0;
 const amount=s.entries.filter(e=>!e.void&&!e.ledgerIncluded&&e.csvImported&&e.payment===b.cardId&&e.date<s.startDate&&e.csvBilling?.status==='confirmed'&&e.csvBilling.month===b.month).reduce((sum,e)=>sum+(e.type==='refund'?-e.amount:e.amount),0);
 return Math.max(0,amount-(b.openingAllocation||0));
}
function pendingCardCharges(s,b){const card=find(s.cards,b.cardId);return s.plans.filter(p=>p.status==='planned'&&p.payment===card.id&&cardDue(card,p.nominalDate,s.holidays)?.slice(0,7)===b.month).reduce((n,p)=>n+p.amount,0);}
function missingMonthlyItems(s,month){
 const fixed=s.rules.filter(r=>ruleNeedsPlan(r,month)&&!s.plans.some(p=>p.ruleId===r.id&&p.month===month||p.id==='fixed:'+r.id+':'+month));
 const cards=s.cards.filter(c=>c.accountId&&c.paymentDay&&!s.bills.some(b=>b.cardId===c.id&&b.month===month||b.id==='bill:'+c.id+':'+month));
 return {fixed,cards};
}
function monthlyScheduleStatus(s,month){
 const {fixed,cards}=missingMonthlyItems(s,month);
 return {missingFixed:fixed.map(r=>r.name),missingCards:cards.map(c=>c.name),
  cancelled:s.plans.filter(p=>p.month===month&&p.status==='cancelled').length+s.bills.filter(b=>b.month===month&&b.status==='cancelled').length,
  review:s.rules.filter(r=>r.needsReview).length,
  unconfigured:s.cards.filter(c=>!c.accountId||!c.paymentDay).map(c=>c.name)};
}
function makeBill(s,card,month){
 return {id:'bill:'+card.id+':'+month,cardId:card.id,month,dueDate:businessDate(monthDate(month,card.paymentDay),s.holidays),openingAllocation:0,actual:null,reason:'',adjustment:null,status:'planned',version:1};
}
function termFromInput(term){
 fail(term&&['ongoing','end','installments'].includes(term.kind),'固定費の終了条件を選んでください');
 if(term.kind==='ongoing')return {kind:term.kind};
 if(term.kind==='end'){monthDate(term.endMonth,1);return {kind:term.kind,endMonth:term.endMonth};}
 monthDate(term.firstMonth,1);
 fail(Number.isInteger(term.total)&&term.total>=1&&term.total<=600,'支払回数を1〜600回で入力してください');
 const priorPaid=term.priorPaid??0;
 fail(Number.isInteger(priorPaid)&&priorPaid>=0&&priorPaid<=term.total,'開始時点の支払済み回数を確認してください');
 const endMonth=shiftBillingMonth(term.firstMonth,term.total-1);
 monthDate(endMonth,1);
 return {kind:term.kind,firstMonth:term.firstMonth,total:term.total,endMonth,priorPaid};
}
export function billProjection(s,b){
 const expected=billExpected(s,b),historicalForecast=historicalCardForecast(s,b);
 const evidence=billEvidence(s,b,cardDue);
 const pendingCharges=evidence.plans.reduce((total,plan)=>total+plan.amount,0);
 const forecast=projectBill(b,evidence,expected+pendingCharges+historicalForecast);
 const futurePurchases=(s.cardPurchasePlans||[]).filter(plan=>plan.cardId===b.cardId&&plan.month===b.month&&plan.status==='planned');
 const matches=new Set();
 let purchaseReview=false,purchaseForecast=0;
 if(b.actual===null)for(const plan of futurePurchases){
  const match=evidence.entries.find(entry=>entry.amount===plan.amount&&!matches.has(entry.id));
  if(match)matches.add(match.id);
  if(match||b.appEstimate&&plan.useDate<=b.appEstimate.checkedDate)purchaseReview=true;
  else purchaseForecast+=plan.amount;
 }
 forecast.projected+=purchaseForecast;
 if(purchaseForecast)forecast.unknown=false;
 forecast.review||=purchaseReview;
 return {...b,futurePurchases,purchaseForecast,expected:b.status==='confirmed'?b.expectedAtConfirm:expected,projected:forecast.projected,pendingCharges,historicalForecast,forecast};
}
function forecastSchedules(s,asOf){
 const state={...s,plans:s.plans.slice(),bills:s.bills.slice()};
 const months=[asOf.slice(0,7),shiftBillingMonth(asOf.slice(0,7),1)].filter(month=>month<='2100-12');
 const originalPlans=new Set(state.plans.map(plan=>plan.id)),originalBills=new Set(state.bills.map(bill=>bill.id));
 for(const month of months)ensureMonth(state,month);
 for(const card of state.cards){
  if(!card.accountId||!card.paymentDay)continue;
  const cardMonths=new Set();
  for(const entry of state.entries){
   if(entry.void||entry.payment!==card.id||entry.csvBilling?.status==='pending')continue;
   const month=entry.ledgerIncluded?entry.dueDate?.slice(0,7):entry.csvImported&&state.startDate&&entry.date<state.startDate?entry.csvBilling?.month:null;
   if(month)cardMonths.add(month);
  }
  for(const plan of state.plans){
   if(plan.status!=='planned'||plan.payment!==card.id)continue;
   const month=cardDue(card,plan.manualDue?plan.dueDate:plan.nominalDate,state.holidays)?.slice(0,7);
   if(month)cardMonths.add(month);
  }
  for(const month of cardMonths){
   if(month>'2100-12'||state.bills.some(bill=>bill.cardId===card.id&&bill.month===month))continue;
   const bill=makeBill(state,card,month);
   if(!state.startDate||bill.dueDate>=state.startDate)state.bills.push(bill);
  }
 }
 state.plans=state.plans.map(plan=>originalPlans.has(plan.id)?plan:{...plan,virtual:true});
 state.bills=state.bills.map(bill=>originalBills.has(bill.id)?bill:{...bill,virtual:true});
 return state;
}
function ensureMonth(s,month){monthDate(month,1);const {fixed,cards}=missingMonthlyItems(s,month);for(const r of fixed){const key='fixed:'+r.id+':'+month;const previous=s.plans.filter(p=>p.ruleId===r.id&&p.month<month).sort((a,b)=>b.month.localeCompare(a.month))[0];s.plans.push({id:key,ruleId:r.id,month,name:r.name,payment:r.payment,category:r.category,...(r.middle&&{middle:r.middle}),person:r.person||'',nominalDate:monthDate(month,r.day),dueDate:s.accounts.some(a=>a.id===r.payment&&a.kind==='bank')?businessDate(monthDate(month,r.day),s.holidays):monthDate(month,r.day),amount:r.variable&&previous?previous.amount:r.amount,variable:r.variable,status:'planned',version:1});}
 for(const card of cards){s.bills.push(makeBill(s,card,month));}
}
function hasSecrets(value){if(!value||typeof value!=='object')return false;return Object.entries(value).some(([k,v])=>/password|token|secret|credential/i.test(k)||hasSecrets(v));}
export function importPreview(input){fail(input&&typeof input==='object'&&!hasSecrets(input),'認証情報を含まない家計簿JSONを選んでください');const raw=input.data?.entries?input.data:input;fail(Array.isArray(raw.entries)&&raw.entries.length<=20000,'既存のentries配列を確認してください');return {count:raw.entries.length,splitReceipts:new Set(raw.entries.filter(e=>e.receiptId).map(e=>e.receiptId)).size,fixedRules:Array.isArray(raw.plan?.fixedExpenses)?raw.plan.fixedExpenses.length:0,version:raw.version||null};}
function importLegacy(s,input,hash){importPreview(input);fail(!s.importHash||s.importHash===hash,'既存データは取り込み済みです。再移行は差分照合が必要です',409);if(s.importHash)return;fail(!s.entries.length&&!s.startDate,'空の開発家計簿で先に既存データを取り込んでください');const raw=input.data?.entries?input.data:input;s.legacy=clone(input);s.importHash=hash;const deleted=new Set((raw.deletedIds||[]).map(x=>typeof x==='string'?x:x.id)),groups=new Map();for(const e of raw.entries){if(deleted.has(e.id))continue;const key=e.receiptId?'receipt:'+e.receiptId:'legacy:'+e.id;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e);}let n=0;for(const [key,parts]of groups){try{fail(parts.every(p=>p.date===parts[0].date&&p.payment===parts[0].payment&&p.type===parts[0].type),'分割取引の情報が一致しません');const first=parts[0],amount=parts.reduce((sum,p)=>sum+Number(p.amount),0);yenAmount(amount);if(first.receiptId)fail(parts.every(p=>Number(p.receiptTotal)===amount)&&Number(first.splitCount)===parts.length,'分割取引の行数または合計を確認してください');day(first.date);const payment=s.cards.find(c=>c.name.toLowerCase()===String(first.payment).toLowerCase())?.id||s.accounts.find(a=>a.name===first.payment)?.id||'legacy-unmapped';const splits=checkSplit(parts.map(p=>({amount:Number(p.amount),category:p.category||'その他',middle:p.categoryMiddle,small:p.categorySmall,person:p.person,nature:p.expenseNature})),amount);const e={id:'legacy-'+(++n),date:first.date,type:first.type||'expense',amount,payment,splits,memo:first.memo||'',counterparty:first.counterparty||'',linkedAdvanceId:first.linkedAdvanceId||'',settleMonth:first.settleMonth||first.date.slice(0,7),void:false,ledgerIncluded:false,legacyIds:parts.map(p=>p.id),legacyPayment:first.payment,legacyKey:key};fail(['expense','income','advance','recovery','refund'].includes(e.type),'旧種別を要確認');s.entries.push(e);for(const p of splits)if(!s.categories.tree[p.category])s.categories.tree[p.category]={};if(payment==='legacy-unmapped'||first.type==='income'&&s.cards.some(c=>c.id===payment))s.importIssues.push({key,reason:'旧支払元・入金種別の確認が必要です'});}catch(error){s.importIssues.push({key,reason:error.message});}}
 if(input.categories?.tree||raw.categories?.tree){const settings=input.categories||raw.categories;s.categories={tree:{...s.categories.tree,...clone(settings.tree)},hidden:clone(settings.hidden||[])};}
 for(const r of raw.plan?.fixedExpenses||[]){if(!r?.id||r.deletedAt)continue;s.rules.push({id:'legacy-rule-'+s.rules.length,name:String(r.name||''),amount:Number(r.amount)||0,payment:s.cards.find(c=>c.name===r.payment)?.id||s.accounts.find(a=>a.name===r.payment)?.id||'',category:r.category||'その他',person:r.person||'',day:Number(r.day)||1,variable:false,enabled:false,needsReview:true,legacy:clone(r)});}
}
function removeUnusedPurchaseBill(state,cardId,month){
 const bill=state.bills.find(b=>b.cardId===cardId&&b.month===month);
 if(!bill?.purchaseOnly||bill.version!==1||bill.status!=='planned')return;
 const projected=billProjection(state,bill);
 if(projected.futurePurchases.length||projected.expected||projected.pendingCharges||projected.historicalForecast)return;
 state.bills=state.bills.filter(b=>b.id!==bill.id);
}
function adjustGoalHolding(goal,account,delta){
 const held=Object.hasOwn(goal.holdings,account)?goal.holdings[account]:0;
 goal.holdings={...goal.holdings,[account]:held+delta};
}
function reserveForGoal(state,goal,accountId,amount,now){
 const account=find(state.accounts,accountId);
 const balance=accountBalance(state,account.id,now),overview=savingsHoldings(state);
 const total=state.accounts.reduce((sum,item)=>sum+Math.max(0,accountBalance(state,item.id,now)||0),0);
 fail(balance!==null&&balance-(overview.holdings[account.id]||0)>=amount&&total-overview.reserved>=amount,'積立元の自由残高が足りません');
 adjustGoalHolding(goal,account.id,amount);
}
export function applyBudgetCommand(original,command,context){const s=clone(original),now=day(context.today),op=id(context.eventId),type=command.type,d=command.data||{};fail(s.version===1,'データ形式を確認してください');
 switch(type){
 case 'legacy.bank.import':{
 fail(s.startDate&&d.confirm===true,'開始残高との二重反映を確認してください');
 fail(Array.isArray(d.entries)&&d.entries.length>0&&d.entries.length<=100,'取り込む履歴を1〜100件選んでください');
 for(const raw of d.entries){
  fail(raw.type==='expense'&&!raw.receiptId,'銀行引落の通常支出を選んでください');
  const account=s.accounts.find(a=>a.kind==='bank'&&(a.name===raw.payment||a.id===raw.payment));
  fail(account,'引落元の口座名を確認してください');
  const key=id(raw.id),existing=s.entries.find(e=>e.legacyIds?.includes(key));
  if(existing){fail(!existing.void&&existing.amount===raw.amount&&existing.date===raw.date&&existing.payment===account.id,'取り込み済み履歴の内容が変わっています',409);if(existing.ledgerIncluded||existing.balanceIncludedExternally)continue;existing.ledgerIncluded=true;postEntry(s,existing,now);continue;}
  fail(!s.entries.some(e=>!e.void&&e.payment===account.id&&e.date===raw.date&&e.amount===raw.amount),'同じ日・口座・金額の履歴があります。収支画面で確認してください',409);
  const e=cleanEntry({...raw,id:'bank-import-'+key,payment:account.id},now);
  e.legacyIds=[key];e.legacyPayment=raw.payment;e.legacyKey='legacy:'+key;
  activeEntry(s,e,now,true);
 }break;}
 case 'fixed.import':{try{importFixedRules(s,d,{monthDate,ensureMonth,cleanEntry,now});}catch(e){throw new BudgetError(e.message,409);}break;}
 case 'csv.billing.assign':{try{assignCardBilling(s,d,{monthDate,businessDate,ensureMonth});}catch(e){throw new BudgetError(e.message,409);}break;}
 case 'csv.import':{try{importCardRows(s,d,{cleanEntry,activeEntry,businessDate,monthDate,ensureMonth,now});}catch(e){throw new BudgetError(e.message,409);}break;}
 case 'cashPlan.save':{s.cashPlans||=[];const key=id(d.id),old=s.cashPlans.find(p=>p.id===key);fail(!old||old.status==='planned'&&old.version===d.version,'予定が更新されています',409);fail(['income','transfer'].includes(d.kind),'予定の種類を確認してください');const amount=yenAmount(d.amount);fail(amount>0,'金額を入力してください');find(s.accounts,d.to);if(d.kind==='transfer'){find(s.accounts,d.from);fail(d.from!==d.to,'振替元と先を分けてください');}const next={id:key,kind:d.kind,name:text(d.name,100),amount,to:d.to,from:d.kind==='transfer'?d.from:null,date:day(d.date),category:text(d.category||'給与',100),memo:text(d.memo||'',2000),status:'planned',version:(old?.version||0)+1};fail(next.name,'予定名を入力してください');if(old)Object.assign(old,next);else s.cashPlans.push(next);break;}
 case 'cashPlan.cancel':{const p=find(s.cashPlans||[],d.id);fail(p.status==='planned'&&p.version===d.version,'予定が更新されています',409);p.status='cancelled';p.version++;break;}
 case 'cashPlan.confirm':{fail(s.startDate,'先に残高管理を開始してください');const p=find(s.cashPlans||[],d.id);fail(p.status==='planned'&&p.version===d.version,'予定が更新されています',409);const date=day(d.date||p.date);let result=applyBudgetCommand(s,p.kind==='income'?{type:'entry.add',data:{id:'scheduled-'+op,type:'income',date,amount:p.amount,payment:p.to,category:p.category,middle:p.middle,memo:p.name+(p.memo?' '+p.memo:'')}}:{type:'transfer',data:{date,amount:p.amount,from:p.from,to:p.to,reason:p.name}},context);const saved=find(result.cashPlans,p.id);saved.status='confirmed';saved.version++;saved.actualDate=date;saved.postingId=p.kind==='income'?'scheduled-'+op:op;return result;}
 case 'cashPlan.undo':{const p=find(s.cashPlans||[],d.id);fail(p.status==='confirmed'&&p.version===d.version,'予定が更新されています',409);const result=applyBudgetCommand(s,p.kind==='income'?{type:'entry.void',data:{id:p.postingId,reason:'入金予定の確定取消'}}:{type:'transfer.undo',data:{id:p.postingId,reason:'振替予定の確定取消'}},{...context,fromCashPlan:true});const saved=find(result.cashPlans,p.id);saved.status='planned';saved.version++;return result;}
 case 'plan.cancel':{const p=find(s.plans,d.id);fail(p.status==='planned'&&p.version===d.version,'予定が更新されています',409);p.status='cancelled';p.version++;break;}
 case 'bill.cancel':{const b=find(s.bills,d.id);fail(!billProjection(s,b).futurePurchases.length,'カード利用予定を変更・取消してから引落予定を取り消してください');fail(b.status==='planned'&&b.version===d.version,'予定が更新されています',409);b.status='cancelled';b.version++;break;}
 case 'calendar.settings':{fail(typeof d.enabled==='boolean'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(d.time)&&[0,1,2,3,7].includes(d.daysBefore),'通知設定を確認してください');s.calendarNotice={enabled:d.enabled,time:d.time,daysBefore:d.daysBefore};break;}
 case 'import':fail(d.confirm===true,'原本を保持する取り込み内容を確認してください');importLegacy(s,d.snapshot,context.importHash);break;
 case 'cashflow.funds':{
  monthDate(d.month,1);
  fail(Array.isArray(d.goals)&&d.goals.length<=30,'確保額の内訳を確認してください');
  const goals=d.goals.map(goal=>({name:text(goal.name,100),amount:yenAmount(goal.amount)}));
  fail(goals.every(goal=>goal.name)&&new Set(goals.map(goal=>goal.name)).size===goals.length,'確保する用途を重複なく入力してください');
  s.fundReserves={...s.fundReserves,[d.month]:{living:yenAmount(d.living),goals}};
  break;
 }
 case 'cashflow.monthlyBenefit':{
  fail(typeof d.enabled==='boolean','手当の設定を確認してください');
  s.monthlyBenefit={enabled:d.enabled,even:yenAmount(d.even),odd:yenAmount(d.odd)};
  break;
 }
 case 'cashflow.reserve':{s.livingReserve=yenAmount(d.amount);break;}
 case 'account.rename':{const a=find(s.accounts,d.id),name=text(d.name,100).trim();fail(name,'口座名を入力してください');a.name=name;break;}
 case 'account.add':{const key=id(d.id);fail(!s.accounts.some(a=>a.id===key),'同じ口座があります',409);fail(['bank','cash'].includes(d.kind),'口座種別を確認してください');s.accounts.push({id:key,name:text(d.name,100),kind:d.kind,opening:null,openingDate:null});break;}
 case 'card.configure':{const c=find(s.cards,d.id);find(s.accounts,d.accountId);monthDate('2026-01',d.closingDay);monthDate('2026-01',d.paymentDay);fail([0,1,2].includes(d.monthOffset),'支払月を確認してください');fail(!s.entries.some(e=>e.ledgerIncluded&&e.payment===c.id)&&!s.bills.some(b=>b.cardId===c.id&&b.status==='confirmed'),'運用開始後の締め日変更は差分確認が必要です');Object.assign(c,{accountId:d.accountId,closingDay:d.closingDay,paymentDay:d.paymentDay,monthOffset:d.monthOffset});break;}
 case 'start':{fail(!s.startDate&&d.confirm===true,'開始残高を確認してください',409);const start=day(d.startDate);fail(start<=now,'開始日は今日以前を指定してください');fail(Array.isArray(d.accounts)&&d.accounts.length>0,'対象口座を選んでください');const seen=new Set();for(const x of d.accounts){fail(!seen.has(x.id),'口座が重複しています');seen.add(x.id);const a=find(s.accounts,x.id);a.opening=yenAmount(x.amount,true);a.openingDate=start;}for(const c of s.cards){const opening=(d.cards||[]).find(x=>x.id===c.id);fail(opening,'両カードの開始時未払金を確認してください');c.opening=yenAmount(opening.amount,true);fail(c.accountId&&c.closingDay&&c.paymentDay&&find(s.accounts,c.accountId).opening!==null,'カード設定と引落口座の開始残高を確認してください');}s.startDate=start;break;}
 case 'account.opening-date':{
 fail(s.startDate&&d.confirm===true,'開始残高が変更後の日付の取引前残高であることを確認してください');
 const a=find(s.accounts,d.id);fail(a.opening!==null,'先に開始残高を設定してください');
 const date=day(d.date);
 fail(date>=s.startDate&&date<=a.openingDate&&date<=now,'家計の開始日から現在の口座開始日までを指定してください');
 a.openingDate=date;break;
 }
 case 'account.open':{fail(s.startDate,'ホームの「開始残高を設定」から先に残高管理を開始してください');fail(d.confirm===true,'この残高と開始日にチェックしてください');const a=find(s.accounts,d.id);fail(a.opening===null,'開始残高は設定済みです',409);a.openingDate=day(d.date);fail(a.openingDate>=s.startDate&&a.openingDate<=now,'開始日を確認してください');a.opening=yenAmount(d.amount,true);break;}
 case 'entry.add':{const e=cleanEntry(d,now);fail(!s.entries.some(x=>x.id===e.id),'この取引は登録済みです',409);fail(s.cards.some(c=>c.id===e.payment)||e.payment==='cash'||d.bankEntry===true&&s.accounts.some(a=>a.id===e.payment&&a.kind==='bank')||e.type!=='expense'&&s.accounts.some(a=>a.id===e.payment),'買い物の支払元はPINK・VISA・現金です');activeEntry(s,e,now,!!s.startDate&&e.date>=s.startDate);s.preferences.payment=e.payment;s.preferences.payments||={};s.preferences.payments[e.type]=e.payment;s.preferences.category=e.splits[0].category;s.preferences.middle=e.splits[0].middle;s.preferences.small=e.splits[0].small;s.preferences.person=e.splits[0].person;for(const part of e.splits)if(!Object.hasOwn(s.categories.tree,part.category))s.categories.tree[part.category]={};break;}
 case 'entry.edit':{const old=find(s.entries,d.id);fail(!(s.savingsGoalEvents||[]).some(event=>event.entryId===old.id),'積立から充当した支出です');fail(!(s.cashPlans||[]).some(p=>p.postingId===old.id&&p.status==='confirmed'),'入金予定の画面から確定を取り消してください');fail(!s.plans.some(p=>p.entryId===old.id&&p.status==='confirmed'),'固定費は引落を取り消してから修正してください');fail(!old.void,'取り消し済みです',409);const next=cleanEntry({...old,...d,splits:d.splits||(old.splits.length===1?[{...old.splits[0],amount:d.amount??old.amount,category:d.category??old.splits[0].category,person:d.person??old.splits[0].person}]:old.splits)},now);validateSavings(s,next);const sameDebit=['expense','advance'].includes(old.type)&&['expense','advance'].includes(next.type);
 const metadataAware=s.classificationVersion||Object.hasOwn(d,'purchase');
 const financialChange=!metadataAware||['date','amount','payment'].some(key=>next[key]!==old[key])||next.type!==old.type&&!sameDebit;
 if((s.advanceSettlements||[]).some(settlement=>settlement.items.some(item=>item.id===old.id)))fail(!financialChange&&next.type===old.type,'精算済みの立替は金額や支払元を変更できません');
 if(old.type==='advance'&&next.type!=='advance')fail(!s.entries.some(e=>!e.void&&e.type==='recovery'&&e.linkedAdvanceId===old.id),'回収済みの立替は種類を変更できません');
 if(old.ledgerIncluded&&financialChange)undoSource(s,'entry:'+old.id,now,'取引の編集');next.legacyIds=old.legacyIds;next.legacyPayment=old.legacyPayment;next.legacyKey=old.legacyKey;next.balanceIncludedExternally=old.balanceIncludedExternally;next.csvImported=old.csvImported;if(old.merchant)next.merchant=old.merchant;if(old.csvBilling&&next.payment===old.payment)next.csvBilling=clone(old.csvBilling);next.ledgerIncluded=old.ledgerIncluded;if(financialChange)postEntry(s,next,now);else if(Object.hasOwn(old,'dueDate'))next.dueDate=old.dueDate;if(!metadataAware&&next.csvBilling)next.dueDate=old.dueDate;s.entries[s.entries.findIndex(e=>e.id===old.id)]=next;break;}
 case 'entry.apply':{const e=find(s.entries,d.id);fail(d.confirm===true&&!e.void&&!e.ledgerIncluded&&!e.balanceIncludedExternally,'反映対象を確認してください',409);if(d.payment)e.payment=id(d.payment);e.ledgerIncluded=true;postEntry(s,e,now);break;}
 case 'entry.void':{const e=find(s.entries,d.id);fail(!(s.savingsGoalEvents||[]).some(event=>event.entryId===e.id),'積立から充当した支出です');fail(!(s.cashPlans||[]).some(p=>p.postingId===e.id&&p.status==='confirmed')||context.fromCashPlan===true,'入金予定の画面から確定を取り消してください');fail(!s.plans.some(p=>p.entryId===e.id&&p.status==='confirmed'),'固定費は口座画面から取り消してください');fail(!e.void,'すでに取り消し済みです',409);fail(!(s.advanceSettlements||[]).some(x=>x.items.some(item=>item.id===e.id)),'精算済みの立替は取り消せません');if(e.ledgerIncluded)undoSource(s,'entry:'+e.id,now,text(d.reason||'取引の取り消し',500));e.void=true;break;}
 case 'transfer':{fail(s.startDate,'先に残高管理を開始してください');const from=find(s.accounts,d.from),to=find(s.accounts,d.to),amount=yenAmount(d.amount),date=day(d.date);fail(from.id!==to.id&&amount>0,'振替元・振替先・金額を確認してください');fail(from.opening!==null&&to.opening!==null&&date>=from.openingDate&&date>=to.openingDate&&date<=now,'両口座の開始日・残高を確認してください');emit(s,op,date,'account',from.id,-amount);emit(s,op,date,'account',to.id,amount);s.transfers.push({id:op,from:from.id,to:to.id,amount,date,reason:text(d.reason||'',500),void:false});break;}
 case 'transfer.undo':{const t=find(s.transfers,d.id);fail(!(s.savingsGoalEvents||[]).some(event=>event.transferId===t.id),'積立に連動した振替です');fail(!(s.cashPlans||[]).some(p=>p.postingId===t.id&&p.status==='confirmed')||context.fromCashPlan===true,'振替予定の画面から確定を取り消してください');fail(!t.void,'すでに取り消し済みです',409);undoSource(s,t.id,now,text(d.reason||'振替取消',500));t.void=true;break;}
 case 'account.adjust':{const a=find(s.accounts,d.id);fail(a.opening!==null,'開始残高を設定してください');const actual=yenAmount(d.actual,true),reason=text(d.reason||'',500);fail(reason,'残高調整の理由を入力してください');const expected=accountBalance(s,a.id,now);emit(s,op,now,'account',a.id,actual-expected,reason);s.adjustments.push({id:op,accountId:a.id,date:now,expected,actual,reason,void:false});break;}
 case 'adjustment.undo':{const a=find(s.adjustments,d.id);fail(!a.void,'すでに取り消し済みです',409);undoSource(s,a.id,now,text(d.reason||'残高調整取消',500));a.void=true;break;}
 case 'rule.save':{const key=id(d.id),amount=yenAmount(d.amount);fail(amount>0,'金額を入力してください');fail(s.accounts.some(a=>a.id===d.payment)||s.cards.some(c=>c.id===d.payment),'引落元を選んでください');monthDate(now.slice(0,7),d.day);const rule={id:key,name:text(d.name,100),amount,payment:d.payment,category:text(d.category||'その他',100),...(d.middle&&{middle:text(d.middle,100)}),person:text(d.person||'',100),day:d.day,variable:!!d.variable,enabled:d.enabled!==false,needsReview:false};const at=s.rules.findIndex(r=>r.id===key);if(d.term!==undefined)rule.term=termFromInput(d.term);else if(s.rules[at]?.term)rule.term=s.rules[at].term;if(at<0)s.rules.push(rule);else{if(d.middle===undefined&&rule.category===s.rules[at].category&&s.rules[at].middle)rule.middle=s.rules[at].middle;if(s.rules[at].originalClassification)rule.originalClassification=s.rules[at].originalClassification;if(s.rules[at].firstMonth){rule.firstMonth=s.rules[at].firstMonth;rule.legacy=s.rules[at].legacy;}s.rules[at]=rule;}break;}
 case 'rule.disable':find(s.rules,d.id).enabled=false;break;
 case 'plans.generate':ensureMonth(s,d.month||now.slice(0,7));break;
 case 'plan.add':{
  const key=id('once:'+id(d.id));
  fail(!s.plans.some(p=>p.id===key),'この予定は登録済みです',409);
  const account=find(s.accounts,d.payment);
  fail(account.kind==='bank','引落口座を選んでください');
  const name=text(d.name,100),amount=yenAmount(d.amount),dueDate=day(d.dueDate),month=dueDate.slice(0,7);
  monthDate(month,1);
  fail(key.length<=90&&name&&amount>0,'予定番号・予定名・金額を確認してください');
  s.plans.push({id:key,oneOff:true,month,name,payment:account.id,amount,nominalDate:dueDate,dueDate,manualDue:true,
   category:text(d.category||'その他',100),middle:text(d.middle||'',100),person:text(d.person||'',100),status:'planned',version:1});
  break;
 }
 case 'plan.edit':{const p=find(s.plans,d.id);fail(p.status==='planned','確定済みの金額は取り消してから修正してください',409);fail(p.version===d.version,'予定が更新されています',409);p.amount=yenAmount(d.amount);fail(p.amount>0,'金額を入力してください');p.manualDue=!!p.manualDue||!!d.dueDate&&d.dueDate!==p.dueDate;p.dueDate=day(d.dueDate||p.dueDate);if(p.oneOff){p.month=p.dueDate.slice(0,7);monthDate(p.month,1);}p.version++;break;}
 case 'payments.confirm':{fail(Array.isArray(d.items)&&d.items.length>0&&d.items.length<=100,'引落を選んでください');let combined=s;const unique=new Set();for(const item of d.items){fail(['plan','bill'].includes(item.kind)&&!unique.has(item.id),'引落の指定が重複しています');unique.add(item.id);combined=applyBudgetCommand(combined,{type:item.kind==='bill'?'bill.confirm':'plans.confirm',data:item.kind==='bill'?{id:item.id,version:item.version}:{items:[{id:item.id,version:item.version}]}},context);}return combined;}
 case 'plans.confirm':{fail(Array.isArray(d.items)&&d.items.length>0&&d.items.length<=100,'対象の引落を選んでください');const seen=new Set();for(const x of d.items){fail(!seen.has(x.id),'対象が重複しています');seen.add(x.id);const p=find(s.plans,x.id);fail(p.status==='planned'&&p.version===x.version,'引落は確定済み、または更新されています',409);fail(p.dueDate<=now,'未来の引落はまだ確定できません');const e=cleanEntry({id:p.oneOff?'withdrawal-'+p.id+'-'+p.version:'fixed-'+p.ruleId+'-'+p.month+'-'+p.version,date:day(d.date||p.dueDate),type:'expense',amount:p.amount,payment:p.payment,category:p.category,middle:p.middle,person:p.person,memo:p.name},now);activeEntry(s,e,now,true);p.status='confirmed';p.entryId=e.id;p.version++;}break;}
 case 'plan.undo':{const p=find(s.plans,d.id);fail(p.status==='confirmed','未確定または取り消し済みです',409);const e=find(s.entries,p.entryId);fail(!(s.savingsGoalEvents||[]).some(event=>event.entryId===e.id),'積立から充当した支出です');fail(!e.void,'関連取引を確認してください',409);undoSource(s,'entry:'+e.id,now,text(d.reason||'固定費引落取消',500));e.void=true;p.status='planned';p.version++;break;}
 case 'bill.estimate':{
  const card=find(s.cards,d.cardId),month=d.month;
  monthDate(month,1);
  fail(card.accountId&&card.closingDay&&card.paymentDay,'カードの引落口座・締め日・支払日を設定してください');
  const old=s.bills.find(bill=>bill.cardId===card.id&&bill.month===month);
  const bill=old||makeBill(s,card,month);
  fail(bill.status==='planned'&&(!old||bill.version===d.version),'既存の引落予定の状態を確認してください',409);
  fail(!s.startDate||bill.dueDate>=s.startDate,'家計の開始日以降の請求月を選んでください');
  fail(['estimate','confirmed'].includes(d.status),'請求額の状態を選んでください');
  const checkedDate=day(d.checkedDate),amount=yenAmount(d.amount);
  fail(checkedDate<=now&&(!bill.appEstimate||checkedDate>=bill.appEstimate.checkedDate)&&(!bill.appCheckedDate||checkedDate>=bill.appCheckedDate),'最新の確認日を今日以前で指定してください');
  if(d.status==='confirmed'){
   bill.actual=amount;
   bill.appCheckedDate=checkedDate;
   if(!bill.reason)bill.reason='未照合';
  }else{
   fail(bill.actual==null,'確定した請求額は請求額・差額の画面から確認してください',409);
   const known=billEvidence(s,bill,cardDue).entries.map(({id,signature})=>({id,signature}));
   bill.appEstimate={amount,checkedDate,known,decisions:[],future:[]};
  }
  bill.amountHistory||=[];
  bill.amountHistory.push({status:d.status,amount,checkedDate,recordedDate:now});
  if(!old)s.bills.push(bill);
  else bill.version++;
  break;
 }
 case 'bill.reconcile':{
  const bill=find(s.bills,d.id);
  fail(bill.status==='planned'&&bill.actual==null&&bill.appEstimate&&bill.version===d.version,'カード引落予定が更新されています',409);
  const evidence=billEvidence(s,bill,cardDue);
  fail(Array.isArray(d.decisions)&&Array.isArray(d.future)&&d.decisions.length<=evidence.entries.length&&d.future.length<=evidence.plans.length,'照合内容を確認してください');
  const decisions=new Map();
  for(const choice of d.decisions){
   const entry=find(evidence.entries,choice.id);
   fail(!decisions.has(entry.id)&&['included','extra'].includes(choice.coverage)&&choice.signature===entry.signature,'明細の照合を確認してください',409);
   decisions.set(entry.id,{id:entry.id,signature:entry.signature,coverage:choice.coverage});
  }
  const future=new Map(),linkedIds=new Set();
  for(const choice of d.future){
   const plan=find(evidence.plans,choice.id);
   const linked=choice.linkedEntryId?find(evidence.entries,choice.linkedEntryId):null;
   fail(!future.has(plan.id)&&choice.version===plan.version&&['included','extra'].includes(choice.coverage)&&(!linked||choice.coverage==='included'&&linked.amount>0&&!linkedIds.has(linked.id)),'定期支払いの照合を確認してください',409);
   if(linked)linkedIds.add(linked.id);
   future.set(plan.id,{id:plan.id,version:plan.version,coverage:choice.coverage,...linked&&{linkedEntryId:linked.id,linkedSignature:linked.signature}});
  }
  bill.appEstimate.decisions=[...decisions.values()];
  bill.appEstimate.future=[...future.values()];
  bill.version++;
  break;
 }
 case 'bill.edit':{const b=find(s.bills,d.id);fail(b.status==='planned'&&b.version===d.version,'カード引落予定が更新されています',409);b.actual=yenAmount(d.actual);b.manualDue=!!b.manualDue||!!d.dueDate&&d.dueDate!==b.dueDate;b.dueDate=day(d.dueDate||b.dueDate);b.reason=text(d.reason||'',500);const allocation=yenAmount(d.openingAllocation||0),card=find(s.cards,b.cardId),used=s.bills.filter(x=>x.id!==b.id&&x.cardId===card.id).reduce((a,x)=>a+(x.openingAllocation||0),0);fail(allocation+used<=Math.max(0,card.opening||0),'開始時未払金の割当を確認してください');b.openingAllocation=allocation;if(d.adjustment){fail(['points','refund','fee'].includes(d.adjustment.kind),'差額の種別を確認してください');b.adjustment={kind:d.adjustment.kind,amount:yenAmount(d.adjustment.amount),reason:text(d.adjustment.reason||b.reason,500)};fail(b.adjustment.reason,'差額の内容を入力してください');}else b.adjustment=null;if(b.amountHistory){b.appCheckedDate=now;b.amountHistory.push({status:'confirmed',amount:b.actual,checkedDate:now,recordedDate:now});}b.version++;break;}
 case 'bill.confirm':{const b=find(s.bills,d.id),card=find(s.cards,b.cardId),a=find(s.accounts,card.accountId);fail(s.startDate&&a.opening!==null&&b.dueDate>=a.openingDate,'引落口座の開始日・残高を設定してください');fail(b.status==='planned'&&b.version===d.version,'確定済み、または予定が更新されています',409);fail(b.dueDate<=now,'未来のカード引落はまだ確定できません');fail(b.actual!==null||!b.appEstimate&&pendingCardCharges(s,b)===0&&historicalCardForecast(s,b)===0&&!billProjection(s,b).futurePurchases.length,'見込に未確認の明細があります。実際の請求額を確認してください');const expected=billExpected(s,b),actual=b.actual===null?expected:b.actual;yenAmount(actual);fail(expected===actual||b.reason,'請求差額の理由（不明なら未照合）を記録してください');const source='payment:'+b.id+':'+b.version;emit(s,source,b.dueDate,'account',a.id,-actual);emit(s,source,b.dueDate,'card',card.id,-actual);let adj=0;if(b.adjustment){adj=b.adjustment.amount*(b.adjustment.kind==='fee'?1:-1);emit(s,source,b.dueDate,'card',card.id,adj,b.adjustment.reason);}b.expectedAtConfirm=expected;b.actual=actual;b.reconciliation=expected+adj-actual;b.source=source;b.status='confirmed';b.version++;break;}
 case 'bill.undo':{const b=find(s.bills,d.id);fail(b.status==='confirmed','すでに取り消し済みです',409);undoSource(s,b.source,now,text(d.reason||'カード引落取消',500));b.status='planned';b.version++;break;}
 case 'holidays':fail(Array.isArray(d.dates)&&d.dates.length<=400,'休日を確認してください');s.holidays=[...new Set(d.dates.map(day))];for(const p of s.plans.filter(p=>p.status==='planned'&&!p.manualDue&&p.dueDate>=now)){const adjusted=s.accounts.some(a=>a.id===p.payment&&a.kind==='bank')?businessDate(p.nominalDate,s.holidays):p.nominalDate;if(adjusted!==p.dueDate){p.dueDate=adjusted;p.version++;}}for(const b of s.bills.filter(b=>b.status==='planned'&&!b.manualDue&&b.dueDate>=now)){const adjusted=businessDate(monthDate(b.month,find(s.cards,b.cardId).paymentDay),s.holidays);if(adjusted!==b.dueDate){b.dueDate=adjusted;b.version++;}}break;
 case 'classification.migrate':
  fail(d.confirm===true&&Number.isInteger(d.expectedRevision),'移行プレビューを確認してください');
  migrateClassification(s,d.merchants);break;
 case 'classification.people':{
  const name=text(d.name,100),old=text(d.old||'',100);
  const people=s.people||budgetPeople;
  fail(name&&(!old||people.includes(old))&&(!people.includes(name)||name===old),'対象者名を確認してください');
  s.people=old?people.map(person=>person===old?name:person):[...people,name];
  if(old){
   for(const e of s.entries)for(const p of e.splits)if(p.person===old)p.person=name;
   for(const row of [...s.rules,...s.plans,s.preferences])if(row.person===old)row.person=name;
   for(const rule of Object.values(s.merchantCategories||{}))if(rule?.person===old)rule.person=name;
  }
  break;
 }
 case 'classification.merchant':{
  const key=text(d.key,500);fail(key&&!['__proto__','constructor','prototype'].includes(key),'利用先を入力してください');
  s.merchantCategories||={};
  if(d.disabled===true){s.merchantCategories[key]={disabled:true};break;}
  fail(Object.hasOwn(s.categories.tree,d.category),'大カテゴリを選んでください');
  const middle=text(d.middle||'',100);
  fail(!middle||Object.hasOwn(s.categories.tree[d.category],middle),'中カテゴリを確認してください');
  s.merchantCategories[key]={category:d.category,middle,person:text(d.person||'',100)};
  break;
 }
 case 'classification.entries':{
  fail(Array.isArray(d.items)&&d.items.length>0&&d.items.length<=500,'変更する明細を選んでください');
  for(const item of d.items){
   const e=find(s.entries,item.id);
   fail(!e.void,'取り消し済みの明細です');
   const parts=Array.isArray(item.indices)?item.indices.map(i=>e.splits[i]):e.splits;
   for(const p of parts){
    fail(p,'明細の内訳を確認してください');
    if(d.category){
     fail(Object.hasOwn(s.categories.tree,d.category),'大カテゴリを選んでください');
     const middle=text(d.middle||'',100);
     fail(!middle||Object.hasOwn(s.categories.tree[d.category],middle),'中カテゴリを確認してください');
     p.originalClassification||={category:p.category,middle:p.middle,small:p.small,person:p.person};
     p.category=d.category;p.middle=middle;p.small='';
    }
    if(d.person!==undefined)p.person=text(d.person,100);
   }
   if(d.spendingKind!==undefined){
    fail(d.spendingKind===''||spendingKinds.includes(d.spendingKind),'支出区分を確認してください');
    e.spendingKind=d.spendingKind;
   }
   validateSavings(s,e);
  }
  break;
 }
 case 'savings.goal.save':{
  const goals=s.savingsGoals||=[];
  const old=d.id?find(goals,d.id):null;
  fail(!old||!old.deleted,'終了した目標を確認してください');
  const name=text(d.name,100),category=text(d.category||'その他',100);
  const startMonth=d.startMonth||null,deadline=d.deadline?day(d.deadline):null;
  if(startMonth)monthDate(startMonth,1);
  if(deadline)monthDate(deadline.slice(0,7),1);
  fail(name&&(!startMonth||!deadline||startMonth<=deadline.slice(0,7)),'積立名と開始月・期限を確認してください');
  fail(['monthly','alternate','irregular','once'].includes(d.frequency)&&['auto','manual'].includes(d.mode),'積立頻度と金額の設定を確認してください');
  fail(['active','achieved','paused','ended'].includes(d.status),'ステータスを確認してください');
  monthDate(now.slice(0,7),d.day);
  if(d.accountId)find(s.accounts,d.accountId);
  const legacy=d.legacyPurpose?savingsLegacy(s).find(group=>group.purpose===d.legacyPurpose):null;
  fail(!d.legacyPurpose||!old&&legacy,'旧履歴はすでに引き継がれています',409);
  const goal=old||{id:op,holdings:{},unassigned:Math.max(0,legacy?.balance||0),legacyPurpose:legacy?.purpose||null};
  const hasPayments=(s.savingsGoalEvents||[]).some(event=>event.goalId===goal.id&&event.kind==='repay');
  fail(!hasPayments||d.debt,'返済履歴があるため借金の設定を保持してください');
  const debt=d.debt?{principal:yenAmount(d.debt.principal),rate:d.debt.rate??null}:null;
  if(debt)fail(debt.principal>=debtPaid(goal,(s.savingsGoalEvents||[]).filter(e=>e.goalId===goal.id))&&(debt.rate===null||Number.isFinite(debt.rate)&&debt.rate>=0&&debt.rate<=100),'元金と年利を確認してください');
  Object.assign(goal,{name,category,target:d.target==null?null:yenAmount(d.target),deadline,startMonth,frequency:d.frequency,
   mode:d.mode,amount:d.mode==='manual'?yenAmount(d.amount):null,day:d.day,accountId:d.accountId||null,memo:text(d.memo||'',1000),status:d.status,scheduleAsOf:now,debt});
  if(!old)goals.push(goal);
  const initial=old?0:yenAmount(d.initial??0);
  if(initial)reserveForGoal(s,goal,goal.accountId,initial,now);
  (s.savingsGoalEvents||=[]).push({id:op,goalId:goal.id,kind:initial?'opening':old?'update':'create',date:now,amount:initial,accountId:goal.accountId});
  break;
 }
 case 'savings.goal.plan':{
  const goal=find(s.savingsGoals||[],d.id),date=day(d.date),period=date.slice(0,7);
  fail(!goal.deleted&&goal.status==='active'&&goal.frequency==='irregular','不定期の積立目標を確認してください');
  monthDate(period,1);
  fail(!(s.savingsGoalEvents||[]).some(event=>event.goalId===goal.id&&event.period===period),'この月の積立は確定済みです',409);
  const plans=goal.manualPlans||={};
  if(d.cancel){fail(plans[period]?.date===date,'積立予定が更新されています',409);delete plans[period];break;}
  const amount=yenAmount(d.amount);
  fail(amount>0&&date>=now&&(!goal.deadline||date<=goal.deadline)&&(!goal.startMonth||period>=goal.startMonth),'予定日・金額・目標期限を確認してください');
  if(d.previousDate){const previous=day(d.previousDate).slice(0,7);fail(plans[previous]&&plans[previous].date===d.previousDate&&(previous===period||!plans[period]),'積立予定が更新されています',409);delete plans[previous];}
  else fail(!plans[period],'この月にはすでに積立予定があります',409);
  plans[period]={period,date,amount};
  break;
 }
 case 'savings.goal.record':{
  const goal=find(s.savingsGoals||[],d.id),kind=d.kind;
  const date=day(d.date||now),history=(s.savingsGoalEvents||=[]);
  fail(!goal.deleted&&date<=now,'目標と実績日を確認してください');
  fail(['confirm','add','assign','release','move','pay','repay','delete'].includes(kind),'積立の操作を確認してください');
  if(kind==='delete'){
   fail(d.confirm===true,'残っている確保額の解除を確認してください');
   goal.deleted=true;
   const amount=savingsGoalBalance(goal);
   history.push({id:op,goalId:goal.id,date,kind,amount,released:clone(goal.holdings),unassigned:goal.unassigned});
   goal.holdings={};goal.unassigned=0;
   break;
  }
  const amount=yenAmount(d.amount),account=find(s.accounts,d.accountId);
  fail(amount>0,'金額は1円以上で入力してください');
  const event={id:op,goalId:goal.id,kind,date,amount,accountId:account.id};
  if(kind==='confirm'||kind==='add'||kind==='assign'){
   if(kind==='confirm'){
    const plan=savingsSchedule(goal,history.filter(event=>event.goalId===goal.id),goal.scheduleAsOf).find(plan=>plan.period===d.period);
    fail(plan&&d.period<=now.slice(0,7)&&d.period<=date.slice(0,7),'積立予定が変更されています',409);
    event.period=plan.period;event.scheduledDate=plan.date;event.plannedAmount=plan.amount;
   }
   let next=s;
   const destination=d.to?find(s.accounts,d.to):account;
   if(d.to){
    fail(kind!=='assign'&&account.id!==destination.id,'振替元と振替先を確認してください');
    const matches=s.transfers.filter(move=>!move.void&&move.from===account.id&&move.to===destination.id&&move.date===date&&move.amount===amount);
    if(d.transferId){
     const move=find(matches,d.transferId);
     fail(!history.some(event=>event.transferId===move.id),'この振替はすでに積立に使用されています',409);
     event.transferId=move.id;
    }else{
     fail(!matches.length,'同じ振替が登録済みです。既存の振替を選んでください',409);
     fail(!(s.cashPlans||[]).some(plan=>plan.kind==='transfer'&&plan.status==='planned'&&plan.from===account.id&&plan.to===destination.id&&plan.date===date&&plan.amount===amount),'同じ振替予定があります。予定を確定したあと、既存の振替を選んでください',409);
     const held=savingsHoldings(s).holdings[account.id]||0,fromBalance=accountBalance(s,account.id,date);
     fail(fromBalance!==null&&Math.min(fromBalance,accountBalance(s,account.id,now))-held>=amount,'振替元の自由残高が足りません');
     next=applyBudgetCommand(s,{type:'transfer',data:{from:account.id,to:destination.id,date,amount,reason:goal.name}},context);
     event.transferId=op;
    }
    event.accountId=destination.id;event.from=account.id;
   }
   const target=find(next.savingsGoals,goal.id);
   if(kind==='assign'){
    fail(amount<=target.unassigned,'未割当の積立額を確認してください');
    target.unassigned-=amount;
   }
   reserveForGoal(next,target,destination.id,amount,now);
   target.scheduleAsOf=now;
   next.savingsGoalEvents.push(event);
   return next;
  }
  fail(Object.hasOwn(goal.holdings,account.id)&&amount<=goal.holdings[account.id],'確保済み金額を超えています');
  adjustGoalHolding(goal,account.id,-amount);
  if(kind==='move'){
   const target=find(s.savingsGoals,d.destination);
   fail(target.id!==goal.id&&!target.deleted,'振替先の積立を確認してください');
   adjustGoalHolding(target,account.id,amount);
   target.scheduleAsOf=now;event.destination=target.id;
  }
  if(kind==='pay'||kind==='repay'){
   fail(accountBalance(s,account.id,date)!==null,'支払元の開始日と残高を確認してください');
   if(kind==='repay'){
    const principal=yenAmount(d.principal);
    const paid=debtPaid(goal,history.filter(e=>e.goalId===goal.id));
    fail(goal.debt&&principal<=amount&&principal<=goal.debt.principal-paid,'元金返済額を確認してください');
    event.principal=principal;event.interest=amount-principal;
   }
   const matches=s.entries.filter(e=>!e.void&&e.ledgerIncluded&&e.type==='expense'&&e.payment===account.id&&e.amount===amount&&e.date===date);
   let next=s;
   if(d.entryId){
    const entry=find(matches,d.entryId);
    fail(!history.some(event=>event.entryId===entry.id),'この支出は充当済みです',409);
    event.entryId=entry.id;
   }else{
    fail(!matches.length,'同じ日・口座・金額の支出が登録済みです。既存の支出を選んでください',409);
    fail(!s.plans.some(plan=>plan.status==='planned'&&plan.payment===account.id&&plan.dueDate===date&&plan.amount===amount),'同じ引落予定があります。先に予定画面で確定し、既存の支出を選んでください',409);
    fail(accountBalance(s,account.id,date)>=amount&&accountBalance(s,account.id,now)>=amount,'支払元の残高が足りません');
    event.entryId='goal-'+op;
    next=applyBudgetCommand(s,{type:'entry.add',data:{id:event.entryId,type:'expense',bankEntry:true,date,amount,payment:account.id,category:text(d.category||'その他',100),memo:goal.name}},context);
   }
   find(next.savingsGoals,goal.id).scheduleAsOf=now;
   next.savingsGoalEvents.push(event);
   return next;
  }
  goal.scheduleAsOf=now;history.push(event);
  break;
 }
 case 'card.purchasePlan.save':{
  const plans=s.cardPurchasePlans||=[];
  const old=d.id?find(plans,d.id):null;
  const card=find(s.cards,d.cardId),name=text(d.name,100),date=day(d.useDate),amount=yenAmount(d.amount);
  monthDate(d.month,1);
  fail(card.accountId&&card.paymentDay&&name&&amount&&d.month>=date.slice(0,7)&&d.month>=now.slice(0,7),'カード・利用予定日・引落月と金額を確認してください');
  const statementMonth=d.statementMonth||null;
  if(statementMonth){monthDate(statementMonth,1);fail(statementMonth>=date.slice(0,7)&&statementMonth<=d.month,'利用月・請求月・引落月を確認してください');}
  let bill=s.bills.find(b=>b.cardId===card.id&&b.month===d.month);
  fail(!bill||bill.status==='planned'&&bill.actual===null,'引落済み・取消済み・請求額確定済みの月です');
  if(!bill){bill={...makeBill(s,card,d.month),purchaseOnly:true};s.bills.push(bill);}
  const next={id:old?.id||op,cardId:card.id,name,useDate:date,statementMonth,month:d.month,amount,status:'planned'};
  if(old){
   const {cardId,month}=old;
   Object.assign(old,next);
   if(cardId!==next.cardId||month!==next.month)removeUnusedPurchaseBill(s,cardId,month);
  }else plans.push(next);
  break;
 }
 case 'card.purchasePlan.status':{
  const plan=find(s.cardPurchasePlans||[],d.id);
  fail(['covered','cancelled'].includes(d.status),'支払予定の状態を確認してください');
  plan.status=d.status;
  if(d.status==='cancelled')removeUnusedPurchaseBill(s,plan.cardId,plan.month);
  break;
 }
 case 'savings.allocate':{
  const purpose=text(d.purpose,100),date=day(d.date),amount=yenAmount(d.amount,true);
  fail(!(s.savingsGoals||[]).some(goal=>goal.legacyPurpose===purpose),'この目的は新しい積立画面に引き継がれています');
  fail(purpose&&amount&&date<=now,'積立の目的・金額・日付を確認してください');
  (s.savingsAllocations||=[]).push({id:op,purpose,date,amount});
  break;
 }
 case 'advance.settle':{
  fail(Array.isArray(d.items)&&d.items.length>0&&new Set(d.items.map(item=>item.id)).size===d.items.length,'精算する明細を選んでください');
  const date=day(d.date);fail(date<=now,'精算日は今日以前にしてください');
  const items=d.items.map(item=>{
   const e=find(s.entries,item.id),received=yenAmount(item.received),waived=yenAmount(item.waived);
   fail(!e.void&&e.type==='advance'&&e.date<=date&&received+waived>0&&received+waived<=outstandingAdvance(s,e),'返金額と免除額を確認してください');
   return {id:e.id,received,waived};
  });
  const total=items.reduce((sum,item)=>sum+item.received,0);
  if(total){
   const a=find(s.accounts,d.accountId);
   fail(a.opening!==null&&date>=a.openingDate,'入金先の開始日と残高を確認してください');
   emit(s,op,date,'account',a.id,total,'立替精算');
  }
  (s.advanceSettlements||=[]).push({id:op,date,accountId:total?d.accountId:null,items});
  break;
 }
 case 'categories':fail(d.tree&&typeof d.tree==='object'&&!Array.isArray(d.tree),'カテゴリを確認してください');s.categories={tree:{...s.categories.tree,...clone(d.tree)},hidden:Array.isArray(d.hidden)?d.hidden:[],...(s.categories.income&&{income:s.categories.income})};break;
 default:throw new BudgetError('対応していない操作です',404);
 }
 for(const a of s.accounts)if(a.opening!==null)yenAmount(accountBalance(s,a.id,now),true);for(const c of s.cards)if(c.opening!==null)yenAmount(cardBalance(s,c.id,now),true);return s;
}
export function accountBalance(s,key,asOf){const a=find(s.accounts,key);if(a.opening===null||a.openingDate>asOf)return null;return a.opening+s.journal.filter(j=>j.scope==='account'&&j.target===key&&j.date<=asOf).reduce((n,j)=>n+j.delta,0);}
export function cardBalance(s,key,asOf){const c=find(s.cards,key);if(c.opening===null||!s.startDate||s.startDate>asOf)return null;return c.opening+s.journal.filter(j=>j.scope==='card'&&j.target===key&&j.date<=asOf).reduce((n,j)=>n+j.delta,0);}
export function budgetSummary(s,asOf,month=asOf.slice(0,7),basis='date',options={}){
 const cards=s.cards.map(c=>({...c,balance:cardBalance(s,c.id,asOf),bills:s.bills.filter(b=>b.cardId===c.id).map(b=>billProjection(s,b))}));
 const managedAccounts=new Set(s.accounts.filter(a=>a.opening!==null&&a.openingDate<=asOf).map(a=>a.id));
 const cashPlans=plannedCashFlows(s,asOf).active.filter(p=>p.date.slice(0,7)<=month&&
  (p.kind==='income'?p.date>=asOf:managedAccounts.has(p.from)&&managedAccounts.has(p.to)));
 const accounts=s.accounts.map(a=>{
  const plannedIn=cashPlans.filter(p=>p.to===a.id).reduce((n,p)=>n+p.amount,0);
  const plannedOut=cashPlans.filter(p=>p.kind==='transfer'&&p.from===a.id).reduce((n,p)=>n+p.amount,0);
  const pending=s.plans.filter(p=>p.payment===a.id&&p.status==='planned'&&p.dueDate.slice(0,7)<=month);
  const bills=cards.filter(c=>c.accountId===a.id).flatMap(c=>c.bills.filter(b=>b.status==='planned'&&b.dueDate.slice(0,7)<=month));
  const upcoming=pending.reduce((n,p)=>n+p.amount,0)+bills.reduce((n,b)=>n+b.projected,0);
  const balance=accountBalance(s,a.id,asOf);
  return {...a,balance,upcoming,plannedIn,plannedOut,forecast:balance===null?null:balance+plannedIn-upcoming-plannedOut,pendingCount:pending.filter(p=>p.dueDate<=asOf).length+bills.filter(b=>b.dueDate<=asOf).length};
 });
 const monthly=s.entries.filter(e=>!e.void&&(basis==='settleMonth'?e.settleMonth:e.date.slice(0,7))===month);let income=0,expense=0,saved=0;
 const category=Object.create(null),people=Object.create(null),categoryBreakdown=[];
 const addPart=(part,amount,kind)=>{
  const person=part.person||'未設定';
  category[part.category]=(category[part.category]||0)+amount;
  people[person]=(people[person]||0)+amount;
  categoryBreakdown.push({category:part.category,middle:part.middle||'',person,amount,kind:kind||'未設定'});
 };
 for(const e of monthly){
  if(['income','recovery'].includes(e.type)){if(e.type==='income'||!s.classificationVersion)income+=e.amount;continue;}
  if(s.classificationVersion&&e.type==='advance')continue;
  const sign=e.type==='refund'?-1:1;
  if(e.savingsKind){saved+=sign*e.amount;continue;}
  expense+=sign*e.amount;
  for(const part of e.splits)addPart(part,sign*part.amount,e.spendingKind);
 }
 for(const b of s.bills.filter(b=>b.status==='confirmed'&&b.dueDate.slice(0,7)===month&&b.adjustment&&b.adjustment.kind!=='points')){
  const value=b.adjustment.amount*(b.adjustment.kind==='fee'?1:-1);
  expense+=value;addPart({category:'カード調整'},value);
 }
 const savings=Object.create(null);
 for(const e of monthly.filter(e=>e.savingsKind)){
  for(const part of e.splits){const name=part.middle||'その他';savings[name]=(savings[name]||0)+(e.type==='refund'?-part.amount:part.amount);}
 }
 for(const e of s.savingsAllocations||[])if(e.date.slice(0,7)===month)savings[e.purpose]=(savings[e.purpose]||0)+e.amount;
 const settlements=(s.advanceSettlements||[]).filter(x=>x.date.slice(0,7)===month);
 const advanceReceived=settlements.flatMap(x=>x.items).reduce((sum,item)=>sum+item.received,0)+monthly.filter(e=>e.type==='recovery').reduce((sum,e)=>sum+e.amount,0);
 let waived=0;
 for(const settlement of settlements)for(const item of settlement.items){
  if(!item.waived)continue;
  const entry=s.entries.find(e=>e.id===item.id);
  waived+=item.waived;expense+=item.waived;
  let remaining=item.waived,weight=entry.amount;
  for(const part of entry.splits){
   const share=weight===part.amount?remaining:Number(BigInt(remaining)*BigInt(part.amount)/BigInt(weight));
   if(share)addPart(part,share,entry.spendingKind);
   remaining-=share;weight-=part.amount;
  }
 }
 const advances=s.entries.filter(e=>!e.void&&e.type==='advance').map(e=>({id:e.id,remaining:outstandingAdvance(s,e)}));
 const daily=dailySpending(s.entries,asOf);
 const schedule=monthlyScheduleStatus(s,month);
 const generation=missingBudgetMonths(s,asOf);
 const projectedState=forecastSchedules(s,asOf);
 const projectedCards=cards.map(card=>({...card,bills:projectedState.bills.filter(b=>b.cardId===card.id).map(b=>billProjection(projectedState,b))}));
 const unconfigured=s.cards.some(card=>!card.accountId||!card.paymentDay);
 const savingsGoals=savingsOverview(s,asOf);
 const funds=forecastFunds(s,accounts,projectedCards,asOf,unconfigured,projectedState.plans,savingsGoals);
 const cashflow={reserve:funds.reserves?.living??null,forecast:funds.monthEnd,available:funds.currentAllowance};
 const cardCharges=Object.fromEntries(s.plans.filter(p=>p.status==='confirmed'&&s.cards.some(c=>c.id===p.payment)).map(plan=>{
  const entry=s.entries.find(e=>e.id===plan.entryId&&!e.void);
  const billMonth=entry?.dueDate?.slice(0,7)||entry?.csvBilling?.month;
  const bill=s.bills.find(b=>b.cardId===plan.payment&&b.month===billMonth&&b.status!=='cancelled');
  return [plan.id,{month:billMonth||null,status:bill?.status==='confirmed'?'paid':bill?.actual!=null?'billed':'used'}];
 }));
 const installments=Object.fromEntries(s.rules.filter(r=>r.term).map(rule=>[rule.id,{...installmentProgress(s,rule),outside:s.plans.filter(plan=>plan.ruleId===rule.id&&plan.status==='planned'&&!ruleCoversMonth(rule,plan.month)).map(plan=>plan.month)}]));
 const known=accounts.some(a=>a.balance!==null),cardKnown=cards.every(c=>c.balance!==null),assets=known?accounts.filter(a=>a.balance!==null).reduce((n,a)=>n+a.balance,0):null,debt=cardKnown?cards.reduce((n,c)=>n+Math.max(0,c.balance),0):null;return {cashflow,funds,savingsGoals,spendingMonths:spendingMonthSummary(s,funds,asOf,options.defaultMonthlyBenefit),generation,installments,cardCharges,daily,accounts,cards,income,expense,category,people,categoryBreakdown,saved,savings,waived,advanceReceived,advances,assets,debt,net:assets===null||debt===null?null:assets-debt,unreconciled:cards.flatMap(c=>c.bills.filter(b=>b.status==='confirmed'&&b.reconciliation!==0)),basis,month,schedule};
}
export function legacyExport(s){const raw=s.legacy?.data?.entries?s.legacy.data:s.legacy||{version:6},entries=[];for(const e of s.entries.filter(e=>!e.void)){e.splits.forEach((p,i)=>entries.push({id:e.legacyIds?.[i]||e.id+':'+i,date:e.date,type:e.type,amount:p.amount,payment:s.cards.find(c=>c.id===e.payment)?.name||s.accounts.find(a=>a.id===e.payment)?.name||e.legacyPayment,category:p.category,categoryMiddle:p.middle,categorySmall:p.small,person:p.person,expenseNature:p.nature,memo:e.memo,settleMonth:e.settleMonth,counterparty:e.counterparty,linkedAdvanceId:e.linkedAdvanceId,...(e.splits.length>1?{receiptId:e.legacyKey?.replace(/^receipt:/,'')||e.id,receiptTotal:e.amount,splitIndex:i,splitCount:e.splits.length}:{})}));}const deletedIds=[...(raw.deletedIds||[]),...s.entries.filter(e=>e.void).flatMap(e=>e.legacyIds?.length?e.legacyIds:e.splits.map((_,i)=>e.id+':'+i)).map(id=>({id}))];const outputIds=new Set(entries.map(e=>e.id));for(const e of s.entries)for(const key of e.legacyIds||[])if(!outputIds.has(key))deletedIds.push({id:key});const represented=new Set(s.entries.flatMap(e=>e.legacyIds||[]));entries.push(...clone((raw.entries||[]).filter(e=>!represented.has(e.id))));return {...clone(raw),entries,deletedIds,categories:clone(s.categories),migrationIssues:clone(s.importIssues),preservedOriginal:clone(s.legacy)};}


export function missingBudgetMonths(s,asOf){
 const month=asOf.slice(0,7);
 return [month,shiftBillingMonth(month,1)].filter(target=>target<='2100-12').filter(target=>{
  const {fixed,cards}=missingMonthlyItems(s,target);
  return fixed.length>0||cards.length>0;
 });
}
