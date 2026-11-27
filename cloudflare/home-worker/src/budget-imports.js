// Import commands operate on a cloned owner state supplied by budget-core.
import {csvCandidates,merchantKey} from '../public/apps/household-budget/card-csv.js';
function requireValue(ok,message){if(!ok)throw Error(message);}
export function importFixedRules(s,d,{monthDate,ensureMonth,cleanEntry,now}){
 requireValue(d.confirm===true&&Array.isArray(d.rules)&&d.rules.length>0&&d.rules.length<=100,'引き継ぐ固定費と確認欄を確認してください');
 monthDate(d.month,1);s.fixedImportLinks||={};
 for(const item of d.rules){
  const raw=item.source,sourceId=String(raw?.id||'');
  requireValue(/^[\w.-]{1,100}$/.test(sourceId)&&!raw.deletedAt,'削除済みまたは不正な旧固定費です');
  if(Object.hasOwn(s.fixedImportLinks,sourceId))continue;
  requireValue(Number.isSafeInteger(raw.amount)&&raw.amount>0,'旧固定費の金額を確認してください');
  requireValue(s.accounts.some(a=>a.id===item.payment)||s.cards.some(c=>c.id===item.payment),'引落元を選んでください');
  monthDate(d.month,item.day);
  const name=String(raw.name||'').trim();requireValue(name&&name.length<=100,'固定費名を確認してください');
  if(item.replaceRuleId){
   const old=s.rules.find(r=>r.id===item.replaceRuleId);requireValue(old,'置換対象の固定費が見つかりません');old.enabled=false;
   for(const p of s.plans.filter(p=>p.ruleId===old.id&&p.status==='planned'&&p.month>=d.month)){p.status='cancelled';p.version++;p.reason='旧固定費との重複整理';}
  }
  const ruleId='legacy-fixed-'+sourceId;
  requireValue(!s.rules.some(r=>r.id===ruleId),'旧固定費の登録番号が重複しています');
  s.rules.push({id:ruleId,name,amount:raw.amount,payment:item.payment,day:item.day,category:raw.category||'その他',person:raw.person||'',variable:!!item.variable,enabled:true,needsReview:false,firstMonth:d.month,legacy:{id:sourceId,dateMode:raw.dateMode}});
  s.fixedImportLinks[sourceId]=ruleId;
  if(item.recordedEntry){
   const e=item.recordedEntry;
   requireValue(!e.void&&e.type==='expense'&&e.date?.slice(0,7)===d.month&&e.amount===raw.amount,'支払済み履歴との対応を確認してください');
   requireValue(e.payment===item.payment||e.payment===raw.payment,'支払済み履歴の支払元が一致しません');
   if(item.recordedKind==='old'&&!s.entries.some(x=>x.legacyIds?.includes(e.id))){
    const record=cleanEntry({...e,id:'fixed-recorded-'+sourceId,payment:item.payment,category:e.category||raw.category||'その他'},now);
    record.legacyIds=[e.id];record.balanceIncludedExternally=true;s.entries.push(record);
   }
   s.plans.push({id:'fixed:'+ruleId+':'+d.month,ruleId,month:d.month,name,payment:item.payment,category:raw.category||'その他',person:raw.person||'',amount:raw.amount,nominalDate:monthDate(d.month,item.day),dueDate:e.date,variable:!!item.variable,status:'excluded',version:1,recordedEntryId:e.id,reason:'既存の支払済み履歴に対応付け。残高へは再反映しません'});
  }else{
   requireValue(!s.entries.some(e=>!e.void&&e.payment===item.payment&&e.amount===raw.amount&&e.date.slice(0,7)===d.month),'同じ月・金額・支払元の履歴があります。支払済みとの対応を確認してください');
   requireValue(!s.plans.some(p=>p.status!=='cancelled'&&p.month===d.month&&p.payment===item.payment&&p.amount===raw.amount),'同じ月・金額・支払元の予定があります。置換対象を確認してください');
  }
 }
 ensureMonth(s,d.month);return s;
}
// Keep uncertain billing outside monthly bank-withdrawal forecasts.
function csvBilling(row,statementMonth){
 if(!row.paymentMonth)return null; // Retain replay compatibility with earlier commands.
 requireValue(typeof row.paymentMonth==='string','CSVの支払月を確認してください');
 const m=row.paymentMonth.normalize('NFKC').trim().match(/^(\d{1,2})月(以降)?$/);
 requireValue(m&&Number(m[1])>=1&&Number(m[1])<=12,'CSVの支払月を確認してください');
 const n=Number(m[1]),base=Number(statementMonth.slice(5));
 if(!m[2]){requireValue(n===base,'CSVの支払月と請求月を一致させてください');return {status:'confirmed',month:statementMonth};}
 const year=Number(statementMonth.slice(0,4))+(n<base?1:0);
 return {status:'pending',earliestMonth:year+'-'+String(n).padStart(2,'0')};
}
export function assignCardBilling(s,d,{monthDate,businessDate,ensureMonth}){
 requireValue(d.confirm===true,'カードの請求月を確認してください');monthDate(d.month,1);
 const ids=d.entryIds||[d.entryId];
 requireValue(Array.isArray(ids)&&ids.length>0&&ids.length<=s.entries.length&&new Set(ids).size===ids.length,'請求月を変更する明細を選んでください');
 const activeEntries=new Map(s.entries.filter(e=>!e.void).map(e=>[e.id,e]));
 const entries=ids.map(id=>activeEntries.get(id));
 const card=s.cards.find(c=>c.id===entries[0]?.payment);
 requireValue(card?.accountId&&card.paymentDay,'カードの支払日と引落口座を設定してください');
 const due=businessDate(monthDate(d.month,card.paymentDay),s.holidays);
 for(const entry of entries){
  const historical=entry?.csvImported&&!entry.ledgerIncluded&&s.startDate&&entry.date<s.startDate;
  requireValue(entry?.payment===card.id&&(historical||entry.csvBilling?.status==='pending'),'請求月を変更できる明細を選んでください');
  if(entry.csvBilling?.status==='pending')requireValue(d.month>=entry.csvBilling.earliestMonth,'CSVに表示された月以降を選んでください');
  if(historical&&entry.csvBilling?.status!=='pending')requireValue(due>=s.startDate,'残高管理の開始日以降に引き落とされる請求月を選んでください');
  requireValue(!s.bills.some(b=>b.cardId===card.id&&b.status==='confirmed'&&[entry.csvBilling?.month,d.month].includes(b.month)),'引落済みの請求月です。既存の引落を確認してください');
  entry.csvBilling={status:'confirmed',month:d.month};entry.dueDate=entry.ledgerIncluded?due:null;
 }
 if(entries.some(e=>e.ledgerIncluded)||s.startDate&&due>=s.startDate)ensureMonth(s,d.month);
 return s;
}
export function importCardRows(s,d,{cleanEntry,activeEntry,businessDate,monthDate,ensureMonth,now}){
 requireValue(d.confirm===true&&['pink','visa'].includes(d.cardId)&&Array.isArray(d.rows)&&d.rows.length<=500&&d.rows.length>0,'カードと取り込む明細を確認してください');
 monthDate(d.statementMonth,1);const card=s.cards.find(c=>c.id===d.cardId);requireValue(card,'カードが見つかりません');
 s.csvImports||={};const seen=new Set(),matched=new Set(d.rows.map(row=>s.csvImports[row.key]).filter(Boolean));
 for(const row of d.rows){
  requireValue(/^[a-f0-9]{64}$/.test(row.key)&&!seen.has(row.key),'明細の識別番号を確認してください');seen.add(row.key);
  const billing=csvBilling(row,d.statementMonth);
  if(s.csvImports[row.key]){
   const prior=s.entries.find(e=>e.id===s.csvImports[row.key]);
   if(prior?.csvBilling?.status==='pending'&&billing?.status==='confirmed')assignCardBilling(s,{entryId:prior.id,month:billing.month,confirm:true},{monthDate,businessDate,ensureMonth});
   continue;
  }
  requireValue(typeof row.merchant==='string'&&row.merchant.trim()&&row.merchant.length<=500,'店名を確認してください');
  requireValue(Number.isSafeInteger(row.signedAmount)&&row.signedAmount!==0,'明細金額を確認してください');
  const modern=Object.hasOwn(row,'remember')||!!s.classificationVersion;
  const amount=Math.abs(row.signedAmount),candidates=csvCandidates(s,d.cardId,row),used=Object.values(s.csvImports);
  if(row.action==='skip')continue;
  requireValue(billing||row.billingMonthNumber==null||(Number.isInteger(row.billingMonthNumber)&&row.billingMonthNumber>=1&&row.billingMonthNumber<=12&&row.billingMonthNumber===Number(d.statementMonth.slice(5))),'CSVの支払月と請求月を一致させてください');
  if(row.action==='match'){
   const match=candidates.find(e=>e.id===row.entryId);
   requireValue(match&&!matched.has(match.id)&&(!used.includes(match.id)||row.autoMatch===true&&merchantKey(match.merchant||match.memo)===merchantKey(row.merchant)),'対応する手入力の明細を確認してください');
   if(row.autoMatch===true)requireValue(merchantKey(match.merchant||match.memo)===merchantKey(row.merchant),'店名が一致しません');
   matched.add(match.id);
   if(match.csvBilling?.status==='pending'&&billing?.status==='confirmed')assignCardBilling(s,{entryId:match.id,month:billing.month,confirm:true},{monthDate,businessDate,ensureMonth});
   if(row.autoMatch===true&&used.includes(match.id))continue;
   if(billing?.status==='pending'){requireValue(!s.bills.some(b=>b.cardId===d.cardId&&b.status==='confirmed'&&b.month===match.dueDate?.slice(0,7)),'引落済みの明細です。確定済み取引は請求月未確定に変更できません');match.csvBilling=billing;match.dueDate=null;match.csvImported=true;}
   if(modern)match.merchant ||= row.merchant;
   s.csvImports[row.key]=match.id;if(!s.classificationVersion&&row.remember===undefined&&match.splits.length===1){s.merchantCategories||={};s.merchantCategories[merchantKey(row.merchant)]=match.splits[0].category;}continue;
  }
  requireValue(row.action==='add'||row.action==='plan','明細の扱いを選んでください');
  const pending=s.plans.filter(p=>p.status==='planned'&&p.payment===d.cardId&&p.amount===amount&&p.month===row.date.slice(0,7));
  const fixed=row.action==='plan'?pending.find(p=>p.id===row.planId):null;
  if(row.action==='plan')requireValue(fixed&&row.signedAmount>0,'対応するカード固定費を確認してください');
  if(row.action==='add')requireValue(!pending.length||row.separate===true,'同月同額のカード固定費があります。対応付けるか別の購入であることを確認してください');
  requireValue(!candidates.some(e=>!used.includes(e.id))||row.separate===true,'重複候補があります。別の購入であることを確認してください');
  requireValue(Object.hasOwn(s.categories.tree,row.category),'カテゴリを選んでください');
  requireValue(!row.middle||Object.hasOwn(s.categories.tree[row.category],row.middle),'中カテゴリを確認してください');
  requireValue(row.advance!==true||row.signedAmount>0&&typeof row.counterparty==='string'&&row.counterparty.trim(),'立替先を入力してください');
  const entry=cleanEntry({id:'csv-'+row.key,date:row.date,type:row.signedAmount<0?'refund':row.advance===true?'advance':'expense',counterparty:row.advance===true?String(row.counterparty||'').trim():'',amount:Math.abs(row.signedAmount),payment:d.cardId,category:row.category,middle:row.middle,person:row.person,spendingKind:row.spendingKind,savingsKind:row.savingsKind,purchase:row.purchase,merchant:modern?row.merchant:undefined,memo:row.merchant},now);
  const include=!!s.startDate&&entry.date>=s.startDate;
  activeEntry(s,entry,now,include);
  if(billing)entry.csvBilling=billing;
  else if(!include)entry.csvBilling={status:'confirmed',month:d.statementMonth};
  if(billing?.status==='pending')entry.dueDate=null;
  else if(include)entry.dueDate=businessDate(monthDate(d.statementMonth,card.paymentDay),s.holidays);
  if(fixed){fixed.status='confirmed';fixed.entryId=entry.id;fixed.version++;}
  if(!include&&s.startDate&&entry.date<s.startDate&&entry.csvBilling?.status==='confirmed'&&card.accountId&&card.paymentDay&&businessDate(monthDate(entry.csvBilling.month,card.paymentDay),s.holidays)>=s.startDate)ensureMonth(s,entry.csvBilling.month);
  entry.csvImported=true;s.csvImports[row.key]=entry.id;
  // A linked manual entry keeps its original classification and ledger effects.
  const key=merchantKey(row.merchant);s.merchantCategories||={};
  if(!s.merchantCategories[key]?.disabled&&row.remember===true){
   s.merchantCategories[key]={category:row.category,middle:entry.splits[0].middle,person:entry.splits[0].person};
  }else if(!modern)s.merchantCategories[key]=row.category;
 }
 return s;
}
