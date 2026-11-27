import {decodeCardCsv,parseRakutenCsv,fingerprint,csvCandidates,suggestCategory,merchantKey,matchCsvRows} from './card-csv.js';
import {dailySpending} from './daily-spending.js';

const $=id=>document.getElementById(id),root=$('app'),dialog=$('dialog');
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const yen=n=>n===null||n===undefined?'未設定':n.toLocaleString('ja-JP')+'円';
let calendarStatus={enabled:false,pending:0};
let spendingDate='';
let data,summary,revision=0,userId='',today='',tab=['accounts','entries'].includes(new URL(location.href).searchParams.get('tab'))?new URL(location.href).searchParams.get('tab'):'home',accountId='',month='',basis='date',busy=false,inMemoryPending=null;
const api='/api/household-budget';
let entryViewMonth='',accountViewMonth='',loadSequence=0;
const expandedAccounts=new Set();
const defaultPeople=['自分','長女','次女','祖父','祖母','犬','家族共通','その他'];
const spendingKinds=['計画的','予定外','突発的'];
function error(e){const n=el('p',e.message||'操作できませんでした','error');n.setAttribute('role','alert');if(dialog.open){dialog.querySelectorAll('[role="alert"]').forEach(old=>old.remove());dialog.prepend(n);}else $('message').replaceChildren(n);}
function note(text){$('message').replaceChildren(el('p',text,'notice'));}
function button(label,action,cls=''){const b=el('button',label,cls);b.type='button';b.onclick=async()=>{b.disabled=true;try{await action();}catch(e){error(e);}finally{b.disabled=false;}};return b;}
function section(title,host=root){const s=el('section');if(title)s.append(el('h2',title));host.append(s);return s;}
function field(host,label,type='text',value='',required=false){const l=el('label',label),n=el(type==='textarea'?'textarea':'input');if(type!=='textarea')n.type=type;n.value=value;n.required=required;if(type==='number'){n.step=1;n.inputMode='numeric';}l.append(n);host.append(l);return n;}
function select(host,label,items,value=''){const l=el('label',label),s=el('select');s.setAttribute('aria-label',label);for(const item of items){const [id,text]=Array.isArray(item)?item:[item,item];s.append(new Option(text,id));}s.value=value;l.append(s);host.append(l);return s;}
function modal(title){dialog.replaceChildren(button('閉じる',()=>dialog.close()),el('h2',title));if(!dialog.open)dialog.showModal();}
function closePrivate(){data=null;summary=null;expandedAccounts.clear();root.replaceChildren();dialog.replaceChildren();if(dialog.open)dialog.close();}
async function request(path='',method='GET',value){const r=await fetch(api+path,{method,cache:'no-store',headers:{'Content-Type':'application/json',...(userId?{'X-Budget-User':userId}:{})},body:value===undefined?undefined:JSON.stringify(value)});let payload;try{payload=await r.json();}catch{throw Error('応答を確認できません。同じ操作を重ねず、再試行してください。');}if(r.status===401||r.status===403){closePrivate();throw Error(payload.error||'HOME本人のログインを確認してください');}if(!r.ok){const e=Error(payload.error||'操作できませんでした');e.status=r.status;throw e;}return payload;}
const pendingKey=()=> 'budget-pending:'+userId;
function pending(){try{return JSON.parse(sessionStorage.getItem(pendingKey())||'null')||inMemoryPending;}catch{return inMemoryPending;}}
function remember(value){inMemoryPending=value;try{if(value)sessionStorage.setItem(pendingKey(),JSON.stringify(value));else sessionStorage.removeItem(pendingKey());}catch{}}
async function send(type,values,token=crypto.randomUUID(),exact){if(busy)throw Error('処理中です');const body=exact||{eventId:token,command:{type,data:{...values,expectedRevision:revision}}},old=pending();if(old&&old.eventId!==body.eventId)throw Error('未確認の操作があります。ホームの再試行から確認してください');busy=true;remember(body);try{await request('/command','POST',body);remember(null);}catch(e){if(e.status&&e.status<500)remember(null);throw e;}finally{busy=false;}}
function commandButton(label,type,values,cls=''){let body;return button(label,async()=>{if(!body)body={eventId:crypto.randomUUID(),command:{type,data:{...values,expectedRevision:revision}}};await send(type,values,body.eventId,body);body=null;await load();if(dialog.open)dialog.close();},cls);}
function saveForm(form,label,type,collect,onSaved,afterLoad){const b=el('button',label,'primary');b.type='submit';form.append(b);let body;form.onsubmit=async e=>{e.preventDefault();if(busy)return;b.disabled=true;try{if(!body){const values=await collect();body={eventId:crypto.randomUUID(),command:{type,data:{...values,expectedRevision:revision}}};}await send(type,body.command.data,body.eventId,body);onSaved?.(body.command.data);body=null;await load();if(afterLoad)afterLoad();else dialog.close();note('保存しました'+(type.startsWith('entry.')?' ／ 今日使った金額 '+yen(summary.daily?.spent):''));}catch(err){if(err.status&&err.status<500)body=null;error(err);}finally{b.disabled=false;}};}
function amount(input,{signed=false,optional=false}={}){if(input.value===''&&optional)return null;const n=Number(input.value);if(input.value===''||!Number.isSafeInteger(n)||!signed&&n<0)throw Error('金額を整数の円で入力してください');return n;}
function payName(id){return data.cards.find(c=>c.id===id)?.name||data.accounts.find(a=>a.id===id)?.name||id;}
function payments(){return [...data.cards.map(c=>[c.id,c.name]),...data.accounts.map(a=>[a.id,a.name])];}
function row(host,title,value,detail){const r=el('div',undefined,'row'),d=el('div');d.append(el('strong',title));if(detail)d.append(el('p',detail,'muted'));r.append(d,el('strong',value));host.append(r);return r;}
function metric(host,label,value){const p=el('p',undefined,'metric');p.append(el('span',label),el('strong',yen(value),value<0?'negative':''));host.append(p);}
function details(host,title){const d=el('details');d.append(el('summary',title));host.append(d);return d;}
async function load(){const sequence=++loadSequence;const value=await request('?'+new URLSearchParams({...(month?{month}:{}),...(tab==='accounts'?{accountMonth:accountViewMonth||today.slice(0,7)||'current'}:{}),basis}));if(sequence!==loadSequence)return;if(userId&&userId!==value.userId){closePrivate();inMemoryPending=null;spendingDate='';accountViewMonth='';}userId=value.userId;calendarStatus=value.calendar||{enabled:false,pending:0};data=value.data;summary=value.summary;revision=value.revision;today=value.today;month=month||today.slice(0,7);
 if(!pending()){for(const targetMonth of summary.generation||[]){try{await send('plans.generate',{month:targetMonth});return load();}catch(e){if(e.status!==409)throw e;break;}}}render();await openBudgetLink();}
function nextMonth(m){const [y,n]=m.split('-').map(Number);return new Date(Date.UTC(y,n,1)).toISOString().slice(0,7);}
function render(){root.classList.toggle('budget-home-layout',tab==='home');root.replaceChildren();$('nav').replaceChildren(...[['home','ホーム'],['entries','収支'],['accounts','口座'],['plans','予定'],['fixed','固定費'],['cards','カード'],['savings','積立'],['stats','集計'],['settings','設定']].map(([id,label])=>button(label,async()=>{tab=id;accountId='';if(id!=='stats'){month=today.slice(0,7);basis='date';await load();}else render();},tab===id?'active':'')));
 const unfinished=pending();if(unfinished){const s=section('前回の操作を確認してください');s.append(el('p','通信が途切れた可能性があります。同じ操作番号で再試行するため二重には反映しません。','notice'),button('前回と同じ内容で再試行',async()=>{await send(unfinished.command.type,unfinished.command.data,unfinished.eventId,unfinished);await load();},'primary'));return;}
 if(!data.startDate&&tab==='home'){const s=section('残高管理はまだ開始していません');s.append(el('p','既存の収支を引き継いでも、口座残高へは自動反映しません。開始日の取引前残高とカード未払金を確認してから開始します。','notice'),button('開始残高を設定',startForm,'primary'),button('既存のデータを引き継ぐ',importForm));}
 if(tab==='home')home();if(tab==='entries')entriesPage();if(tab==='accounts')accountsPage();if(tab==='plans')cashPlansPage();if(tab==='fixed')fixedPage();if(tab==='cards')cardsPage();if(tab==='savings')savingsPage();if(tab==='stats')statsPage();if(tab==='settings')settingsPage();}
function dailyTotal(host){
 const box=el('section',undefined,'card');
 const title=el('h2'), controls=el('div',undefined,'pay-buttons');
 const picker=field(controls,'合計を確認する日','date');
 picker.max=today;
 const total=el('p',undefined,'amount'), detail=el('p',undefined,'muted'), refund=el('p',undefined,'muted');
 total.setAttribute('aria-live','polite');
 function selectDate(date){
  spendingDate=date&&date<today?date:'';
  update();
 }
 function moveDate(days){
  const date=new Date((spendingDate||today)+'T00:00:00Z');
  date.setUTCDate(date.getUTCDate()+days);
  selectDate(date.toISOString().slice(0,10));
 }
 const previous=el('button','← 前の日'),next=el('button','次の日 →');
 previous.type=next.type='button';
 previous.onclick=()=>moveDate(-1);
 next.onclick=()=>moveDate(1);
 const reset=button('今日に戻る',()=>selectDate(''));
 controls.prepend(previous);
 controls.append(next,reset);
 picker.addEventListener('change',()=>selectDate(picker.value));
 function update(){
  const date=spendingDate||today;
  const daily=dailySpending(data.entries,date);
  picker.value=date;
  next.disabled=date>=today;
  reset.hidden=date===today;
  title.textContent=date===today?'今日使った金額':'この日に使った金額';
  total.textContent=yen(daily.spent);
  detail.textContent=date+'・登録済み '+daily.count+'取引（立替を含む）';
  refund.hidden=daily.refund===0;
  refund.textContent='返金 '+yen(daily.refund)+'（使った金額とは別表示）';
 }
 box.append(title,controls,total,detail,refund,el('small','カードは利用日の金額です。口座振替・カード代金の引落は加算しません。'));
 host.append(box);
 update();
}
function openBudgetTab(name){
 tab=name;accountId='';month=today.slice(0,7);basis='date';return load();
}
function fundSource(host,item){
 const amount=item.unknown?'金額未確認':yen(item.amount)+(item.uncertain?'（暫定）':'');
 const r=row(host,item.name,amount,(item.originalDate||item.date)+(item.overdue?'（予定日経過・未確定）':'')+'・'+payName(item.from||item.to)+(item.virtual?'・生成前の予定見込':''));
 r.append(button('根拠を確認',()=>openFundingSource(item)));
}
function openFundingSource(item){
  if(item.kind==='bill'){
   const bill=data.bills.find(b=>b.id===item.id);
   if(bill){billForm(bill);return;}
   return openBudgetTab('cards');
  }
  if(item.kind==='plan'){
   const plan=data.plans.find(p=>p.id===item.id);
   if(plan){modal(plan.name);planRow(dialog,plan);return;}
   return openBudgetTab('fixed');
  }
  const plan=(data.cashPlans||[]).find(p=>p.id===item.id);
  if(plan)cashPlanDetail(plan);
}
function fundsForm(targetMonth=today.slice(0,7)){
 const month=typeof targetMonth==='string'?targetMonth:today.slice(0,7),funds={reserves:data.fundReserves?.[month]};
 modal(monthLabel(month)+'の生活費・確保額');
 const f=el('form'),living=field(f,'カード・支払予定に含まれない生活費（円）','number',funds.reserves?.living??'',true);
 f.append(el('p','今後の支払いに別途残すお金だけを登録します。すでに引落予定にある支払いは、ここへ重ねて入れないでください。生活費が不要なら0円を入力してください。','notice'));
 const carry=field(f,'次月へ残す繰越確保額（円、不要なら0）','number',funds.reserves?.carry??'',true);
 const list=el('div');f.append(list);
 const goals=[];
 function addGoal(goal={}){
  const group=el('div'),name=field(group,'用途（旅行・返済など）','text',goal.name||'',true),value=field(group,'確保額（円）','number',goal.amount??'',true);
  const fields={group,name,value};goals.push(fields);
  group.append(button('この用途を外す',()=>{goals.splice(goals.indexOf(fields),1);group.remove();}));
  list.append(group);
 }
 for(const goal of funds.reserves?.goals||[])addGoal(goal);
 f.append(button('＋ 確保する用途を追加',()=>addGoal()));
 saveForm(f,'保存','cashflow.funds',()=>({month,living:amount(living),carry:amount(carry),goals:goals.map(goal=>({name:goal.name.value,amount:amount(goal.value)}))}));
 dialog.append(f);
}
function monthlyFunding(funds){
 const panel=section('今月末までに必要な資金移動');
 const shortages=funds.accountForecasts.flatMap(account=>account.needs.map(need=>({...need,accountId:account.accountId})))
  .sort((a,b)=>a.date.localeCompare(b.date));
 const timing=funds.accountForecasts.some(account=>account.currentDays.some(day=>day.sameDay));
 if(shortages.length){
  metric(panel,'今月の準備額 合計'+(funds.monthTentative?'（暫定）':''),shortages.reduce((sum,need)=>sum+need.additional,0));
  for(const need of shortages)row(panel,payName(need.accountId)+' に '+dateWithSlashes(need.date).slice(5)+' までに準備',
   yen(need.additional),need.additional===need.total?'登録済みの入金・振替予定を含む見込':'前回分と合わせて '+yen(need.total));
 }else if(funds.currentUnknown||funds.currentAssets===null){
  panel.append(el('p','今月末までに必要な金額は確認待ちです。','notice'));
 }else{
  panel.append(el('p','今月末までの支払いは足りる見込み'+(funds.monthTentative?'（暫定）':''),'notice'));
 }
 if(funds.currentUnknown&&shortages.length)panel.append(el('p','未確認の予定があるため、必要額が増える場合があります。','muted'));
 if(timing)panel.append(el('p','同日の入金・振替を使う口座があります。引落前に着金するか確認してください。','notice'));
 if(funds.accountForecasts.some(account=>account.requiredWithoutPending>account.required)){
  panel.append(el('p','入金や振替が実行されなかった場合の不足は、口座ごとの内訳で確認できます。','muted'));
 }
 if(shortages.length||timing)panel.append(button('入金・振替予定を確認',()=>openBudgetTab('plans')));
 const breakdown=details(panel,'口座ごとの引落・入金・振替の内訳');
 breakdown.append(el('p','確定済みの入金・振替は現在残高に含まれます。同日の複数の引落は合計で表示します。','muted'));
 for(const account of funds.accountForecasts.filter(account=>account.currentDays.length)){
  const group=details(breakdown,payName(account.accountId));
  metric(group,'現在の口座残高',account.currentBalance);
  for(const day of account.currentDays){
   group.append(el('h3',day.date+(day.uncertain||day.sameDay||day.balance!==day.withoutPending?'（暫定）':'')));
   metric(group,'この日の処理前の予測残高',day.before);
   metric(group,'この日の引落予定額'+(day.unknown?'（金額未確認分あり）':''),day.payments);
   if(day.plannedIncome)metric(group,'入金予定（未入金）',day.plannedIncome);
   if(day.transferIn)metric(group,'振替入金予定（未実行）',day.transferIn);
   if(day.transferOut)metric(group,'振替出金予定（未実行）',day.transferOut);
   metric(group,'処理直後の予測残高',day.balance);
   if(day.balance!==day.withoutPending)metric(group,'予定入金・振替入金が未着金の場合',day.withoutPending);
   metric(group,'この日までに必要な不足額'+(day.unknown?'（判明分）':''),day.shortage);
   for(const item of day.items)fundSource(group,item);
  }
 }
}
function dateWithSlashes(date){
 return date.replaceAll('-','/');
}
function monthEndBreakdown(host,funds){
 const panel=details(host,'今月末の残高見込の内訳');
 const totals=funds.monthEndTotals;
 if(funds.currentAssets===null){
  panel.append(el('p','口座の開始残高を設定すると内訳を確認できます。','muted'));
  return;
 }
 metric(panel,'現在の口座・現金残高 合計',funds.currentAssets);
 metric(panel,'＋ 今月の入金予定（未入金）',totals.plannedIncome);
 metric(panel,'＋ 今月の振替入金予定',totals.transferIn);
 metric(panel,'－ 今月の振替出金予定',totals.transferOut);
 metric(panel,'－ 今月の引落・支払予定',totals.payments);
 metric(panel,'＝ 今月末の残高見込',funds.monthEnd);
 panel.append(el('p','確定済みの入出金は現在残高に含まれます。管理中の口座間の振替は、入金と出金が相殺されます。','muted'));
 const excludedAccounts=data.accounts.filter(account=>!funds.accountForecasts.some(current=>current.accountId===account.id));
 if(excludedAccounts.length)panel.append(el('p','残高の集計対象外（開始残高未設定または開始日前） '+excludedAccounts.map(account=>account.name).join('、'),'muted'));
 if(funds.currentUnknown)panel.append(el('p','未確認の取引・予定があるため、下の「要確認」も確認してください。','notice'));
 const accounts=details(panel,'口座ごとの今月末残高');
 accounts.classList.add('budget-month-end-accounts');
 for(const account of funds.accountForecasts){
  const item=row(accounts,payName(account.accountId),yen(account.monthEnd),'現在残高 '+yen(account.currentBalance));
  item.append(button('口座の記録を確認',()=>{tab='accounts';accountViewMonth=today.slice(0,7);accountId=account.accountId;return load();}));
 }
 const managed=new Set(funds.accountForecasts.map(account=>account.accountId));
 const items=funds.rows.filter(item=>item.date.slice(0,7)===today.slice(0,7)&&(managed.has(item.from)||managed.has(item.to)));
 if(items.length){
  const movements=details(panel,'計算に使った今月の予定');
  for(const item of items)fundSource(movements,item);
 }
 const excluded=[
  ...(funds.overdueIncome||[]),...(funds.duplicateIncome||[]),...(funds.duplicateTransfers||[]),...(funds.untrackedTransfers||[]),
  ...(data.cashPlans||[]).filter(item=>funds.benefitConflicts.some(conflict=>conflict.ids.includes(item.id))),
 ].filter(item=>item.date.slice(0,7)<=today.slice(0,7));
 if(excluded.length){
  const omitted=details(panel,'残高見込から外した入金・振替予定');
  for(const item of new Map(excluded.map(item=>[item.id,item])).values())fundSource(omitted,item);
 }
}
function monthlyBenefitForm(rule){
 modal('毎月の手当を設定');
 const f=el('form'),enabled=field(f,'手当の見込を自動で入れる','checkbox');
 enabled.checked=rule?.enabled??true;
 const even=field(f,'偶数月の手当（円）','number',rule?.even??0,true);
 const odd=field(f,'奇数月の手当（円）','number',rule?.odd??0,true);
 f.append(el('p','実際の入金・入金予定を登録した月は、その記録を使います。自動見込は月別の収支に表示されます。','muted'));
 saveForm(f,'手当の設定を保存','cashflow.monthlyBenefit',()=>({enabled:enabled.checked,even:amount(even),odd:amount(odd)}));
 dialog.append(f,commandButton('自動設定を削除','cashflow.monthlyBenefit',{enabled:false,even:0,odd:0}));
}
function monthLabel(value){
 const [year,number]=value.split('-');
 return year+'年'+Number(number)+'月';
}
function spendingMonths(host=root){
 const monthly=summary.spendingMonths;
 if(!monthly)return;
 const sectionRoot=section('引落月で見る収支',host);
 sectionRoot.append(button('手当の設定を変更',()=>monthlyBenefitForm(monthly.rule)));
 for(const [index,m] of monthly.months.entries()){
  const box=index?details(sectionRoot,monthLabel(m.month)+'の見通し'):section(monthLabel(m.month),sectionRoot);
  metric(box,'前月からの繰り越し（前月給与分を除く）',m.carry);
  metric(box,'＋ '+monthLabel(m.payrollMonth)+'の給与',m.salaryKnown?m.salary:null);
  if(!m.salaryKnown)box.append(el('p','給与の入金記録・予定を確認してください。開始残高に含めている分は繰り越し側に入ります。','muted'));
  metric(box,'＋ '+Number(m.month.slice(5))+'月の手当'+(m.items.some(item=>item.kind==='benefit'&&item.status==='estimate')?'（自動見込）':''),m.benefitUnresolved?null:m.benefit);
  if(m.other)metric(box,'その他の入金・残高調整',m.other);
  metric(box,'－ 口座引落・口座からの支出',m.payments.bank);
  metric(box,'－ 現金支出',m.payments.cash);
  metric(box,'－ この月に引き落とされるカード代',m.payments.card);
  metric(box,'支出合計',m.payments.bank+m.payments.cash+m.payments.card);
  metric(box,'＝ 次月繰り越し'+(m.uncertain?'（見込）':''),m.remaining);
  const list=details(box,'収入・支出の明細');
  for(const item of m.items)row(list,item.name,item.unknown?'金額未確認':yen(item.amount),
   [item.date,{posted:'反映済み',planned:'予定',estimate:'自動見込'}[item.status]].filter(Boolean).join(' ・ '));
 }
 sectionRoot.append(el('p','給与は入金月の翌月、手当は入金月、カード代は銀行からの引落月に集計します。口座間の振替は収支から除きます。','muted'));
}
function incomeOutlookForm(monthOnly=false){
 const budget=summary.cardBudget;
 if(!budget)return;
 modal(monthOnly?monthLabel(budget.month)+'に使う収入見込み':'収入見込みの基本設定');
 const f=el('form');
 f.append(el('p','給与は標準で前月入金分を翌月の予算に使います。金額・入金月・日・入金先を確認してください。見込みの保存だけでは残高やカレンダーは変わりません。入金記録は給与・手当・養育費の名称やカテゴリで照合します。未分類の入金は収支画面で分類を確認してください。','notice'));
 const fields=[];
 for(const r of budget.rules){
  const group=el('fieldset');group.append(el('legend',r.name+(r.frequency==='even'?'（偶数月入金）':r.frequency==='odd'?'（奇数月入金）':'')));f.append(group);
  const override=data.incomeOutlook?.months?.[budget.month]?.[r.id];
  const source=monthOnly?{...r,...override}:r;
  if(monthOnly&&r.frequency!=='monthly'&&(Number(budget.month.slice(5))%2===(r.frequency==='even'?1:0))){group.disabled=true;group.append(el('p','この月は入金対象外です。予算に加算しません。','muted'));}
  const enabled=field(group,monthOnly?'この月の見込みを使う':'見込みを有効にする','checkbox');enabled.checked=source.enabled;
  const value=field(group,'見込額（円）','number',source.amount,true);
  let date,day,offset;
  if(monthOnly){
   const found=budget.incomes.find(i=>i.id===r.id);
   date=field(group,'実際の入金予定日','date',override?.date||found?.date||'');
   if(found?.status==='posted'||found?.status==='planned')group.append(el('p','登録済みの入金・予定が優先されます。金額の修正は収支・予定画面で行ってください。','muted'));
  }else{
   if(r.id==='salary'||r.id==='maintenance')offset=select(group,'予算に使う収入の入金月',[[-1,'予算月の前月に入金'],[0,'予算月に入金']],String(r.receiptOffset));
   day=field(group,'入金予定日（1〜31、31は月末／未定なら空欄）','number',r.day??'');day.min=1;day.max=31;
  }
  const account=select(group,'入金先',[['','未設定'],...data.accounts.map(a=>[a.id,a.name])],source.accountId||'');
  fields.push({r,enabled,value,date,day,offset,account});
 }
 saveForm(f,'収入見込みを保存',monthOnly?'cashflow.incomeMonth':'cashflow.incomeRules',()=>{
  const rows=fields.map(x=>({id:x.r.id,enabled:x.enabled.checked,amount:amount(x.value),accountId:x.account.value,
   ...(monthOnly?{date:x.date.value||null}:{day:amount(x.day,{optional:true}),receiptOffset:x.offset?Number(x.offset.value):0})}));
  return monthOnly?{month:budget.month,items:rows}:{rules:rows};
 });
 dialog.append(f);
 if(monthOnly)dialog.append(commandButton('この月の個別設定を解除','cashflow.incomeMonth.reset',{month:budget.month}));
}
function nextCardBudget(host,funds){
 const b=summary.cardBudget;if(!b)return;
 const panel=el('div',undefined,'next-card-budget');host.append(panel);
 panel.append(el('h3',monthLabel(b.month)+'の収入・楽天カード予算（暫定）'));
 const total=rows=>rows.reduce((n,x)=>n+x.amount,0);
 const incomeGrid=el('div',undefined,'income-budget-grid');panel.append(incomeGrid);
 metric(incomeGrid,'翌月に使う給与',b.incomes.some(i=>i.id==='salary'&&i.status==='unset')?null:total(b.incomes.filter(i=>i.id==='salary')));
 metric(incomeGrid,'翌月の手当',b.incomes.some(i=>['child','support'].includes(i.id)&&i.status==='unset')?null:total(b.incomes.filter(i=>['child','support'].includes(i.id))));
 metric(incomeGrid,'その他の収入見込',total(b.incomes.filter(i=>!['salary','child','support'].includes(i.id))));
 metric(incomeGrid,'翌月の総資金見込',b.totalFunds);
 if(!b.configured)panel.append(button('収入見込みを設定',()=>incomeOutlookForm(false),'primary'));
 metric(panel,'楽天カード引落予算（2枚合計）',b.totalFunds===null?null:Math.max(0,(b.estimate??0)+b.registered));
 metric(panel,'登録済みカード請求見込',b.registered);
 panel.append(el('p','あとカードで使える金額','muted'),el('p',b.usable===null?'算出不可／要確認':yen(b.usable),'amount'));
 if(b.shortage>0)panel.append(el('p','登録済みの金額に対する予算不足 '+yen(b.shortage),'notice'));
 panel.append(el('p','この引落月に入るカード利用分の予算です。見込み収入に基づく暫定額で、現在すぐ使える預金額とは異なります。','muted'));
 const messages={savings:'積立の確保元・重複した確保額を確認してください。',incomeSettings:'収入見込みの基本設定を確認して保存してください。',reserves:'翌月の生活費・繰越確保額が未設定です。不要な場合も0円で設定してください。',currentReserves:'今月の残り生活費・確保額が未設定です。',currentUnknown:'今月の繰越計算に未確認項目があります。',unassigned:'請求月未確定の利用・未反映予定があります。',payments:'支払い額やカード明細の照合を確認してください。',card:'楽天カード2枚の請求見込みを確認してください。',incomeConflict:'実績と入金予定、または複数の入金予定が重なっています。見込みの重複加算はしていません。',benefitConflict:'同月の手当が重複する候補があります。入金記録・予定を確認してください。',incomeDate:'入金日が未設定のため、引落日に間に合うかは未確認です。',incomeAccount:'入金先が未設定のため、口座別の資金確認が必要です。',overdueIncome:'予定日を過ぎた未入金の見込みがあります。入金状況を確認してください。',timing:'月間予算とは別に、引落前の口座への準備が必要です。'};
 if(b.usable===null)panel.append(el('p','設定・登録状況の確認が必要です。内訳の確認事項 '+b.issues.length+'件をご確認ください。','notice'));
 if(b.issues.includes('timing'))panel.append(el('p',messages.timing,'notice'));
 const d=details(panel,'予算の計算内訳・設定'+(b.issues.length?'（確認 '+b.issues.length+'件）':''));
 for(const code of b.issues)d.append(el('p',messages[code]||code,'notice'));
 metric(d,'繰越資金（下記の給与等を除く）',b.carry);
 for(const item of b.incomes)row(d,'＋ '+item.name,yen(item.amount),[item.date||'入金日未設定',item.accountId?payName(item.accountId):'入金先未設定',{posted:'入金済み・残高内数',planned:'登録済み予定',estimate:'見込み',unset:'未設定'}[item.status]].join(' ／ '));
 if(b.embedded)d.append(el('p','給与等 '+yen(b.embedded)+' は月末残高計算に反映済みです。内訳では繰越と分け、予算には一度だけ含めています。','muted'));
 metric(d,'＝ 総資金見込',b.totalFunds);
 metric(d,'－ カード以外の支払予定・他のカード引落',b.otherPayments);
 metric(d,'－ 現金生活費等',b.living);
 metric(d,'－ 旅行・返済等の確保額',b.goals);
 metric(d,'－ 翌々月への繰越確保額',b.carryReserve);
 metric(d,'－ 積立予定',b.saving);
 metric(d,'－ 楽天カード請求見込',b.registered);
 metric(d,'＝ 差引見込（未設定項目は別途要確認）',b.estimate);
 for(const item of b.rakuten)metric(d,item.name,item.amount);
 for(const t of b.timing)row(d,payName(t.accountId)+' '+t.date+'まで',t.shortage?yen(t.shortage)+'追加準備': '同日入金の順序を確認','引落前 '+yen(t.before)+' ／ 支払い '+yen(t.payments)+' ／ 入金予定 '+yen(t.income));
 d.append(button('収入見込みの基本設定',()=>incomeOutlookForm(false)));
 if(b.configured)d.append(button('この月だけ収入を変更',()=>incomeOutlookForm(true)));
 d.append(button('翌月の生活費・繰越確保額を設定',()=>fundsForm(b.month)),button('入金・振替予定を確認',async()=>{tab='plans';await load();}),button('カード請求見込を確認',async()=>{tab='cards';await load();}));
}

function cashflowHome(){
 const funds=summary.funds;
 if(!funds?.accountForecasts)return;
 const start=root.children.length;
 monthlyFunding(funds);
 const fundingPanel=root.children[start];
 fundingPanel.classList.add('budget-funding-panel');
 const monthly=section('今月末の残高見込'+(funds.monthTentative?'（暫定）':''));
 monthly.classList.add('budget-month-end-panel');
 monthly.append(el('p',yen(funds.monthEnd),'amount'));
 monthEndBreakdown(details(monthly,'残高の内訳'),funds);
 const s=section('来月への繰越見込額');
 s.classList.add('budget-hero');
 root.insertBefore(s,fundingPanel);

 const estimate=funds.currentAllowanceEstimate;
 const provisional=funds.currentAllowance===null;
 const shown=provisional?estimate:funds.currentAllowance;
 s.append(el('p',shown==null?'口座残高の設定が必要です':yen(Math.max(0,shown)),'amount'));
 if(provisional&&shown!=null)s.append(el('p','暫定・未確認の支払い等により、実際の繰越額は変動します。','notice'));
 if(estimate!=null&&estimate<0)s.append(el('p','登録済みの金額でも '+yen(-estimate)+' 不足しています。','notice'));
 nextCardBudget(s,funds);
 const calc=details(s,'今月の計算内訳');
 const balanceDetails=details(calc,'現在の口座・現金合計　'+yen(funds.currentAssets));
 for(const account of funds.accountForecasts)metric(balanceDetails,payName(account.accountId),account.currentBalance);
 const paymentDetails=details(calc,'－今月までの残りの支払い　'+yen(funds.currentPayments));
 const groups=new Map();
 for(const item of funds.rows||[]){
  if(!['bill','plan'].includes(item.kind)||item.date.slice(0,7)>today.slice(0,7))continue;
  const key=item.from||'';
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(item);
 }
 for(const [id,items] of groups){
  const total=items.reduce((sum,item)=>sum+item.amount,0);
  const group=details(paymentDetails,(id?payName(id):'引落口座未設定')+'　'+yen(total));
  for(const item of items)row(group,item.name,yen(item.amount),(item.originalDate||item.date)+(item.unknown?' ／ 金額未確認':item.uncertain||item.virtual||item.review?' ／ 暫定':'')+(item.overdue?' ／ 期限経過':''));
 }
 if(!groups.size)paymentDetails.append(el('p','登録済みの残りの支払いはありません。','muted'));
 const groupedTotal=[...groups.values()].flat().reduce((sum,item)=>sum+item.amount,0);
 if(groupedTotal!==funds.currentPayments)paymentDetails.append(el('p','内訳と支払合計に差があります。確認してください。','notice'));
 if(funds.currentReserved==null)calc.append(el('p','生活費・確保額：未設定（暫定額から未控除）','notice'));
 else metric(calc,'－生活費・確保額',funds.currentReserved);
 metric(calc,'－積立の確保済み資金',funds.savingsReserved);
 metric(calc,'－今月までの積立予定',funds.currentSavings);
 if(estimate!=null)metric(calc,'差引残額（登録済み分）',estimate);
 const futureAllowance=details(s,'来月以降のカード引落も考慮する場合');
 row(futureAllowance,'今後のカード引落も確保した使用可能額（暫定）',funds.cardAllowance===null?'算出不可／要確認':yen(funds.cardAllowance));
 s.append(el('p','現在の残高から今月の残りの支払い・設定済みの生活費・確保額を差し引いた目安です。未入金の収入は含みません。','muted'));
 futureAllowance.append(el('p',funds.horizon+' までの登録済み支払いも確保した家計全体の目安です。','muted'));
 const allowanceMessages={
  reserves:'残りの生活費・確保額を設定してください。',
  month:'金額・入金・振替・取引の確認待ちがあります。下の「要確認」を確認してください。',
  currentCard:'今月のカード請求額に未確定分があります。仮登録済みの金額を使用しています。',
  savings:'積立の確保元・残高、または生活費の画面で入力した確保額との重複を確認してください。',
  funding:'引落日までの資金が足りない口座があります。着金・振替を確認してください。',
 };
 for(const reason of funds.allowanceIssues||[])s.append(el('p',allowanceMessages[reason],'notice'));
 if(funds.currentAllowance!==null&&funds.cardAllowance===null)s.append(el('p','翌月以降の請求額や明細の照合を確認してください。','notice'));
 s.append(button('生活費・確保額を設定',fundsForm));
 const breakdown=details(s,'カードで使える目安の内訳');
 metric(breakdown,'現在の口座・現金合計',funds.currentAssets);
 metric(breakdown,'－確定カード引落',funds.confirmed);
 metric(breakdown,'－未確定カード利用分',funds.estimated);
 metric(breakdown,'－今後のカード定期支払い見込',funds.recurring);
 metric(breakdown,'－その他の支払予定',funds.other);
 metric(breakdown,'－今月の生活費',funds.reserves?.living);
 metric(breakdown,'－次月へ残す繰越確保額',funds.reserves?.carry??0);
 if(funds.savingsReserved||funds.futureSavings){
  metric(breakdown,'－目的別積立の確保済み資金',funds.savingsReserved);
  metric(breakdown,'－今後の積立予定（今月まで '+yen(funds.currentSavings)+'）',funds.futureSavings);
  breakdown.append(button('積立目標を確認',()=>{tab='savings';render();}));
 }
 for(const goal of funds.reserves?.goals||[])metric(breakdown,'－'+goal.name,goal.amount);
 metric(breakdown,'入金予定（入金前）',funds.income);
 for(const item of funds.rows)fundSource(breakdown,item);
 const issues=[];
 if(funds.duplicatePostedIncome?.length||funds.paidBenefitConflicts?.length)issues.push(['確定済みの入金に同一の口座・日付・金額、または同月の児童手当と児童扶養手当があります。現在残高と実際の着金を照合してください。','収支を確認','entries']);
 if(funds.duplicateIncome?.length)issues.push(['同じ口座・日付・金額の入金記録または予定があります。該当する入金予定を月末見込から外しています。','入金予定を確認','plans']);
 if(funds.duplicateTransfers?.length)issues.push(['同じ口座・日付・金額の実行済み振替があります。該当する振替予定を見込から外しています。','振替予定を確認','plans']);
 if(funds.paymentDuplicates?.fixed.length)issues.push(['同じ口座・日付・金額の引落予定と支出記録があります。すでに支払った予定か確認してください。','引落予定を確認','plans']);
 if(funds.paymentDuplicates?.csv.length)issues.push(['カードのCSV明細と手入力に同じ日付・金額があります。別の支出か確認してください。','収支を確認','entries']);
 if(funds.untrackedTransfers?.length)issues.push(['開始残高が未設定の口座を含む振替は、両側とも見込から外しています。','口座を確認','accounts']);
 if(funds.unknown)issues.push(['請求額・引落口座・請求月が未確認の予定があります。','カードを確認','cards']);
 if(funds.rows.some(item=>item.review))issues.push(['カードの仮登録額と明細・定期支払いの照合が残っています。','カードを確認','cards']);
 if(summary.unreconciled.length)issues.push(['引落済みカードの請求差額が '+summary.unreconciled.length+'件あります。','差額を確認','cards']);
 if(funds.missingAccount)issues.push(['予定に使う口座の開始残高を確認してください。','口座を確認','accounts']);
 if(funds.benefitConflicts.length)issues.push(['同じ月の児童手当・児童扶養手当の予定に重複があります。着金済み分は残高に含め、重複候補の予定は見込みから外しています。','入金予定を確認','plans']);
 if(funds.overdueIncome.length)issues.push(['予定日を過ぎた未確定の入金は、見込みに含めていません。入金の確定か予定日の見直しをしてください。','入金予定を確認','plans']);
 if(issues.length){
  const warning=details(root,'要確認（'+issues.length+'件）');
  for(const [message,label,target] of issues)warning.append(el('p',message,'notice'),button(label,()=>openBudgetTab(target)));
 }
 const outlook=details(root,'来月以降の見通し');
 outlook.append(el('p','暫定。今月分の必要額を確保したうえで、現時点で登録されている予定から計算しています。今後の入金・請求で変わります。','muted'));
 const future=funds.accountForecasts.flatMap(account=>(account.futureMonths||[]).map(item=>({...item,accountId:account.accountId})))
  .sort((a,b)=>a.date.localeCompare(b.date));
 if(!future.length)outlook.append(el('p','登録済みの予定で追加の不足見込はありません。','muted'));
 for(const month of new Set(future.map(item=>item.month))){
  const [year,number]=month.split('-');
  const group=section(year+'年'+Number(number)+'月の不足見込',outlook);
  for(const item of future.filter(item=>item.month===month)){
   row(group,payName(item.accountId),yen(item.additional),item.date+'までの追加準備目安 ／ 追加の資金移動前の不足 '+yen(item.amount));
  }
 }
 const recent=section('直近の引落予定');
 root.insertBefore(recent,monthly.nextSibling);
 const upcoming=funds.rows.filter(item=>item.date.slice(0,7)===today.slice(0,7)&&(item.kind==='bill'||item.kind==='plan')).slice(0,5);
 if(!upcoming.length)recent.append(el('p','登録済みの引落予定はありません。','muted'));
 for(const item of upcoming)fundSource(recent,item);
}
function home(){cashflowHome();const spending=details(root,'引落月で見る収支・繰り越し');spendingMonths(spending);const extra=details(root,'日別支出・口座・今月の収支');dailyTotal(extra);const cards=el('div',undefined,'summary-grid');for(const [label,value,detail]of [['管理中の口座・現金合計',summary.assets,'開始残高を設定した口座のみ'],['カード未払金',summary.debt,'PINK・VISAの残り'],['未払金を差し引いた金額',summary.net,'口座合計とは分けて表示']]){const c=el('div',undefined,'card');c.append(el('small',label),el('p',yen(value),'amount'),el('small',detail));cards.append(c);}extra.append(cards);
 const s=section('口座と、今月末までの見込み',extra);s.append(el('p','確認待ちと今月末までの入金・振替・引落予定を含めます。未割当のカード開始残高・未登録の引落は見込額に含まれません。','muted'));const grid=el('div',undefined,'cards');for(const a of summary.accounts.filter(a=>a.opening!==null)){const c=el('article',undefined,'card');c.append(el('h3',a.name),el('p',yen(a.balance),'amount'));metric(c,'入金予定',a.plannedIn);metric(c,'引落・振替予定',a.upcoming+a.plannedOut);metric(c,'予定反映後の見込',a.forecast);if(a.pendingCount)c.append(el('p','確認待ち '+a.pendingCount+'件','badge'));c.append(button('口座を見る',()=>{tab='accounts';accountId=a.id;render();}));grid.append(c);}s.append(grid);const unconfigured=summary.accounts.filter(a=>a.opening===null);if(unconfigured.length){const closed=details(s,'まだ開始していない口座（'+unconfigured.length+'件）');for(const a of unconfigured)closed.append(button(a.name+' の設定',()=>{tab='accounts';accountId=a.id;render();}));}
 const flow=section('今月の収支（利用日基準）',extra);metric(flow,'収入',summary.income);metric(flow,'支出',summary.expense);
 flow.append(button('収支の明細を見る',()=>openBudgetTab('entries')));
}
function categoryPicker(host,initial={},csv=false,income=false){
 const names=(income&&data.categories.income||Object.keys(data.categories.tree)).filter(name=>csv||!data.categories.hidden.includes(name)||name===initial.category);
 if(initial.category&&!names.includes(initial.category))names.push(initial.category);
 const major=select(host,'大カテゴリ',csv?[['','分類を選択'],...names]:names,initial.category||'');
 const extra=details(host,'中カテゴリ（任意）');
 extra.open=!!initial.middle;
 extra.hidden=income;
 const middle=select(extra,'中カテゴリ（任意）',[['','指定しない']]);
 const setOptions=(input,names,value)=>{
  if(value&&!names.includes(value))names.push(value);
  input.replaceChildren(new Option('指定しない',''),...names.map(name=>new Option(name,name)));
  input.value=value||'';
 };
 const setPath=(path)=>{
  major.value=path.category||'';
  setOptions(middle,Object.keys(data.categories.tree[major.value]||{}),path.middle);
 };
 major.onchange=()=>setPath({category:major.value});
 setPath(initial);
 return {major,middle,setPath,read:()=>({category:major.value,middle:middle.value,small:major.value===initial.category&&middle.value===(initial.middle||'')?initial.small||'':''})};
}
function personField(host,value=''){
 const names=[...new Set([...(data.people||defaultPeople),value].filter(Boolean))];
 return select(host,'対象者（任意）',[['','未設定'],...names],value);
}
function categoryFields(host,initial={},type='expense'){
 const income=['income','recovery'].includes(type);
 const picker=categoryPicker(host,{
  category:initial.category??(income?'その他':data.preferences.category??'その他'),
  middle:initial.middle??(income?'':data.preferences.middle),
  small:initial.small??(income?'':data.preferences.small),
 },false,income);
 const person=personField(host,initial.person??'');
 return ()=>({...picker.read(),person:person.value,nature:initial.nature||'必要',originalClassification:initial.originalClassification});
}
function entryForm(existing,type=existing?.type||'expense'){modal(existing?'取引を編集':type==='expense'?'支出を入力':'入出金を記録');const f=el('form'),date=field(f,'日付','date',existing?.date||today,true),total=field(f,'レシート・取引の総額（円）','number',existing?.amount||'',true);total.className='amount-input';total.min=1;
 const merchant=field(f,'利用先（任意）','text',existing?.merchant||existing?.memo||'');merchant.readOnly=!!existing?.merchant&&!!(existing.csvImported||Object.values(data.csvImports||{}).includes(existing.id));
 const purchase=field(f,'購入内容（任意）','text',existing?.purchase||'');purchase.maxLength=500;
 let payment=existing?.payment||data.preferences.payments?.[type]||data.preferences.payment||'pink';const buy=['expense','advance','refund'].includes(type),allowed=buy?[...data.cards.map(c=>[c.id,c.name]),...data.accounts.map(a=>[a.id,a.name])]:data.accounts.map(a=>[a.id,a.name]);if(!allowed.some(([id])=>id===payment)){if(existing)allowed.push([payment,payName(payment)+'（旧記録・確認対象）']);else payment=allowed[0][0];}const pay=el('div',undefined,'pay-buttons');const payButtons=[];for(const [id,label]of allowed){const b=button(label,()=>{payment=id;payButtons.forEach(([key,n])=>n.className=key===id?'active':'');},id===payment?'active':'');payButtons.push([id,b]);pay.append(b);}f.append(el('p',buy?'支払い元':'入金先','muted'),pay);
 const single=el('div'),singleRead=categoryFields(single,existing?.splits[0]||{},type);f.append(single);const split=field(f,'カテゴリに分けるときだけ、内訳を追加','checkbox');split.checked=(existing?.splits.length||0)>1;const splitHost=el('div'),splitRows=[],splitTotal=el('p',undefined,'notice');function addSplit(part={}){const box=el('div',undefined,'split-row'),n=field(box,'この内訳の金額（円）','number',part.amount||'',true),read=categoryFields(box,part,type);const record={box,n,read};box.append(button('この内訳を削除',()=>{box.remove();splitRows.splice(splitRows.indexOf(record),1);update();},'text danger'));n.oninput=update;splitRows.push(record);splitHost.append(box);update();}function update(){const sum=splitRows.reduce((n,r)=>n+Number(r.n.value||0),0);splitTotal.textContent='内訳合計 '+yen(sum)+' ／ 総額 '+yen(Number(total.value||0));}splitHost.append(button('＋ 内訳を追加',()=>addSplit()));for(const part of existing?.splits.length>1?existing.splits:[])addSplit(part);splitHost.append(splitTotal);f.append(splitHost);const toggle=()=>{single.hidden=split.checked;splitHost.hidden=!split.checked;single.querySelectorAll('input,select').forEach(n=>n.disabled=split.checked);splitHost.querySelectorAll('input,select').forEach(n=>n.disabled=!split.checked);};split.onchange=()=>{if(split.checked&&!splitRows.length){addSplit({amount:Number(total.value)||'',...singleRead()});addSplit();}toggle();};toggle();total.oninput=update;
 const paymentDetails=details(f,'立替・精算（必要なときだけ）');paymentDetails.open=['advance','recovery'].includes(type);
 const asAdvance=['expense','advance'].includes(type)?field(paymentDetails,'立替として記録する','checkbox'):null;
 if(asAdvance)asAdvance.checked=type==='advance';
 const party=asAdvance||['advance','recovery'].includes(type)?field(paymentDetails,'精算相手','text',existing?.counterparty||'',!asAdvance):null,link=type==='recovery'?select(f,'回収する立替（任意）',[['','指定しない'],...data.entries.filter(e=>e.type==='advance'&&!e.void).map(e=>[e.id,e.date+' '+e.counterparty+' '+yen(e.amount)])],existing?.linkedAdvanceId||''):null;
 if(asAdvance){const updateAdvance=()=>{party.required=asAdvance.checked;party.disabled=!asAdvance.checked;};asAdvance.onchange=updateAdvance;updateAdvance();}
 const advanced=details(f,'支出区分・詳しい指定');
 const spending=select(advanced,'支出区分',[['','未設定'],...spendingKinds],existing?.spendingKind||'');
 const savings=select(advanced,'積立の種類',[['','指定なし'],'カード投資積立'],existing?.savingsKind||'');
 const settle=field(advanced,'従来の集計に使う反映月','month',existing?.settleMonth||today.slice(0,7));if(existing?.legacyIds?.length)f.append(el('p','旧記録の原本は保持します。残高に未反映の記録は、編集しても自動反映しません。','notice'));
 saveForm(f,'保存する',existing?'entry.edit':'entry.add',()=>{const value=amount(total),parts=split.checked?splitRows.map(r=>({...r.read(),amount:amount(r.n)})):[{...singleRead(),amount:value}];if(parts.reduce((n,p)=>n+p.amount,0)!==value)throw Error('内訳の合計と取引総額を一致させてください');if(parts.some(p=>!p.category))throw Error('大カテゴリを選んでください');return {id:existing?.id||crypto.randomUUID(),date:date.value,type:asAdvance?(asAdvance.checked?'advance':'expense'):type,amount:value,payment,bankEntry:data.accounts.some(a=>a.id===payment&&a.kind==='bank'),splits:parts,memo:existing?.memo||merchant.value,purchase:purchase.value,merchant:merchant.value,spendingKind:spending.value,savingsKind:savings.value,counterparty:party?.disabled?'':party?.value||'',linkedAdvanceId:link?.value||'',settleMonth:settle.value};});dialog.append(f);total.focus();}
function entriesPage(){dailyTotal(root);const s=section('収支の記録'),filter=field(s,'表示月','month',entryViewMonth||month),person=personField(s),search=field(s,'購入内容・利用先で検索','search',''),unorganized=field(s,'未整理だけ表示','checkbox');const list=el('div');s.append(list);let visibleEntries=[];s.prepend(button('表示中の明細を一括分類',()=>bulkEntryForm(visibleEntries.filter(e=>!['income','recovery'].includes(e.type)))),button('立替を精算',advanceSettlementForm));const draw=()=>{list.replaceChildren();const entries=visibleEntries=data.entries.filter(e=>!e.void&&e.date.slice(0,7)===filter.value&&(!unorganized.checked||e.splits.some(p=>p.category==='その他'&&p.middle==='未整理'))&&(!person.value||e.splits.some(p=>p.person===person.value))&&(!search.value||[e.purchase,e.merchant,e.memo].some(v=>v?.normalize('NFKC').toLowerCase().includes(search.value.normalize('NFKC').toLowerCase())))).sort((a,b)=>b.date.localeCompare(a.date));for(const e of entries){const r=row(list,e.date+' '+([e.purchase,e.merchant||e.memo].filter(Boolean).join(' ／ ')||e.splits.map(p=>p.category).join('・')),yen(e.amount),payName(e.payment)+'・'+({expense:'支出',income:'収入',advance:'立替',recovery:'回収',refund:'返金'}[e.type])+(e.ledgerIncluded?'・残高反映済み':e.balanceIncludedExternally?'・残高へ再反映しない確認済み':'・残高対象外'));for(const part of e.splits)r.firstElementChild.append(el('p',[part.category,part.middle].filter(Boolean).join(' › ')+(part.person?' ／ 対象者：'+part.person:'')+(e.splits.length>1?' ／ '+yen(part.amount):'')+(part.middle==='未整理'&&part.originalClassification?' ／ 旧分類：'+part.originalClassification.category:''),'muted'));r.append(button('編集',()=>entryForm(e)),commandButton('取り消す','entry.void',{id:e.id,reason:'画面から取引取消'},'danger'));if(!e.ledgerIncluded&&!e.balanceIncludedExternally&&data.startDate&&e.date>=data.startDate)r.append(button('残高へ反映',()=>{modal('開始残高との二重反映を確認');const f=el('form'),payment=select(f,'実際の支払元・入金先',payments(),e.payment),confirmInput=field(f,'開始日の取引前残高に含めていない取引です','checkbox','',true);confirmInput.checked=false;saveForm(f,'確認して残高へ反映','entry.apply',()=>({id:e.id,payment:payment.value,confirm:confirmInput.checked}));dialog.append(f);}));}if(!entries.length)list.append(el('p','この条件の記録はありません。','muted'));};filter.onchange=()=>{entryViewMonth=filter.value;draw();};person.onchange=unorganized.onchange=draw;search.oninput=draw;draw();s.prepend(button('＋ 支出を入力',()=>entryForm(),'primary'));const more=details(s,'収入・立替・回収・返金');for(const [type,label]of [['income','収入'],['advance','立替'],['recovery','回収'],['refund','返金']])more.append(button(label,()=>entryForm(null,type)));}
function accountMonthPicker(box){
 const view=summary.accountMonth;
 if(!view)return null;
 const controls=el('div',undefined,'account-month-controls');
 const input=field(controls,'表示する年月','month',view.selected,true);
 input.min=view.min;
 input.max=view.max;
 const change=async value=>{
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)||value<view.min||value>view.max){
   input.value=view.selected;
   return;
  }
  accountViewMonth=value;
  try{await load();}catch(err){accountViewMonth=view.selected;input.value=view.selected;throw err;}
 };
 input.onchange=()=>change(input.value).catch(error);
 const shift=offset=>{
  const [year,month]=view.selected.split('-').map(Number);
  return new Date(Date.UTC(year,month-1+offset,1)).toISOString().slice(0,7);
 };
 const previous=button('‹ 前月',()=>change(shift(-1))),next=button('翌月 ›',()=>change(shift(1)));
 previous.disabled=view.selected<=view.min;
 next.disabled=view.selected>=view.max;
 controls.prepend(previous);
 controls.append(next);
 box.append(controls);
 return view;
}
function accountFundingAmount(account){
 if(account.required===null)return '開始残高未設定';
 if(account.required>0)return (account.incomplete||account.estimatedPayment?'見込 ':'')+yen(account.required)+' 準備';
 if(account.incomplete)return '登録分は準備不要・要確認';
 return account.estimatedPayment?'準備不要（見込）':'準備不要';
}
function accountMoney(host,label,value){
 const item=el('div');
 item.append(el('dt',label),el('dd',typeof value==='string'?value:yen(value),value<0?'negative':''));
 host.append(item);
}
function accountFundingDetails(host,account,view,openStatement){
 const panel=details(host,accountFundingAmount(account));
 panel.className='passbook-funding';
 const figures=el('dl',undefined,'passbook-figures');
 const current=view.selected===today.slice(0,7);
 accountMoney(figures,current?'見込の起点（現在残高）':'月初残高（見込）',account.basis);
 accountMoney(figures,'引落・支出予定合計',account.unknownPayment?yen(account.totals.payments)+' ＋ 未確定':account.totals.payments);
 accountMoney(figures,'入金予定',account.totals.income);
 accountMoney(figures,'振替入金予定',account.totals.transferIn);
 accountMoney(figures,'振替出金予定',account.totals.transferOut);
 if(account.reserved)accountMoney(figures,'積立として確保済み',account.reserved);
 panel.append(figures);
 if(account.incomplete)panel.append(el('p','未登録の金額や照合待ちがあります。見込には確認できた取引を反映しています。','notice'));
 const debit=account.nextDebit;
 if(debit){
  const heading=el('h3','次の出金・引落 · '+dateWithSlashes(debit.date));
  const next=el('dl',undefined,'passbook-figures');
  accountMoney(next,'当日の出金・引落額',debit.unknown?yen(debit.cost)+' ＋ 未確定':debit.cost);
  accountMoney(next,'引落前日までの予定入金・振替',debit.incomingBefore);
  accountMoney(next,'出金・引落直前の残高見込',debit.before);
  accountMoney(next,'この日までに追加で準備',debit.unknown?(debit.gap>0?'登録分 '+yen(debit.gap)+'・要確認':'要確認'):debit.gap);
  panel.append(heading,next);
 }else panel.append(el('p','この月に残っている出金・引落予定はありません。','muted'));
 if(account.deadlines.length){
  const list=el('ol',undefined,'funding-deadlines');
  for(const step of account.deadlines){
   const item=el('li');
   row(item,dateWithSlashes(step.date)+' まで',yen(step.amount),
    step.items.join('・')+(step.total!==step.amount?' ／ 累計 '+yen(step.total):'')).classList.add('funding-deadline');
   list.append(item);
  }
  panel.append(el('h3','準備する期限と金額'),list);
 }
 if(debit)panel.append(el('p','同日の予定入金は、引落の後に入る前提で計算しています。','muted'),
  button('引落・支出の明細を見る',openStatement,'text passbook-action'));
}
function accountTransactionInfo(item,id){
 if(item.status==='planned'){
  const other=item.kind==='transfer'?(item.from===id?' → '+payName(item.to):payName(item.from)+' → '):'';
  return {
   name:item.kind==='transfer'&&item.to===id?other+item.name:item.name+other,
   state:item.unknown?'金額未確定':item.kind==='bill'?(item.uncertain?'請求見込':'請求確定・引落予定'):'予定',
   action:()=>openFundingSource(item),
  };
 }
 const key=item.source.replace(/^undo:/,'');
 const transfer=data.transfers.find(t=>t.id===key);
 const endpoint=transfer?(transfer.from===id?' → '+payName(transfer.to):payName(transfer.from)+' → '):'';
 const base=item.reason||journalTitle(item);
 const name=transfer&&transfer.to===id?endpoint+base:base+endpoint;
 if(item.reversal||item.source.startsWith('undo:'))return {name,state:'取消の反対記録'};
 const cashPlan=(data.cashPlans||[]).find(p=>p.status==='confirmed'&&(p.postingId===key||'entry:'+p.postingId===key));
 if(cashPlan)return {name,state:'確定済み',action:()=>cashPlanDetail(cashPlan)};
 const plan=data.plans.find(p=>p.status==='confirmed'&&'entry:'+p.entryId===key);
 if(plan)return {name,state:'確定済み',action:()=>{
  modal(name);
  dialog.append(commandButton('引落を取り消す','plan.undo',{id:plan.id,reason:'画面から引落取消'},'danger'));
 }};
 const bill=data.bills.find(b=>b.status==='confirmed'&&b.source===key);
 if(bill)return {name:payName(bill.cardId)+'の引落',state:'確定済み',action:()=>{billForm(bill);}};
 return {name,state:'確定済み'};
}
function accountStatement(host,a,account,view){
 const statement=details(host,'明細を見る');
 statement.className='passbook-statement';
 statement.open=expandedAccounts.has(a.id);
 statement.ontoggle=()=>{if(statement.open)expandedAccounts.add(a.id);else expandedAccounts.delete(a.id);};
 const opening=account?.recordedOpening;
 if(opening!=null)statement.append(el('p','口座の記録開始 '+a.openingDate+' · '+yen(opening),'muted'));
 const items=account?.transactions||[];
 if(!items.length){
  statement.append(el('p','この月の入出金や予定はまだありません。','muted'));
  return statement;
 }
 const table=el('table',undefined,'passbook-table');
 table.append(el('caption',a.name+' · '+monthLabel(view.selected)+'の明細'));
 const head=el('thead'),labels=el('tr'),body=el('tbody');
 for(const label of ['日付・内容','入出金','取引後残高']){
  const column=el('th',label);column.scope='col';labels.append(column);
 }
 head.append(labels);
 table.append(head,body);
 for(const item of items){
  const isPlanned=item.status==='planned';
  const info=accountTransactionInfo(item,a.id);
  const tr=el('tr',undefined,isPlanned?'passbook-planned':'');
  const title=el('td'),date=el('time',dateWithSlashes(item.date));
  date.dateTime=item.date;
  title.append(date,el('strong',info.name,'passbook-entry-name'),el('span',info.state,'passbook-status'));
  if(item.overdue)title.append(el('small','当初 '+dateWithSlashes(item.originalDate)+' · 未確定'));
  if(info.action)title.append(button('確認・操作',info.action,'text passbook-action'));
  const amount=item.unknown?'未確定':(item.delta>0?'+':'')+yen(item.delta);
  const value=el('td',amount,item.delta<0?'negative':'');
  const balance=el('td',yen(item.balance),item.balance<0?'negative':'');
  if(isPlanned&&item.balance!==null)balance.append(el('small',account.incomplete?'登録分の見込':'見込'));
  tr.append(title,value,balance);
  body.append(tr);
 }
 statement.append(table);
 return statement;
}
function accountsPage(){
 const overview=section('口座の月別資金繰り');
 overview.className='account-overview';
 const view=accountMonthPicker(overview);
 const current=today.slice(0,7);
 const historical=view?.selected<current;
 const balanceLabel=historical?'月末残高（実績）':'月末残高見込';
 overview.append(el('h3',view?monthLabel(view.selected)+'の'+balanceLabel:'現在残高'));
 const links=el('ul',undefined,'account-overview-grid');
 links.setAttribute('role','list');
 overview.append(links);
 if(!summary.accounts.length)overview.append(el('p','登録済みの口座はありません。','muted'));
 if(!historical&&summary.savingsGoals?.unassigned)root.append(el('p','確保元が未割当の積立は、口座別の不足額に反映できません。','notice'));
 if(!historical&&data.cards.some(card=>!card.accountId||!card.paymentDay))root.append(el('p','引落口座や支払日が未登録のカードは、口座別の引落予定に反映されません。','notice'));
 const focusAccount=accountId;
 if(focusAccount)expandedAccounts.add(focusAccount);
 accountId='';
 for(const a of summary.accounts){
  const account=view?.accounts.find(item=>item.id===a.id);
  const card=section('',root);
  card.className='passbook-account';
  const title=el('h2',a.name);
  title.tabIndex=-1;
  card.append(title);
  const item=el('li');
  const jump=button('',()=>{
   card.scrollIntoView({block:'start'});
   title.focus({preventScroll:true});
  },'account-overview-link');
  const overviewBalance=view?account?.monthEnd:a.balance;
  jump.append(el('span',a.name),el('strong',yen(overviewBalance),overviewBalance<0?'negative':''));
  item.append(jump);
  links.append(item);
  const figures=el('dl',undefined,'passbook-figures passbook-balances');
  accountMoney(figures,'現在残高',a.balance);
  if(account){
   accountMoney(figures,historical||view.selected===current?'月初残高（実績）':'月初残高（見込）',account.opening);
   accountMoney(figures,balanceLabel,account.monthEnd);
  }
  card.append(figures);
  if(account&&!historical)accountFundingDetails(card,account,view,()=>{
   statement.open=true;
   statement.firstElementChild.focus();
  });
  const statement=accountStatement(card,a,account,view);
  card.append(button('口座を管理',()=>accountManagement(a,view),'text passbook-action'));
  if(focusAccount===a.id)requestAnimationFrame(()=>{
   card.scrollIntoView({block:'start'});
   statement.firstElementChild.focus({preventScroll:true});
  });
 }
 const tools=section('口座の追加・引き継ぎ');
 tools.append(button('＋ 口座・財布を追加',accountAddForm),button('以前の銀行引落を確認して反映',legacyBankImport));
}
function accountRenameForm(a){modal('口座の名前を変更');const f=el('form'),name=field(f,'表示する口座名','text',a.name,true);f.append(el('p','例：ゆうちょ口座【学校用】。この家計管理を利用する本人に表示します。','muted'));saveForm(f,'名前を保存','account.rename',()=>({id:a.id,name:name.value.trim()}));dialog.append(f);}
async function legacyBankImport(){
 modal('以前の銀行引落を残高へ反映');
 if(!data.startDate){dialog.append(el('p','先に開始残高を設定してください。'));return;}
 const preview=await request('/legacy-bank-preview'),f=el('form'),selected=[];
 f.append(el('p','開始残高に含まれていない引落だけ選んでください。以前のクラウド履歴から引き継ぎ、新しい収支と口座残高へ1回だけ反映します。','notice'));
 for(const e of preview.entries){
 const check=field(f,e.date+' ／ '+e.payment+' ／ '+(e.memo||e.category)+' ／ '+yen(e.amount),'checkbox');
 if(e.blockedReason){check.disabled=true;f.append(el('p',e.blockedReason,'notice'),button('この口座の開始日を確認',()=>{const a=data.accounts.find(a=>a.id===e.accountId);if(a.opening===null)openAccountForm(a);else accountOpeningDateForm(a);}));}
 selected.push({e,check});
}
 if(!selected.length){dialog.append(el('p','開始日以降に取り込める銀行引落はありません。以前の画面でクラウドへ保存されているか確認してください。'));return;}
 const confirmInput=field(f,'選んだ引落を開始残高に含めていないことを確認しました','checkbox','',true);
 saveForm(f,'選んだ履歴を残高へ反映','legacy.bank.import',()=>({ids:selected.filter(x=>x.check.checked).map(x=>x.e.id),confirm:confirmInput.checked}));dialog.append(f);
}
function accountAddForm(){modal('口座・現金を追加');const f=el('form'),name=field(f,'名前','text','',true),kind=select(f,'種別',[['bank','銀行口座'],['cash','現金・財布']]);saveForm(f,'追加する','account.add',()=>({id:crypto.randomUUID(),name:name.value,kind:kind.value}));dialog.append(f);}
function journalTitle(j){const key=j.source.replace(/^undo:/,'');if(key.startsWith('entry:')){const e=data.entries.find(e=>e.id===key.slice(6));return e?.memo||e?.splits.map(p=>p.category).join('・')||'収支の記録';}if(key.startsWith('payment:'))return 'カード引落';if(data.transfers.some(t=>t.id===key))return '口座間振替';return '残高調整・入出金';}
function accountManagement(a,view){
 const id=a.id;
 modal(a.name+'の管理');
 const actions=el('div',undefined,'actions');
 actions.append(button('名前を変更',()=>accountRenameForm(a)),
  button('入金',()=>moneyForm(a,'income')),button('入金予定',()=>cashPlanForm(null,'income',id)),
  button('振替予定',()=>cashPlanForm(null,'transfer',id)),button('出金',()=>moneyForm(a,'expense')),
  button('振替・現金引出',()=>transferForm(a)),button('残高調整',()=>adjustForm(a)));
 if(a.opening===null)actions.append(button('この口座の開始残高を設定',()=>openAccountForm(a),'primary'));
 else actions.append(button('開始日を確認・変更',()=>accountOpeningDateForm(a)));
 dialog.append(actions);
 const sameMonth=date=>!view||date.slice(0,7)===view.selected;
 const includeDue=date=>sameMonth(date)||view?.selected===today.slice(0,7)&&date<=today;
 const plans=data.plans.filter(p=>p.payment===id&&p.status==='planned'&&p.dueDate<=today&&includeDue(p.dueDate));
 const bills=data.bills.filter(b=>b.status==='planned'&&includeDue(b.dueDate)&&canConfirmBill(b)&&data.cards.some(c=>c.id===b.cardId&&c.accountId===id));
 const due=[...plans.map(p=>({kind:'plan',p,name:p.name})),...bills.map(p=>({kind:'bill',p,name:payName(p.cardId)}))];
 if(due.length){
  const batch=details(dialog,'複数の引落をまとめて確定');
  const checks=due.map(item=>({...item,c:field(batch,item.p.dueDate+' ・ '+item.name,'checkbox')}));
  batch.append(button('選んだ引落をまとめて確定',()=>{
   const items=checks.filter(x=>x.c.checked).map(x=>({kind:x.kind,id:x.p.id,version:x.p.version}));
   if(!items.length)throw Error('引落を選択してください');
   modal('まとめて確定');
   dialog.append(el('p',items.length+'件の引落を確定します。'),commandButton('引落済みにする','payments.confirm',{items},'primary'));
  },'primary'));
 }
 const transfers=data.transfers.filter(t=>!t.void&&(t.from===id||t.to===id));
 const adjustments=data.adjustments.filter(x=>x.accountId===id&&!x.void);
 if(transfers.length||adjustments.length){
  const undo=details(dialog,'振替・残高調整の取消');
  for(const t of transfers){
   const line=row(undo,payName(t.from)+' → '+payName(t.to),yen(t.amount),t.date);
   const linked=(data.cashPlans||[]).find(p=>p.status==='confirmed'&&p.postingId===t.id);
   line.append(linked?button('予定を確認',()=>cashPlanDetail(linked)):
    commandButton('振替を取り消す','transfer.undo',{id:t.id,reason:'振替取消'},'danger'));
  }
  for(const adjustment of adjustments){
   const line=row(undo,'残高調整',yen(adjustment.actual),adjustment.date);
   line.append(commandButton('残高調整を取り消す','adjustment.undo',{id:adjustment.id,reason:'残高調整取消'},'danger'));
  }
 }
}
function planRow(host,p){const r=row(host,p.name,yen(p.amount),p.dueDate+'・'+payName(p.payment)+(p.oneOff?'・今回のみ':p.variable?'・変動額':''));r.append(button('金額・日付を変更',()=>{modal(p.name+' の予定');const f=el('form'),n=field(f,'今回の金額','number',p.amount,true),due=field(f,'今回の引落日','date',p.dueDate,true);saveForm(f,'予定を保存','plan.edit',()=>({id:p.id,version:p.version,amount:amount(n),dueDate:due.value}));dialog.append(f);}));r.append(commandButton('今回の予定を削除','plan.cancel',{id:p.id,version:p.version},'danger'));if(p.dueDate<=today)r.append(commandButton(data.cards.some(c=>c.id===p.payment)?'カード利用を登録':'引落済み','plans.confirm',{items:[{id:p.id,version:p.version}]},'primary'));return r;}
function moneyForm(account,type){modal(account.name+' の'+(type==='income'?'入金':'出金'));const f=el('form'),date=field(f,'日付','date',today,true),n=field(f,'金額','number','',true),category=field(f,'大カテゴリ','text',type==='income'?'給与':'その他'),memo=field(f,'メモ','text','');saveForm(f,'記録する','entry.add',()=>({id:crypto.randomUUID(),type,date:date.value,amount:amount(n),payment:account.id,category:category.value,memo:memo.value,bankEntry:true}));dialog.append(f);}
function transferForm(account){modal('口座間振替・現金の引き出し');const f=el('form'),from=select(f,'出金元',data.accounts.map(a=>[a.id,a.name]),account?.id),to=select(f,'入金先',data.accounts.map(a=>[a.id,a.name]),'cash'),n=field(f,'金額','number','',true),date=field(f,'実際に移した日','date',today,true),memo=field(f,'メモ','text','');f.append(el('p','出金と入金を1回の操作で反映します。家計の収入・支出には加えません。','notice'));saveForm(f,'振替を記録','transfer',()=>({from:from.value,to:to.value,amount:amount(n),date:date.value,reason:memo.value}));dialog.append(f);}
function adjustForm(a){modal(a.name+' の残高調整');const f=el('form'),actual=field(f,'数えた実際の残高','number','',true),reason=field(f,'差額の理由','textarea','',true);saveForm(f,'調整記録を追加','account.adjust',()=>({id:a.id,actual:amount(actual,{signed:true}),reason:reason.value}));dialog.append(f);}
function accountOpeningDateForm(a){
 modal(a.name+' の開始日を確認');
 const f=el('form'),date=field(f,'口座の開始日','date',a.openingDate,true);
 date.min=data.startDate;date.max=a.openingDate;
 f.append(el('p','登録した開始残高は '+yen(a.opening)+' です。この金額が、変更後の開始日の取引前残高である場合に変更してください。11月1日を選ぶ場合は10月31日の取引終了時点の残高です。','notice'));
 const check=field(f,'この金額が、変更後の日付の取引前残高であることを確認しました','checkbox','',true);
 saveForm(f,'開始日を保存','account.opening-date',()=>({id:a.id,date:date.value,confirm:check.checked}));dialog.append(f);
}
function openAccountForm(a){if(!data.startDate){startForm(a.id);return;}modal(a.name+' の開始残高');const f=el('form'),date=field(f,'開始日（その日の取引前）','date',data.startDate||today,true),n=field(f,'開始残高','number','',true),check=field(f,'この残高と開始日を確認しました','checkbox','',true);saveForm(f,'開始残高を設定','account.open',()=>({id:a.id,date:date.value,amount:amount(n,{signed:true}),confirm:check.checked}));dialog.append(f);}
function fixedPage(){const s=section('固定費');s.append(button('以前の固定費を確認して引き継ぐ',fixedImportForm));s.append(button('＋ 固定費を追加',()=>ruleForm(),'primary'),el('p','毎月の予定は自動作成。予定だけでは残高を減らしません。実際の引落確認は口座画面で行います。','muted'));for(const [key,name]of payments()){const rules=data.rules.filter(r=>r.payment===key);if(!rules.length)continue;const group=details(s,name+'（'+rules.length+'件）');for(const r of rules){const item=row(group,r.name,yen(r.amount),(r.variable?'金額変動型':'金額固定型')+'・毎月'+r.day+'日'+(!r.enabled?'・停止中':'')+(r.needsReview?'・旧設定を要確認':''));const progress=summary.installments?.[r.id];
 if(r.term&&r.term.kind!=='ongoing')item.append(el('p','最終支払月 '+r.term.endMonth,'muted'));
 if(r.term?.kind==='installments'&&progress){
  item.append(el('p','全 '+r.term.total+'回 ／ 支払済み '+progress.paid+'回 ／ 残り '+progress.remaining+'回 ／ 残り見込 '+yen(progress.projected),'muted'));
  if(progress.skipped)item.append(el('p','取消済み '+progress.skipped+'回','muted'));
 }
 if(progress?.outside?.length)item.append(el('p','終了条件の範囲外に保存済みの予定があります。予定画面で確認してください。 '+progress.outside.join('、'),'notice'));
 item.append(button('編集',()=>ruleForm(r)));if(r.enabled)item.append(commandButton('停止する','rule.disable',{id:r.id}));}}const unmapped=data.rules.filter(r=>!payments().some(([id])=>id===r.payment));if(unmapped.length){const review=details(s,'引落元を確認する旧固定費');for(const r of unmapped)review.append(button(r.name+' を確認',()=>ruleForm(r)));}}
function ruleForm(r){modal(r?'固定費を編集':'固定費を追加');const f=el('form'),name=field(f,'名前','text',r?.name||'',true),n=field(f,'金額（変動型は初回の目安）','number',r?.amount||'',true),payment=select(f,'引落元・カード',payments(),r?.payment||'bank-0'),kind=select(f,'金額の種類',[['fixed','金額固定型'],['variable','金額変動型']],r?.variable?'variable':'fixed'),date=field(f,'毎月何日（31日は月末へ調整）','number',r?.day||1,true),category=categoryPicker(f,{category:r?.category||'その他',middle:r?.middle}),person=personField(f,r?.person||''),enabled=field(f,'今後の予定を作る','checkbox');enabled.checked=r?r.enabled:true;if(r?.needsReview)f.append(el('p','旧固定費は停止した状態で取り込んでいます。継続するものだけ有効にしてください。','notice'));const term=select(f,'支払いの終了条件',[['ongoing','終了日なし（継続）'],['end','終了年月を指定'],['installments','初回年月・支払回数を指定']],r?.term?.kind||'ongoing');
 const end=field(f,'最終支払月','month',r?.term?.endMonth||'');
 const first=field(f,'初回支払月','month',r?.term?.firstMonth||month);
 const total=field(f,'総支払回数','number',r?.term?.total||'');
 const prior=field(f,'最初から何回分が支払済みか（家計簿での管理開始前の分）','number',r?.term?.priorPaid??0);
 const estimate=el('p',undefined,'muted');f.append(estimate);
 function termFields(){
  const installment=term.value==='installments';
  for(const [input,visible] of [[end,term.value==='end'],[first,installment],[total,installment],[prior,installment]]){
   input.closest('label').hidden=!visible;input.disabled=!visible;input.required=visible;
  }
  estimate.textContent='';
  if(installment&&/^\d{4}-\d{2}$/.test(first.value)&&Number(total.value)>0&&Number(total.value)<=600){
   const [year,number]=first.value.split('-').map(Number);
   estimate.textContent='最終支払月 '+new Date(Date.UTC(year,number+Number(total.value)-2,1)).toISOString().slice(0,7);
  }
 }
 term.onchange=first.oninput=total.oninput=termFields;termFields();
 saveForm(f,'固定費を保存','rule.save',()=>({term:{kind:term.value,...(term.value==='end'?{endMonth:end.value}:term.value==='installments'?{firstMonth:first.value,total:Number(total.value),priorPaid:Number(prior.value)}:{})},id:r?.id||crypto.randomUUID(),name:name.value,amount:amount(n),payment:payment.value,day:Number(date.value),variable:kind.value==='variable',...category.read(),person:person.value,enabled:enabled.checked}));dialog.append(f);}
function cardsPage(){for(const c of summary.cards){const s=section(c.name);cardPurchasePlans(s,c);s.append(button('利用額の合計を登録',()=>cardEstimateForm(c),'primary'),button('利用明細CSVを取り込む',()=>csvImportForm(c)));metric(s,'現在の未払金',c.balance===null?null:Math.max(0,c.balance));if(c.balance<0)metric(s,'過払・返金などのカード残高',-c.balance);s.append(el('p',c.accountId?'引落口座：'+payName(c.accountId)+' ／ '+c.closingDay+'日締め・'+c.monthOffset+'か月後の'+c.paymentDay+'日払い':'締め日・支払日・引落口座は未設定','muted'),button('カード設定',()=>cardForm(c)));if(c.opening>0){const allocated=data.bills.filter(b=>b.cardId===c.id).reduce((n,b)=>n+(b.openingAllocation||0),0);s.append(el('p','開始時未払金のうち請求月に未割当：'+yen(c.opening-allocated)+'。最初の請求予定で割り当ててください。','notice'));}const unresolved=data.entries.filter(e=>!e.void&&e.payment===c.id&&e.csvBilling?.status==='pending');if(unresolved.length){metric(s,'請求月が未確定の利用分',unresolved.filter(e=>e.ledgerIncluded).reduce((n,e)=>n+(e.type==='refund'?-e.amount:e.amount),0));s.append(el('p','残高管理開始日以降の利用は未払金に含みます。請求月を確認すると、対象月の引落見込に表示します。','notice'));const pending=details(s,'翌月以降・請求月の確認待ち '+unresolved.length+'件');for(const e of unresolved){const r=row(pending,e.memo,yen(e.amount),e.date+' ／ '+e.csvBilling.earliestMonth+'以降・請求月未確定'+(!e.ledgerIncluded?' ／ 開始前の履歴':''));r.append(button('請求月を設定',()=>csvBillingForm(e)));}}const historical=data.entries.filter(e=>!e.void&&e.csvImported&&!e.ledgerIncluded&&e.payment===c.id&&data.startDate&&e.date<data.startDate);if(historical.length)s.append(button('開始日前のCSV明細の請求月を確認・変更',()=>historicalCsvBillingForm(historical)));const charges=details(s,'カードで払う固定費（利用登録）');for(const p of data.plans.filter(p=>p.payment===c.id&&p.status==='planned')){const r=planRow(charges,p);r.append(el('small','利用登録待ち（未発生・未確認）','muted'));}for(const p of data.plans.filter(p=>p.payment===c.id&&p.status==='confirmed')){
 const charge=summary.cardCharges?.[p.id];
 const status={paid:'引落完了',billed:'請求確定',used:'利用済み・請求未確定'}[charge?.status]||'利用済み';
 const r=row(charges,p.name,yen(p.amount),status+(charge?.month?' ／ 引落月 '+charge.month:''));
 r.append(commandButton('利用登録を取り消す','plan.undo',{id:p.id,reason:'カード固定費の利用登録取消'},'danger'));
 }for(const b of data.bills.filter(b=>b.cardId===c.id&&b.status==='planned'))billRow(s,b);const done=details(s,'引落済み・差額の履歴');for(const b of data.bills.filter(b=>b.cardId===c.id&&b.status==='confirmed'))billRow(done,b);}}
function summaryBill(b){return summary.cards.find(c=>c.id===b.cardId)?.bills.find(item=>item.id===b.id);}
function billForecast(b){return summaryBill(b)?.projected??0;}
function billExpected(b){return summaryBill(b)?.expected??0;}
function historicalForecast(b){return summaryBill(b)?.historicalForecast??0;}
function cardEstimateForm(card,bill){
 modal(card.name+' の利用額の合計を登録');
 const f=el('form'),defaultMonth=bill?.month||nextMonth(today.slice(0,7));
 const billingMonth=field(f,'引落予定月','month',defaultMonth,true);if(data.startDate)billingMonth.min=data.startDate.slice(0,7);
 const status=select(f,'楽天カードの表示',[['estimate','未確定'],['confirmed','請求額確定']]);
 const value=field(f,'カードアプリで確認した合計（円）','number','',true);value.min=0;
 const checked=field(f,'最終確認日','date',today,true);checked.max=today;
 const message=el('p','確定前は資金繰りに反映します。銀行残高への反映は、実際の引落を確定したときです。','notice');
 const current=el('p',undefined,'muted');f.append(message,current);
 function showExisting(){
  const existing=data.bills.find(b=>b.cardId===card.id&&b.month===billingMonth.value);
  value.value=existing?.actual??existing?.appEstimate?.amount??'';
  status.value=existing?.actual!=null?'confirmed':'estimate';
  current.textContent=existing?.appEstimate?'前回の未確定額 '+yen(existing.appEstimate.amount)+' ／ '+existing.appEstimate.checkedDate+'。更新時は、追加分の照合をやり直してください。':'';
 }
 billingMonth.onchange=showExisting;showExisting();
 saveForm(f,'確認した合計を保存','bill.estimate',()=>({cardId:card.id,month:billingMonth.value,version:data.bills.find(b=>b.cardId===card.id&&b.month===billingMonth.value)?.version,amount:amount(value),status:status.value,checkedDate:checked.value}));
 dialog.append(f);
}
function cardReconcileForm(bill){
 modal('カード利用額と明細を照合');
 const f=el('form'),forecast=summaryBill(bill).forecast;
 metric(f,'アプリで確認した合計（'+bill.appEstimate.checkedDate+'）',bill.appEstimate.amount);
 metric(f,'登録済みの明細合計',forecast.registered);
 metric(f,'合計に含まれると確認した明細',forecast.included);
 metric(f,'仮登録額と登録明細の差',bill.appEstimate.amount-forecast.registered);
 f.append(el('p','利用日が確認日より後でも、アプリの合計に含まれるか確認してから「別に加算」を選んでください。返金はマイナスで反映します。','notice'));
 const entries=details(f,'登録済み明細の照合（'+forecast.entries.length+'件）');entries.open=true;
 const decisions=forecast.entries.map(entry=>{
  const r=row(entries,entry.name,yen(entry.amount),entry.date+(entry.date>bill.appEstimate.checkedDate?'・利用日は確認日より後':'')+(entry.addedSinceSnapshot?'・仮登録後に追加または請求月を割当':''));
  const choice=select(r,'アプリ合計との照合',[['review','未照合'],['included','合計に含まれる'],['extra','合計と別に加算']],entry.coverage);
  return {entry,choice};
 });
 const plans=details(f,'カードで払う定期支払い（'+forecast.plans.length+'件）');plans.open=true;
 const future=forecast.plans.map(plan=>{
  const r=row(plans,plan.name,yen(plan.amount),plan.date);
  const saved=bill.appEstimate.future.find(choice=>choice.id===plan.id&&choice.version===plan.version);
  const links=forecast.entries.filter(entry=>entry.amount>0).map(entry=>[entry.id,entry.date+' '+entry.name+' '+yen(entry.amount)]);
  const choice=select(r,'定期支払いの状態',[['','要確認'],['extra','未発生・見込に加算'],['included','アプリ合計に含まれる'],...links],saved?.linkedEntryId||saved?.coverage||'');
  return {plan,choice};
 });
 saveForm(f,'照合を保存','bill.reconcile',()=>({
  id:bill.id,version:bill.version,
  decisions:decisions.filter(({choice})=>choice.value!=='review').map(({entry,choice})=>({id:entry.id,signature:entry.signature,coverage:choice.value})),
  future:future.filter(({choice})=>choice.value).map(({plan,choice})=>({id:plan.id,version:plan.version,coverage:choice.value==='extra'?'extra':'included',...(!['extra','included'].includes(choice.value)&&{linkedEntryId:choice.value})})),
 }));
 dialog.append(f);
}
function canConfirmBill(b){
 return b.dueDate<=today&&(b.actual!==null||!b.appEstimate&&!historicalForecast(b)&&!summaryBill(b)?.pendingCharges&&!summaryBill(b)?.futurePurchases?.length);
}
function billRow(host,b){
 const card=data.cards.find(c=>c.id===b.cardId),forecast=summaryBill(b)?.forecast;
 const r=row(host,card.name+' '+b.month+'月の引落',b.actual===null?forecast?.unknown?'金額未確認':'見込 '+yen(billForecast(b))+'（暫定）':yen(b.actual),
  b.dueDate+'・'+(b.status==='confirmed'?'引落完了':b.actual===null?'請求未確定':'請求確定')+'・登録明細 '+yen(billExpected(b)));
 if(summaryBill(b)?.futurePurchases?.length)r.append(el('p','カード利用予定 '+yen(summaryBill(b).purchaseForecast)+' ／ '+summaryBill(b).futurePurchases.map(p=>p.name).join('、'),'muted'));
 if(b.appEstimate)r.append(el('p','利用済みの仮登録 '+yen(b.appEstimate.amount)+' ／ 最終確認 '+b.appEstimate.checkedDate,'muted'));
 if(b.appCheckedDate)r.append(el('p','請求確定額の最終確認 '+b.appCheckedDate,'muted'));
 if(b.amountHistory?.length){
  const history=details(r,'金額の更新履歴');
  for(const change of b.amountHistory.slice().reverse())row(history,change.status==='confirmed'?'請求確定':'未確定',yen(change.amount),'確認 '+change.checkedDate+'・登録 '+change.recordedDate);
 }
 r.append(button(b.status==='planned'?'請求・引落を確認':'引落詳細を見る',()=>billForm(b),'primary'));
 if(b.status==='confirmed'&&b.reconciliation)r.append(el('p','未照合の差額 '+yen(b.reconciliation)+' ／ '+b.reason,'notice'));
 return r;
}
function billForm(b){
 const card=data.cards.find(c=>c.id===b.cardId),account=summary.accounts.find(a=>a.id===card?.accountId);
 modal(payName(b.cardId)+' '+b.month+'月の請求・引落');
 metric(dialog,'引落口座：'+payName(card?.accountId),account?.balance??null);
 if(b.status!=='planned'){
  metric(dialog,'引落額',b.actual);dialog.append(el('p',b.dueDate+' ／ '+(b.status==='confirmed'?'引落済み':'取消済み')));
  if(b.reconciliation)dialog.append(el('p','未照合の差額 '+yen(b.reconciliation)+' ／ '+b.reason,'notice'));
  if(b.status==='confirmed')dialog.append(commandButton('引落を取り消す','bill.undo',{id:b.id,reason:'カード引落取消'},'danger'));
  return;
 }
 const f=el('form'),forecast=billForecast(b);
 metric(f,'登録明細＋開始時未払金の割当',billExpected(b));
 if(b.appEstimate)metric(f,'仮登録額',b.appEstimate.amount);
 if(historicalForecast(b)>0)metric(f,'開始日前のCSV明細',historicalForecast(b));
 const actual=field(f,'実際の請求額','number',b.actual??Math.max(0,forecast),true),due=field(f,'引落日','date',b.dueDate,true);
 const reason=field(f,'明細との差額理由（必要な場合）','textarea',b.reason||'');
 f.append(button('請求額確認済み・明細未登録',()=>{reason.value='利用明細未登録・実際の請求額確認済み';}),button('未照合（理由不明）',()=>{reason.value='未照合';}));
 const advanced=details(f,'開始時未払金・ポイント・返金などの調整');
 const allocation=field(advanced,'開始時未払金の割当','number',b.openingAllocation||0,true),kind=select(advanced,'調整種別',[['','調整しない'],['points','ポイント充当'],['refund','明細にない返金'],['fee','明細にない手数料']],b.adjustment?.kind||''),adj=field(advanced,'調整額','number',b.adjustment?.amount||0);
 const collect=()=>{const value=amount(actual),allocated=amount(allocation);let why=reason.value.trim();const expected=billExpected(b)-(b.openingAllocation||0)+allocated;
 if(!why&&value!==expected&&value===b.appEstimate?.amount&&!kind.value)why='仮登録額と実際の請求額一致・明細未照合';
 if(!why&&value!==expected)throw Error('差額理由を選択してください。明細がない場合は「請求額確認済み・明細未登録」を押してください。');
 return {id:b.id,version:b.version,actual:value,dueDate:due.value,openingAllocation:allocated,reason:why,adjustment:kind.value?{kind:kind.value,amount:amount(adj),reason:why}:null};};
 saveForm(f,'請求額を確定・保存','bill.edit',collect,null,()=>{const fresh=data.bills.find(x=>x.id===b.id);if(fresh)billForm(fresh);});
 dialog.append(f);
 if(canConfirmBill(b)&&b.actual!==null&& (b.actual===billExpected(b)||b.reason))dialog.append(commandButton('カード引落済み','bill.confirm',{id:b.id,version:b.version},'primary'));
 else if(b.dueDate<=today)dialog.append(el('p','請求額を保存すると、この画面で引落を確定できます。','notice'));
 const extra=details(dialog,'その他の請求操作');
 if(b.actual===null)extra.append(button(b.appEstimate?'仮登録額を更新':'利用額を仮登録',()=>cardEstimateForm(card,b)));
 if(b.appEstimate&&b.actual===null)extra.append(button('明細・定期支払いを照合',()=>cardReconcileForm(b)));
 extra.append(commandButton('今回の予定を削除','bill.cancel',{id:b.id,version:b.version},'danger'));
}

function cardForm(c){modal(c.name+' の設定');const f=el('form'),account=select(f,'引落口座',data.accounts.filter(a=>a.kind==='bank').map(a=>[a.id,a.name]),c.accountId||''),close=field(f,'締め日（不明なまま決めないでください）','number',c.closingDay||'',true),offset=select(f,'支払い月',[['0','締め月と同じ月'],['1','締め月の翌月'],['2','締め月の翌々月']],String(c.monthOffset)),pay=field(f,'支払日（休日は次の登録銀行営業日）','number',c.paymentDay||'',true);saveForm(f,'カード設定を保存','card.configure',()=>({id:c.id,accountId:account.value,closingDay:Number(close.value),paymentDay:Number(pay.value),monthOffset:Number(offset.value)}));dialog.append(f);}
function statsPage(){
 const s=section('カテゴリ別・対象者別の集計'),m=field(s,'対象月','month',month),mode=select(s,'集計基準',[['date','利用日（新しい家計管理）'],['settleMonth','反映月（従来の表示）']],basis);
 m.onchange=async()=>{month=m.value;await load();};mode.onchange=async()=>{basis=mode.value;await load();};
 metric(s,'収入',summary.income);metric(s,'支出',summary.expense);
 const categories=section('大・中カテゴリ別');
 const filter=select(categories,'対象者で絞る',[['','すべて'],...new Set((summary.categoryBreakdown||[]).map(part=>part.person))]);
 const exclude=select(categories,'集計から除外する対象者',[['','除外なし'],...new Set((summary.categoryBreakdown||[]).map(part=>part.person))]);
 const list=el('div');categories.append(list);
 const draw=()=>{
  list.replaceChildren();
  const totals=new Map(),kinds=new Map();
  for(const part of summary.categoryBreakdown||[]){
   if(filter.value&&part.person!==filter.value||exclude.value&&part.person===exclude.value)continue;
   kinds.set(part.kind,(kinds.get(part.kind)||0)+part.amount);
   if(!totals.has(part.category))totals.set(part.category,{total:0,middle:new Map()});
   const major=totals.get(part.category);major.total+=part.amount;
   if(!part.middle)continue;
   if(!major.middle.has(part.middle))major.middle.set(part.middle,{total:0});
   const middle=major.middle.get(part.middle);middle.total+=part.amount;
  }
  for(const [name,major] of totals){
   if(!major.middle.size){row(list,name,yen(major.total));continue;}
   const group=details(list,name+' ／ '+yen(major.total));
   for(const [name,middle] of major.middle){
    row(group,name||'中カテゴリ指定なし',yen(middle.total));
   }
  }
  const kindGroup=section('支出区分別',list);
  for(const kind of [...spendingKinds,'未設定'])metric(kindGroup,kind,kinds.get(kind)||0);
  if(!totals.size)list.append(el('p','対象の支出はありません。','muted'));
 };
 filter.onchange=exclude.onchange=draw;draw();
 const people=section('対象者別');
 for(const [name,n]of Object.entries(summary.people))row(people,name,yen(n));
 const saving=section('貯金・積立');saving.append(button('目的別積立を開く',()=>{tab='savings';render();}));
 for(const [purpose,total] of Object.entries(summary.savings||{}))metric(saving,purpose,total);
 metric(s,'立替の返金',summary.advanceReceived||0);
 metric(s,'立替の差額免除（自己負担）',summary.waived||0);
 const past=details(s,'従来の予算・資金繰り設定（保持した原本）');past.append(el('p','旧データのplanをそのまま保持しています。旧残高は開始残高へ自動転記しません。','muted'));past.append(button('保存されている旧設定を見る',()=>{modal('旧設定・読み取り専用');const pre=el('pre');pre.style.whiteSpace='pre-wrap';pre.textContent=JSON.stringify(data.legacy?.data?.plan||data.legacy?.plan||{},null,2);dialog.append(pre);}));}
function startForm(selectedAccount){modal('残高管理の開始日と開始残高');const f=el('form'),start=field(f,'開始日','date','2026-11-01',true);f.append(el('p','最初はこの画面で家計全体の残高管理を開始します。使う口座にチェックし、各口座の開始残高を入力してください。開始後は口座ごとに追加設定できます。','notice'));f.append(el('p','開始日の取引前の残高を入力します。11月1日から始める場合は、10月31日の取引がすべて終わった時点の口座残高・現金残高と、まだ引き落とされていないカード代金を入力してください。開始日以降の取引は、実際に利用した日付で記録します。','notice'));const accounts=[];for(const a of data.accounts){const box=el('div',undefined,'account-picker'),check=field(box,a.name+' を管理する','checkbox'),n=field(box,'取引前の開始残高','number','');check.checked=a.id===selectedAccount;accounts.push({a,check,n});f.append(box);}const cards=[];for(const c of data.cards){const n=field(f,c.name+' の開始時未払金（支払済み分を除く）','number','',true);cards.push({c,n});}const confirmInput=field(f,'開始日・実残高・対象取引を確認しました','checkbox','',true);saveForm(f,'確認した残高で開始','start',()=>({startDate:start.value,confirm:confirmInput.checked,accounts:accounts.filter(x=>x.check.checked).map(x=>({id:x.a.id,amount:amount(x.n,{signed:true})})),cards:cards.map(x=>({id:x.c.id,amount:amount(x.n,{signed:true})}))}));dialog.append(f);}
function importForm(){modal('既存データを引き継ぐ');const f=el('form'),file=field(f,'家計簿のJSON（認証情報を除いたもの）','file','',true);file.accept='.json,application/json';const result=el('p',undefined,'notice');f.append(result);let snapshot;file.onchange=async()=>{try{snapshot=JSON.parse(await file.files[0].text());const preview=await request('/import-preview','POST',snapshot);result.textContent=preview.count+'件の旧行・分割レシート '+preview.splitReceipts+'組・固定費 '+preview.fixedRules+'件。原本を保持し、収支と残高への反映を分けて取り込みます。';}catch(e){snapshot=null;error(e);}};const check=field(f,'旧アプリのバックアップを取り、取り込む内容を確認しました','checkbox','',true);saveForm(f,'原本を保持して取り込む','import',()=>{if(!snapshot)throw Error('JSONを読み込んで確認してください');return {snapshot,confirm:check.checked};});dialog.append(f);}
async function download(){const payload=await request('/export'),blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download='budget-backup-'+today+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function classificationSettingsPage(){
 const people=section('対象者');
 const names=data.people||defaultPeople;
 const form=el('form'),old=select(form,'対象者の操作',[['','新しく追加'],...names.map(name=>[name,name+' の名前を変更'])]);
 const name=field(form,'名前','text','',true);name.maxLength=100;
 old.onchange=()=>{name.value=old.value;};
 saveForm(form,'対象者を保存','classification.people',()=>({old:old.value,name:name.value}));
 people.append(form);
 const rules=section('CSVの自動分類ルール');
 rules.append(button('ルールを追加',()=>merchantRuleForm()));
 for(const [key,rule] of Object.entries(data.merchantCategories||{})){
  const detail=typeof rule==='string'?rule:rule.disabled?'自動提案を停止中':[rule.category,rule.middle,rule.person].filter(Boolean).join(' ／ ');
  row(rules,key,'',detail).append(button('編集',()=>merchantRuleForm(key,rule)),
   commandButton('削除・提案を停止','classification.merchant',{key,disabled:true}));
 }
 const migration=section('カテゴリの移行');
 migration.append(button('移行プレビュー',async()=>{
  const preview=await request('/classification-preview');
  modal('カテゴリの移行プレビュー');
  if(preview.alreadyApplied){dialog.append(el('p','カテゴリは移行済みです。'));return;}
  const f=el('form');
  f.append(el('p','分類を確認する取引 '+preview.entries+'件 ／ 未整理 '+preview.unorganized+'件'));
  f.append(el('p','固定費設定 '+preview.rules+'件 ／ 未確定予定 '+preview.plans+'件 ／ 自動分類 '+preview.merchantRules+'件','muted'));
  const mapping=details(f,'旧カテゴリと移行先');
  for(const item of preview.mappings)row(mapping,item.from,[item.category,item.middle].filter(Boolean).join(' › '),
   [item.person?'対象者：'+item.person:'',item.income?'収入側の記録は保持':''].filter(Boolean).join(' ／ '));
  const examples=details(f,'その他 → 未整理に移す明細');
  for(const item of preview.unresolved)row(examples,item.date+' '+(item.label||''),yen(item.amount),item.categories.join('・'));
  f.append(button('JSONバックアップを保存',download));
  const confirm=field(f,'バックアップを保存し、移行内容を確認しました','checkbox','',true);
  if(preview.revision!==revision){dialog.append(el('p','内容が更新されています。開き直して確認してください。'));return;}
  saveForm(f,'分類を移行する','classification.migrate',()=>({confirm:confirm.checked,expectedRevision:preview.revision}));
  dialog.append(f);
 }));
}
function merchantRuleForm(key='',rule={}){
 modal('自動分類ルール');
 const f=el('form'),name=field(f,'利用先','text',key,true);
 name.readOnly=!!key;
 const picker=categoryPicker(f,typeof rule==='string'?{category:rule}:rule,true);
 const person=personField(f,rule.person||'');
 saveForm(f,'ルールを保存','classification.merchant',()=>({key:merchantKey(name.value),...picker.read(),person:person.value}));
 dialog.append(f);
}
function bulkEntryForm(entries){
 modal('登録済み明細の分類を一括変更');
 const f=el('form'),picker=categoryPicker(f,{},true);
 const person=select(f,'対象者',[['','変更しない'],['unset','未設定'],...(data.people||defaultPeople)]);
 const spending=select(f,'支出区分',[['','変更しない'],['unset','未設定'],...spendingKinds]);
 const list=el('div'),items=entries.map(e=>({id:e.id,check:field(list,e.date+' '+(e.purchase||e.merchant||e.memo)+' ／ '+yen(e.amount),'checkbox')}));
 f.append(button('全選択',()=>{for(const item of items)item.check.checked=true;}),button('選択解除',()=>{for(const item of items)item.check.checked=false;}),list);
 saveForm(f,'選択した明細を保存','classification.entries',()=>{
  const selected=items.filter(x=>x.check.checked).map(x=>({id:x.id}));
  if(!selected.length||!picker.major.value&&!person.value&&!spending.value)throw Error('変更する明細と項目を選んでください');
  return {items:selected,...picker.read(),...(person.value&&{person:person.value==='unset'?'':person.value}),...(spending.value&&{spendingKind:spending.value==='unset'?'':spending.value})};
 });
 dialog.append(f);
}
function advanceSettlementForm(){
 modal('立替の精算');
 const f=el('form'),date=field(f,'精算日','date',today,true),account=select(f,'返金の入金先',data.accounts.filter(a=>a.opening!==null).map(a=>[a.id,a.name]));
 const items=[];
 if(!account.value)account.value=account.options[0]?.value||'';
 for(const {id,remaining} of summary.advances||[]){
  if(!remaining)continue;
  const entry=data.entries.find(e=>e.id===id),box=section(entry.counterparty,f);
  box.append(el('p',entry.date+' ／ '+(entry.purchase||entry.merchant||entry.memo)+' ／ 未精算 '+yen(remaining)));
  const received=field(box,'今回の返金額','number',''),waive=field(box,'残額を免除して完了','checkbox');
  received.min=0;received.max=remaining;
  items.push({id,remaining,received,waive});
 }
 if(!items.length){dialog.append(el('p','未精算の立替はありません。'));return;}
 saveForm(f,'精算を記録','advance.settle',()=>({date:date.value,accountId:account.value,items:items.filter(x=>x.waive.checked||Number(x.received.value)>0).map(x=>({
  id:x.id,received:Number(x.received.value||0),waived:x.waive.checked?x.remaining-Number(x.received.value||0):0,
 }))}));
 dialog.append(f);
}
const savingsStatuses={active:'積立中',achieved:'達成',paused:'一時停止',ended:'終了'};
const savingsEvents={create:'目標を作成',update:'設定を変更',opening:'開始時の積立額',confirm:'積立を確定',add:'追加積立',assign:'確保元を割当',release:'取り崩し',move:'別の積立へ移動',pay:'支払いに充当',repay:'返済を記録'};
let savingsFilter='';
function savingsAccounts(empty=false){
 return [...(empty?[['','未設定']]:[]),...data.accounts.map(a=>[a.id,a.name])];
}
function savingsPage(){
 const overview=summary.savingsGoals;
 const intro=section('目的別積立');
 intro.append(button('＋ 積立目標を追加',()=>savingsGoalForm(),'primary'));
 if(!overview)return;
 metric(intro,'今月の積立予定総額',overview.pending+overview.confirmedScheduled);
 metric(intro,'今月の積立確定額',overview.confirmed);
 metric(intro,'今月の未確定額',overview.pending);
 if(overview.overdue)metric(intro,'前月以前の未確定額',overview.overdue);
 metric(intro,'現在の確保済み資金',overview.reserved);
 const filter=select(intro,'目標の状態',[['','すべて'],...Object.entries(savingsStatuses)],savingsFilter);
 filter.onchange=()=>{savingsFilter=filter.value;render();};
 const shown=overview.goals.filter(goal=>!savingsFilter||goal.displayStatus===savingsFilter);
 if(!shown.length)intro.append(el('p','表示できる目標はありません。','muted'));
 for(const goal of shown)savingsCard(root,goal);
 const deleted=(data.savingsGoals||[]).filter(goal=>goal.deleted);
 if(deleted.length){
  const archive=details(section('削除した積立目標'),'削除済み '+deleted.length+'件');
  for(const goal of deleted){
   const history=details(archive,goal.name);
   for(const event of (data.savingsGoalEvents||[]).filter(event=>event.goalId===goal.id||event.destination===goal.id).slice().reverse()){
    row(history,event.kind==='delete'?'削除・確保を解除':event.destination===goal.id?'別の積立から受取':savingsEvents[event.kind]||event.kind,event.amount?yen(event.amount):'',event.date);
   }
   for(const event of (data.savingsAllocations||[]).filter(event=>event.purpose===goal.legacyPurpose))row(history,'引継ぎ前の記録',yen(event.amount),event.date);
  }
 }
 if(overview.legacy.length){
  const legacy=section('これまでの目的別積立');
  legacy.append(el('p','確保元・目標額・期限は未設定です。履歴を見ながら新しい目標へ引き継げます。','muted'));
  for(const item of overview.legacy){
   const r=row(legacy,item.purpose,yen(item.balance));
   r.append(button('目標へ引き継ぐ',()=>savingsGoalForm(null,item)));
   for(const event of item.history)row(details(r,event.date),event.amount<0?'取り崩し':'積立',yen(Math.abs(event.amount)));
  }
 }
}
function savingsCard(host,goal){
 const s=section(goal.name,host);
 s.append(el('p',goal.category+' ／ '+savingsStatuses[goal.displayStatus],'muted'));
 metric(s,'目標額',goal.target);
 metric(s,'積立済み',goal.balance);
 metric(s,'残り必要額',goal.remaining);
 if(goal.target>0){
  const value=Math.round(100*(goal.balance+goal.principalPaid)/goal.target);
  const bar=el('progress');bar.max=100;bar.value=Math.min(100,value);
  bar.setAttribute('aria-label','達成率');
  s.append(bar,el('p','達成率 '+value+'％'));
 }
 const next=goal.plans[0];
 row(s,'目標期限',goal.deadline||'未設定');
 row(s,next?.date<today?'確認待ちの積立':'次回の積立',next?yen(next.amount):'予定なし',next?.date);
 row(s,'期限までの予定回数',goal.deadline||goal.frequency==='once'?goal.plans.length+'回':'未設定');
 row(s,'現在のペース',goal.onTrack===null||goal.status!=='active'?'要確認':goal.onTrack?'達成見込':'不足見込');
 if(goal.debt){
  metric(s,'実際に返済した元金',goal.principalPaid);
  metric(s,'借入元金残高',goal.debt.principal-goal.principalPaid);
  s.append(el('p',goal.debt.rate===null?'年利は未設定':'年利 '+goal.debt.rate+'％・返済実績に記録した利息を集計','muted'));
 }
 if(goal.unassigned)s.append(el('p','確保元が未割当 '+yen(goal.unassigned),'notice'),button('確保元を割り当てる',()=>savingsRecordForm(goal,'assign')));
 const actions=el('div',undefined,'pay-buttons savings-actions');
 if(goal.status==='active'&&next?.period<=today.slice(0,7))actions.append(button('積立を確定',()=>savingsRecordForm(goal,'confirm',next),'primary'));
 actions.append(button('金額・設定を変更',()=>savingsGoalForm(goal)),button('追加積立',()=>savingsRecordForm(goal,'add')));
 if(Object.values(goal.holdings).some(Boolean))actions.append(
  button('取り崩し',()=>savingsRecordForm(goal,'release')),
  button(goal.debt?'実際の返済を記録':'支払いに充当',()=>savingsRecordForm(goal,goal.debt?'repay':'pay')),
  button('別の積立へ移動',()=>savingsRecordForm(goal,'move')));
 if(goal.status==='active'&&goal.frequency==='irregular')actions.append(button('日付を指定して予定を追加',()=>savingsPlanForm(goal)));
 s.append(actions);
 if(goal.plans.length){
  const list=details(s,'積立予定を確認');
  for(const plan of goal.plans){
   const line=row(list,plan.date,yen(plan.amount));
   if(goal.frequency==='irregular')line.append(button('変更',()=>savingsPlanForm(goal,plan)),
    commandButton('取り消す','savings.goal.plan',{id:goal.id,date:plan.date,cancel:true},'danger'));
  }
 }
 const history=details(s,'履歴・確保元');
 for(const [id,value] of Object.entries(goal.holdings))if(value)metric(history,payName(id),value);
 if(goal.memo)history.append(el('p',goal.memo));
 for(const event of goal.history.slice().reverse()){
  const title=(event.destination===goal.id?'別の積立から受取':savingsEvents[event.kind])||event.kind;
  row(history,title,event.amount?yen(event.amount):'',event.date+(event.accountId?' ／ '+payName(event.accountId):'')+(event.principal!==undefined?' ／ 元金 '+yen(event.principal)+'・利息 '+yen(event.interest):''));
 }
 for(const event of (data.savingsAllocations||[]).filter(event=>event.purpose===goal.legacyPurpose))row(history,'引継ぎ前の記録',yen(event.amount),event.date);
 const actionsMore=details(s,'目標の管理');
 actionsMore.append(button('目標を削除',()=>{modal('目標を削除');dialog.append(
  el('p','残りの確保 '+yen(goal.balance)+' を解除します。口座残高と履歴は保持します。'),
  commandButton('確保を解除して削除','savings.goal.record',{id:goal.id,kind:'delete',confirm:true},'danger'));},'danger'));
}
function savingsGoalForm(goal,legacy){
 modal(goal?'積立目標を編集':legacy?'旧履歴から積立目標を作成':'積立目標を追加');
 const f=el('form');
 const name=field(f,'積立名','text',goal?.name||legacy?.purpose||'',true);
 const category=select(f,'カテゴリ',['旅行','借金返済','美容','生活費','その他'],goal?.category||'その他');
 const target=field(f,'目標額（円）','number',goal?.target??'');
 const deadline=field(f,'目標期限','date',goal?.deadline||'');
 const start=field(f,'積立開始月','month',goal?.startMonth||(goal||legacy?'':today.slice(0,7)));
 const frequency=select(f,'積立頻度',[['monthly','毎月'],['alternate','隔月'],['irregular','不定期'],['once','一括']],goal?.frequency||'monthly');
 const mode=select(f,'予定額の決め方',[['auto','残り回数から自動計算'],['manual','毎回の金額を指定']],goal?.mode||'auto');
 const planned=field(f,'毎回の予定額（円）','number',goal?.amount??'');
 const day=field(f,'積立日（毎月の何日か）','number',goal?.day||25,true);day.min=1;day.max=31;
 const account=select(f,'積立元',savingsAccounts(true),goal?.accountId||'');
 const initial=!goal&&!legacy?field(f,'現在の積立済み金額（円）','number',''):null;
 if(legacy)f.append(el('p','引継ぎ額 '+yen(Math.max(0,legacy.balance))+' ／ 確保元は引継ぎ後に設定','muted'));
 const status=select(f,'状態',Object.entries(savingsStatuses),goal?.status||'active');
 const memo=field(f,'メモ','textarea',goal?.memo||'');
 const debtBox=details(f,'借金返済の設定');
 const principal=field(debtBox,'管理開始時の借入元金（円）','number',goal?.debt?.principal??'');
 const rate=field(debtBox,'年利（％・任意）','number',goal?.debt?.rate??'');rate.step='any';
 debtBox.append(el('p','利息は返済時に実額を記録します。','muted'));
 const update=()=>{planned.parentElement.hidden=mode.value!=='manual';planned.required=mode.value==='manual';debtBox.hidden=category.value!=='借金返済'&&!goal?.debt;principal.required=category.value==='借金返済';};
 category.onchange=()=>{update();if(principal.required)debtBox.open=true;};
 mode.onchange=update;update();
 if(principal.required&&!principal.value)debtBox.open=true;
 saveForm(f,'目標を保存','savings.goal.save',()=>({
  id:goal?.id,legacyPurpose:legacy?.purpose,name:name.value,category:category.value,target:amount(target,{optional:true}),
  deadline:deadline.value,startMonth:start.value,frequency:frequency.value,mode:mode.value,
  amount:mode.value==='manual'?amount(planned):null,day:Number(day.value),accountId:account.value,
  initial:initial?amount(initial,{optional:true}):0,memo:memo.value,status:status.value,
  debt:principal.value?{principal:amount(principal),rate:rate.value===''?null:Number(rate.value)}:null,
 }));
 dialog.append(f);
}
function savingsPlanForm(goal,plan){
 modal(goal.name+'の積立予定');
 const f=el('form'),date=field(f,'予定日','date',plan?.date||today,true);
 date.min=today;if(goal.deadline)date.max=goal.deadline;
 const value=field(f,'予定額（円）','number',plan?.amount??'',true);
 saveForm(f,'積立予定を保存','savings.goal.plan',()=>({id:goal.id,date:date.value,previousDate:plan?.date,amount:amount(value)}));
 dialog.append(f);
}
function savingsRecordForm(goal,kind,plan){
 modal(savingsEvents[kind]+' ／ '+goal.name);
 const f=el('form'),adding=['confirm','add'].includes(kind),assign=kind==='assign',pays=['pay','repay'].includes(kind);
 const options=adding||assign?savingsAccounts(true):savingsAccounts().filter(([id])=>goal.holdings[id]>0);
 const account=select(f,adding?'積立元':assign?'確保元':'確保している口座・現金',options,adding||assign?goal.accountId||'':options[0]?.[0]);
 const to=adding?select(f,'実際に別口座へ移した場合の入金先',[['','積立元に取り分ける'],...savingsAccounts()]):null;
 const dest=kind==='move'?select(f,'移動先の積立目標',[['','選択してください'],...summary.savingsGoals.goals.filter(g=>g.id!==goal.id).map(g=>[g.id,g.name])]):null;
 const date=field(f,'実績日','date',today,true);date.max=today;
 const value=field(f,'金額（円）','number',plan?.amount??(assign?goal.unassigned:''),true);
 const principal=kind==='repay'?field(f,'うち元金返済額（円）','number','',true):null;
 const category=pays?select(f,'新しい支出を記録する場合の大カテゴリ',Object.keys(data.categories.tree),'その他'):null;
 const existing=pays?select(f,'すでに家計簿に入力した支出',[['','新しい支出として記録']]):null;
 const existingTransfer=adding?select(f,'すでに家計簿に入力した振替',[['','新しい振替として記録']]):null;
 const match=()=>{
  if(existing){
   existing.replaceChildren(new Option('新しい支出として記録',''));
   for(const e of data.entries.filter(e=>!e.void&&e.ledgerIncluded&&e.type==='expense'&&e.payment===account.value&&e.date===date.value&&e.amount===Number(value.value)))existing.append(new Option(e.purchase||e.memo||e.splits[0].category,e.id));
  }
  if(existingTransfer){
   existingTransfer.parentElement.hidden=!to.value;
   existingTransfer.replaceChildren(new Option('新しい振替として記録',''));
   for(const move of data.transfers.filter(move=>!move.void&&move.from===account.value&&move.to===to.value&&move.date===date.value&&move.amount===Number(value.value)))existingTransfer.append(new Option(move.reason||move.date+' の振替',move.id));
  }
 };
 account.onchange=date.onchange=value.oninput=match;if(to)to.onchange=match;match();
 saveForm(f,savingsEvents[kind],'savings.goal.record',()=>({
  id:goal.id,kind,period:plan?.period,date:date.value,amount:amount(value),accountId:account.value,to:to?.value,
  destination:dest?.value,principal:principal?amount(principal):undefined,category:category?.value,entryId:existing?.value,transferId:existingTransfer?.value,
 }));
 dialog.append(f);
}
function cardPurchasePlans(host,card){
 host.append(button('今後のカード利用予定を追加',()=>cardPurchasePlanForm(card)));
 const plans=(data.cardPurchasePlans||[]).filter(plan=>plan.cardId===card.id&&plan.status==='planned');
 if(!plans.length)return;
 const box=details(host,'今後のカード利用予定 '+plans.length+'件');
 for(const plan of plans){
  const r=row(box,plan.name,yen(plan.amount),'利用 '+plan.useDate+(plan.statementMonth?' ／ 請求月 '+plan.statementMonth:'')+' ／ 引落月 '+plan.month);
  r.append(button('予定を変更',()=>cardPurchasePlanForm(card,plan)),
   button('請求額・利用明細へ反映済み',()=>{modal('反映済みを確認');dialog.append(el('p','請求額・仮登録額・利用明細のどれかに、この金額が含まれていることを確認してください。'),
    commandButton('反映済みにする','card.purchasePlan.status',{id:plan.id,status:'covered'},'primary'));}),
   commandButton('予定を取り消す','card.purchasePlan.status',{id:plan.id,status:'cancelled'},'danger'));
 }
}
function cardPurchasePlanForm(card,plan){
 modal(plan?'カード利用予定を変更':'今後のカード利用予定を追加');
 const f=el('form'),name=field(f,'支払い名','text',plan?.name||'',true);
 const date=field(f,'カード利用予定日','date',plan?.useDate||'',true);
 const statementMonth=field(f,'請求月（分かる場合）','month',plan?.statementMonth||'');
 const month=field(f,'引落予定月','month',plan?.month||'',true);
 const value=field(f,'予定額（円）','number',plan?.amount??'',true);
 f.append(el('p','カードの利用予定を引落見込に含めます。利用明細・銀行残高は決済や引落を記録したときに更新します。','muted'));
 saveForm(f,'利用予定を保存','card.purchasePlan.save',()=>({id:plan?.id,cardId:card.id,name:name.value,useDate:date.value,statementMonth:statementMonth.value,month:month.value,amount:amount(value)}));
 dialog.append(f);
}
function settingsPage(){calendarSettings();const s=section('利用開始・保存');s.append(button('既存データを引き継ぐ',importForm),button('開始残高を設定',startForm),button('JSONバックアップを保存',download));if(data.importIssues.length){const review=details(s,'旧データの確認待ち '+data.importIssues.length+'件（原本保持）');for(const issue of data.importIssues){const line=row(review,issue.key,issue.reason);const entry=data.entries.find(e=>e.legacyKey===issue.key);if(entry)line.append(button('この取引を確認',()=>entryForm(entry)));}}const holidays=section('銀行休日');holidays.append(el('p','土日・12月31日〜1月3日は翌営業日へ調整します。祝日や振替休日は、確認した日付を登録してください。過去の引落日は書き換えません。','muted'));const f=el('form'),dates=field(f,'追加の銀行休日（1行にYYYY-MM-DDを1つ）','textarea',data.holidays.join('\n'));saveForm(f,'休日を保存','holidays',()=>({dates:dates.value.split(/\s+/).filter(Boolean)}));holidays.append(f);
 const categories=section('カテゴリを追加');
 const cf=el('form'),major=field(cf,'大カテゴリ','text','',true),middle=field(cf,'中カテゴリ（任意）','text','');
 saveForm(cf,'追加する','categories',()=>{
  const tree=structuredClone(data.categories.tree),name=major.value.trim(),child=middle.value.trim();
  if(!name)throw Error('大カテゴリを入力してください');
  tree[name]||={};
  if(child&&!Object.hasOwn(tree[name],child))tree[name][child]=[];
  return {tree,hidden:data.categories.hidden};
 });
 categories.append(cf);
 classificationSettingsPage();
 const audit=section('変更履歴');audit.append(button('最近の操作を確認',async()=>{const rows=await request('/audit');modal('変更履歴');for(const op of rows)row(dialog,op.created_at,({'entry.add':'取引の登録','entry.edit':'取引の編集','entry.void':'取引の取消','transfer':'口座振替','transfer.undo':'振替の取消','start':'開始残高の設定','account.adjust':'残高調整','plans.confirm':'固定費の引落確認','payments.confirm':'引落の一括確認','bill.confirm':'カード引落確認','bill.estimate':'カード利用額の登録','bill.reconcile':'カード利用額と明細の照合','cashflow.funds':'生活費・確保額の設定','bill.undo':'カード引落取消','plan.undo':'固定費引落取消','rule.save':'固定費の設定','plans.generate':'毎月の予定作成','plan.add':'単発の引落予定を登録','import':'旧データの取り込み','csv.import':'カードCSVの取り込み','classification.migrate':'カテゴリ体系の移行','classification.entries':'明細の一括分類','classification.people':'対象者の変更','classification.merchant':'自動分類ルールの変更','advance.settle':'立替精算','savings.allocate':'目的別積立','csv.billing.assign':'カード利用の請求月確認','fixed.import':'旧固定費の引き継ぎ'}[op.command_type]||'設定の更新'),'版 '+op.before_revision+' → '+op.after_revision);}));}
$('quick-add').onclick=()=>{if(data)entryForm();};
let checking=false;async function checkSession(){if(checking||!userId)return;checking=true;try{const fresh=await request();if(fresh.userId!==userId){closePrivate();userId='';inMemoryPending=null;await load();}}catch(e){error(e);}finally{checking=false;}}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')checkSession();});globalThis.addEventListener('pageshow',()=>checkSession());


function withdrawalPlanForm(targetMonth){
 modal('単発の引落予定を追加');
 const f=el('form'),banks=data.accounts.filter(a=>a.kind==='bank');
 if(!banks.length){dialog.append(el('p','口座画面で引落口座を追加してください。'));return;}
 f.append(el('p','指定した日だけの予定です。実際の引落を確定すると残高に反映します。','muted'));
 const name=field(f,'予定名','text','',true);name.maxLength=100;
 const due=field(f,'引落日','date',today.slice(0,7)===targetMonth?today:targetMonth+'-01',true);
 const n=field(f,'予定金額（円）','number','',true);n.min=1;
 const bank=select(f,'引落口座',[['','口座を選択'],...banks.map(a=>[a.id,a.name])]);bank.required=true;
 const category=categoryPicker(f,{category:'その他'});
 const person=personField(f);
 saveForm(f,'引落予定を保存','plan.add',()=>({id:crypto.randomUUID(),name:name.value,dueDate:due.value,amount:amount(n),payment:bank.value,...category.read(),person:person.value}),saved=>{month=saved.dueDate.slice(0,7);});
 dialog.append(f);
}
function cashPlansPage(){
 const schedule=section('月別の予定'),picker=field(schedule,'対象月','month',month,true);
 picker.onchange=async()=>{if(!picker.value){picker.value=month;return;}month=picker.value;try{await load();}catch(e){error(e);}};
 if(data.entries.some(e=>!e.void&&e.csvBilling?.status==='pending'))schedule.append(el('p','請求月が未確定のカード利用があります。月別の引落見込にはまだ含まれません。カード画面で確認できます。','notice'));
 schedule.append(el('p','予定を生成しただけでは残高は変わりません。固定費・カード引落・入金・振替を同じ月で確認できます。','notice'));
 schedule.append(button('＋ 単発の引落予定を追加',()=>withdrawalPlanForm(month),'primary'));
 const status=summary.schedule;
 if(status){
  const missing=status.missingFixed.length+status.missingCards.length;
  schedule.append(el('p',missing?'作成待ち：固定費 '+status.missingFixed.length+'件、カード引落 '+status.missingCards.length+'件':'固定費・カード設定から自動作成する予定はありません。','muted'));
  if(status.cancelled)schedule.append(el('p','取消済みの予定 '+status.cancelled+'件は、下の「確定済み・取消・記録済み」にあります。','muted'));
  if(status.unconfigured.length)schedule.append(el('p','引落口座・支払日の設定が必要なカード：'+status.unconfigured.join('、'),'muted'));
 }
 let generation;
 schedule.append(button('固定費・カードの不足分を作成',async()=>{
  if(status&&!status.missingFixed.length&&!status.missingCards.length){note(month+' の追加できる予定はありません。');return;}
  generation||={eventId:crypto.randomUUID(),command:{type:'plans.generate',data:{month,expectedRevision:revision}}};
  const payload=generation.command.data;
  const fixedIds=new Set(data.plans.map(p=>p.id)),billIds=new Set(data.bills.map(b=>b.id));
  try{await send('plans.generate',payload,generation.eventId,generation);}
  catch(e){
   if(e.status&&e.status<500)generation=null;
   if(e.status!==409)throw e;
   await load();
   note('予定の最新情報を読み込みました。作成待ちが残っていれば、もう一度押してください。');
   return;
  }
  generation=null;
  await load();
  const fixed=data.plans.filter(p=>p.month===payload.month&&!fixedIds.has(p.id)).length;
  const cards=data.bills.filter(b=>b.month===payload.month&&!billIds.has(b.id)).length;
  note(fixed||cards?payload.month+' に固定費 '+fixed+'件、カード引落 '+cards+'件を作成しました。':payload.month+' の追加できる予定はありません。');
 }));
 const reviewCount=status?.review??data.rules.filter(r=>r.needsReview).length;
 if(reviewCount)schedule.append(el('p','確認が必要な固定費が '+reviewCount+'件あります。固定費画面で日付と引落元を確認してください。','notice'));
 const fixed=data.plans.filter(p=>p.month===month&&p.status==='planned').sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
 for(const p of fixed)planRow(schedule,p);
 for(const b of data.bills.filter(b=>b.month===month&&b.status==='planned'))billRow(schedule,b);
 if(!fixed.length&&!data.bills.some(b=>b.month===month&&b.status==='planned'))schedule.append(el('p','この月の引落予定はありません。','muted'));
 const excluded=details(schedule,'確定済み・取消・記録済み');for(const p of data.plans.filter(p=>p.month===month&&p.status!=='planned'))row(excluded,p.name,yen(p.amount),p.dueDate+' ／ '+({confirmed:'確定済み',cancelled:'取消済み',excluded:'既存履歴に記録済み'}[p.status]||p.status));
 for(const b of data.bills.filter(b=>b.month===month&&b.status!=='planned'))row(excluded,payName(b.cardId),b.actual===null?'未確認':yen(b.actual),b.dueDate+' ／ '+(b.status==='confirmed'?'引落済み':'取消済み'));
 const s=section('入金・振替の予定');s.append(el('p','予定登録では残高を動かしません。実際の入金や振替を確認して確定します。家族カレンダーには自分だけの予定として表示します。','notice'),button('＋ 給与・手当などの入金予定',()=>cashPlanForm(null,'income'),'primary'),button('＋ 資金移動の予定',()=>cashPlanForm(null,'transfer')));
 const active=(data.cashPlans||[]).filter(p=>p.status==='planned'&&p.date.slice(0,7)===month).sort((a,b)=>a.date.localeCompare(b.date));
 if(!active.length)s.append(el('p','入金・振替の予定はありません。','muted'));
 for(const p of active)cashPlanRow(s,p);
 const done=details(s,'確定済みの予定');for(const p of (data.cashPlans||[]).filter(p=>p.status==='confirmed'))cashPlanRow(done,p);
 const link=el('a','家族カレンダーで見る');link.href='/wagaya/apps/calendar/';s.append(link);calendarSettings();
}
function cashPlanRow(host,p){const r=row(host,p.name,yen(p.amount),p.date+'・'+(p.kind==='income'?'入金先 '+payName(p.to):payName(p.from)+' → '+payName(p.to))+'・'+(p.status==='confirmed'?'確定済み':'予定'));r.append(button('確認・操作',()=>cashPlanDetail(p)));return r;}
function cashPlanForm(p,kind=p?.kind||'income',account){
 modal(kind==='income'?'入金予定':'資金移動の予定');const f=el('form'),name=field(f,'予定名','text',p?.name||'',true),date=field(f,'予定日','date',p?.date||today,true),n=field(f,'予定金額（円）','number',p?.amount||'',true),from=kind==='transfer'?select(f,'出金元',data.accounts.map(a=>[a.id,a.name]),p?.from||account):null,to=select(f,'入金先',data.accounts.map(a=>[a.id,a.name]),p?.to||account||'bank-0'),category=kind==='income'?field(f,'大カテゴリ','text',p?.category||'給与'):null,memo=field(f,'メモ（任意）','text',p?.memo||'');
 saveForm(f,'予定を保存','cashPlan.save',()=>({id:p?.id||crypto.randomUUID(),version:p?.version,kind,name:name.value,date:date.value,amount:amount(n),from:from?.value,to:to.value,category:category?.value,memo:memo.value}));dialog.append(f);
}
function cashPlanDetail(p){
 modal(p.name);dialog.append(el('p',p.date+'・'+yen(p.amount)+'・'+(p.kind==='transfer'?payName(p.from)+' → ':'')+payName(p.to)));
 if(p.status==='confirmed'){dialog.append(el('p','確定済みです。残高への反映を取り消すと、予定に戻ります。','notice'),commandButton('確定を取り消して予定に戻す','cashPlan.undo',{id:p.id,version:p.version},'danger'));return;}
 dialog.append(button('日付・金額を変更',()=>cashPlanForm(p)),commandButton('この予定を削除','cashPlan.cancel',{id:p.id,version:p.version},'danger'));
 const f=el('form'),date=field(f,'実際に入金・振替した日','date',p.date<=today?p.date:today,true);f.append(el('p','銀行の実際の動きを確認してから確定してください。','notice'));saveForm(f,'実行済みとして確定','cashPlan.confirm',()=>({id:p.id,version:p.version,date:date.value}));dialog.append(f);
}
function calendarSettings(){const s=section('家計予定の通知');if(!calendarStatus.enabled)s.append(el('p','開発版の連携はまだ有効化していません。本番切替の確認後に設定します。','notice'));if(calendarStatus.pending)s.append(el('p','通知予約に未同期が '+calendarStatus.pending+'件あります。予定は保存済みです。','notice'),button('通知予約の同期を再試行',async()=>{calendarStatus=await request('/calendar-resync','POST',{});await load();}));const f=el('form'),saved=data.calendarNotice||{enabled:false,time:'09:00',daysBefore:1},enabled=field(f,'既存のHOME通知で知らせる','checkbox');enabled.checked=saved.enabled;const days=select(f,'いつ知らせるか',[['0','当日'],['1','前日'],['2','2日前'],['3','3日前'],['7','1週間前']],String(saved.daysBefore)),time=field(f,'通知時刻（日本時間）','time',saved.time,true);f.append(el('p','HOMEで通知を受け取る設定を済ませた本人の端末に届きます。ロック画面には金額や口座名を表示しません。確定済み・削除した予定は通知しません。','muted'));saveForm(f,'通知設定を保存','calendar.settings',()=>({enabled:enabled.checked,time:time.value,daysBefore:Number(days.value)}));s.append(f);}
let budgetLinkOpened=false;
async function openBudgetLink(){if(budgetLinkOpened||pending())return;const source=new URL(location.href).searchParams.get('source');if(!source)return;budgetLinkOpened=true;if(!/^bg[a-f0-9]{32}$/.test(source))throw Error('予定のリンクを確認してください');const item=await request('/calendar-item?'+new URLSearchParams({source}));if(item.kind==='saving'){const goal=summary.savingsGoals?.goals.find(goal=>goal.id===item.id);if(!goal)throw Error('積立予定が更新されています');tab='savings';render();modal('積立予定を確認');savingsCard(dialog,goal);}else if(item.kind==='cash'){const p=(data.cashPlans||[]).find(p=>p.id===item.id);if(p)cashPlanDetail(p);}else if(item.kind==='bill'){const b=data.bills.find(b=>b.id===item.id);if(!b)throw Error('予定が更新されています');billForm(b);}else{const p=data.plans.find(p=>p.id===item.id);if(!p)throw Error('予定が更新されています');modal(p.name);if(p.status==='planned')planRow(dialog,p);else dialog.append(el('p','この引落は確定済みです。'),commandButton('引落の確定を取り消す','plan.undo',{id:p.id,reason:'家計予定から引落取消'},'danger'));}}

load().catch(error);

async function fixedImportForm(){
 modal('旧固定費を確認して引き継ぐ');
 const preview=await request('/legacy-fixed-preview'),f=el('form'),target=field(f,'予定を作り始める月','month',month||today.slice(0,7),true),items=[];
 f.append(el('p','引き継ぐものだけ選択してください。今月の支払済み履歴があれば対応付けます。対応付ける履歴は、すでに現在の残高に含まれていることを確認してください。記録済みの月は予定から除外し、残高への追加反映はしません。','notice'));
 for(const r of preview.rules){
  const box=el('section'),check=field(box,r.name+' ／ '+yen(r.amount)+' ／ '+r.payment,'checkbox');
  if(preview.links[r.id]){check.disabled=true;box.append(el('p','引き継ぎ済みです。','muted'));f.append(box);continue;}
  const payment=select(box,'引落元',payments(),data.cards.find(c=>c.name===r.payment)?.id||data.accounts.find(a=>a.name===r.payment)?.id||'');
  const date=field(box,'毎月の利用日・引落日','number',r.dateMode==='monthly'?r.day:'',true);date.min=1;date.max=31;
  if(r.dateMode!=='monthly')box.append(el('p','旧設定では日付が固定されていません。実際の日を確認してください。','notice'));
  const variable=field(box,'金額が変わる固定費','checkbox');
  const replace=select(box,'置き換える新しい固定費（あれば）',[['','置き換えない'],...data.rules.filter(x=>x.enabled).map(x=>[x.id,x.name+' ／ '+yen(x.amount)])]);
  const candidates=[...data.entries.filter(e=>!e.void&&e.type==='expense'&&e.amount===r.amount).map(e=>['new:'+e.id,'新履歴 '+e.date+' '+(e.memo||e.splits[0].category)+' ／ '+payName(e.payment)]),...preview.entries.filter(e=>e.amount===r.amount&&e.payment===r.payment).map(e=>['old:'+e.id,'旧履歴 '+e.date+' '+e.memo])];
  const recorded=select(box,'対象月の支払済み履歴',[['','未払い・予定を作成する'],...candidates]);
  const toggle=()=>{for(const n of box.querySelectorAll('input,select'))if(n!==check)n.disabled=!check.checked;};check.onchange=toggle;toggle();
  items.push({r,check,payment,date,variable,replace,recorded});f.append(box);
 }
 const confirmInput=field(f,'引落元・日付・置換対象・支払済み履歴を確認しました','checkbox','',true);
 saveForm(f,'確認した固定費を引き継ぐ','fixed.import',()=>({sourceHash:preview.sourceHash,month:target.value,confirm:confirmInput.checked,rules:items.filter(x=>x.check.checked).map(x=>{const sep=x.recorded.value.indexOf(':');return {sourceId:x.r.id,payment:x.payment.value,day:Number(x.date.value),variable:x.variable.checked,replaceRuleId:x.replace.value||null,recordedKind:sep<0?null:x.recorded.value.slice(0,sep),recordedId:sep<0?null:x.recorded.value.slice(sep+1)};})}));dialog.append(f);
}
async function csvImportForm(card){
 modal(card.name+' のCSV取り込み');const f=el('form'),file=field(f,'楽天カードの利用明細CSV','file','',true);file.accept='.csv,text/csv';
 const statement=field(f,'CSVの基準となる請求月','month','',true),previewHost=el('div'),confirmInput=field(f,'カード・請求月・重複候補・分類を確認しました','checkbox','',true);let rows=[],controls=[];
 f.append(el('p','「翌月以降」の利用も取り込めます。請求月が決まるまでは月別の引落見込に含めません。店名の半角・全角は照合時に統一します。ファイルはこの画面で解析します。登録するのは選択した明細です。開始日より前の利用は未払金へ加算せず、開始日以降の請求月の引落見込に表示します。','notice'),previewHost);
 const fillUnclassified=(value,store)=>{
  let count=0;
  for(const item of controls){
   if(!item.category||item.category.disabled||item.category.value||store!==undefined&&item.store!==store)continue;
   item.picker.setPath(typeof value==='string'?{category:value}:value);
   item.categoryStatus.textContent=store===undefined?'一括設定':'同じ店の明細から設定';
   count++;
  }
  return count;
 };
 file.onchange=async()=>{
  previewHost.replaceChildren();rows=[];controls=[];confirmInput.checked=false;f.querySelector('button[type=submit]').disabled=true;
  try{
   if(!file.files[0])return;if(file.files[0].size>2000000)throw Error('CSVは2MB以内で選んでください');
   const decoded=decodeCardCsv(await file.files[0].arrayBuffer());rows=parseRakutenCsv(decoded.text);
   if(rows.length>500)throw Error('一度の取り込みは500行以内にしてください');
   previewHost.append(el('p',decoded.encoding+' ／ '+rows.length+'行を確認しました。対象外・不明な行も以下で確認してください。','muted'));
   const bulk=el('div');
   const view=select(bulk,'表示',[['','すべて'],['unclassified','未分類'],['classified','分類済み']]);
   const picker=categoryPicker(bulk,{},true);
   const person=select(bulk,'対象者',[['','変更しない'],['unset','未設定'],...(data.people||defaultPeople)]),spending=select(bulk,'支出区分',[['','変更しない'],['unset','未設定'],...spendingKinds]);
   const count=el('p',undefined,'muted');count.setAttribute('role','status');
   const editable=()=>controls.filter(x=>x.category&&!x.category.disabled);
   const visible=item=>!view.value||view.value==='unclassified'&&!item.category.value||view.value==='classified'&&!!item.category.value;
   const refresh=()=>{
    for(const item of controls.filter(x=>x.box))item.box.hidden=!!view.value&&(!item.category||item.category.disabled||!visible(item));
    count.textContent=editable().filter(x=>x.chosen.checked).length+'件を選択中';
    confirmInput.checked=false;
   };
   view.onchange=refresh;
   bulk.append(button('表示中を全選択',()=>{for(const x of editable().filter(visible))x.chosen.checked=true;refresh();}),
    button('選択解除',()=>{for(const x of controls)if(x.chosen)x.chosen.checked=false;refresh();}),
    button('選択した明細を一括変更',()=>{
     const items=editable().filter(x=>x.chosen.checked&&visible(x));
     if(!items.length)throw Error('変更する明細を選んでください');
     if(!picker.major.value&&!person.value&&!spending.value)throw Error('一括変更する項目を選んでください');
     for(const item of items){
      if(picker.major.value)item.picker.setPath(picker.read());
      if(person.value)item.person.value=person.value==='unset'?'':person.value;
      if(spending.value)item.spending.value=spending.value==='unset'?'':spending.value;
     }
     refresh();
    }),button('選択した明細に分類候補を適用',()=>{
     const items=editable().filter(x=>x.chosen.checked&&visible(x)&&!x.category.value&&x.suggestion.category&&!x.suggestion.ambiguous);
     if(!items.length)throw Error('候補が一つに絞れる未分類明細を選んでください');
     for(const item of items){
      item.picker.setPath(item.suggestion);
      item.person.value=item.suggestion.person||'';
     }
     refresh();
    }),button('未分類の明細に一括設定',()=>{
     if(!picker.major.value)throw Error('一括設定するカテゴリを選んでください');
     fillUnclassified(picker.read());refresh();
    }),count);
   previewHost.append(bulk);
   const imported=data.csvImports||{},used=new Set(Object.values(imported));
   const keyed=await Promise.all(rows.map(async row=>({...row,key:await fingerprint(card.id,row)})));
   const matches=matchCsvRows(data,card.id,keyed);
   for(const match of matches.values())used.add(match.id);
   let excluded=0;
   for(const rowData of keyed){
    const key=rowData.key,match=matches.get(key);
    if(match){
     const prior=data.entries.find(e=>e.id===match.id);
     if(prior?.csvBilling?.status==='pending'&&!rowData.billingDeferred||!match.registered){
      controls.push({row:rowData,key,action:{value:'match:'+match.id},autoMatch:true});
     }
     excluded++;continue;
    }
    const box=el('section');previewHost.append(box);
    box.append(el('h3',rowData.date+' ／ '+rowData.merchant+' ／ '+yen(rowData.signedAmount)));
    if(rowData.paymentMonth)box.append(el('p','CSVの支払月：'+rowData.paymentMonth,'muted'));
    if(rowData.error){box.append(el('p','取り込み対象外・要確認 '+rowData.error,'notice'));continue;}
    const candidates=csvCandidates(data,card.id,rowData).filter(e=>!used.has(e.id));
    const pending=data.plans.filter(p=>p.status==='planned'&&p.payment===card.id&&p.amount===Math.abs(rowData.signedAmount)&&p.month===rowData.date.slice(0,7)&&rowData.signedAmount>0);
    const options=[['add','新しい利用として登録'],...pending.map(p=>['plan:'+p.id,'カード固定費と対応付け '+p.name+' ／ '+yen(p.amount)]),...candidates.map(e=>['match:'+e.id,'手入力と対応付け '+e.date+' '+e.memo+' ／ '+yen(e.amount)]),['skip','今回は取り込まない']];
    const action=select(box,'明細の扱い',options,candidates.length||pending.length?'skip':'add');
    if(candidates.length||pending.length)box.append(el('p','同じカード・日付・金額の履歴があります。店名も確認して対応付けるか、別の購入として登録してください。','notice'));
    const suggestion=suggestCategory(data,rowData.merchant);
    const picker=categoryPicker(box,{},true),category=picker.major;
    const person=personField(box,suggestion.person||'');person.value='';
    const extra=details(box,'購入内容・支出区分など（任意）');
    const purchase=field(extra,'購入内容','text','');purchase.maxLength=500;
    const spending=select(extra,'支出区分',[['','未設定'],...spendingKinds]);
    const savings=select(extra,'積立の種類',[['','指定なし'],'カード投資積立']);
    const advance=field(box,'立替払いとして登録','checkbox');
    const counterparty=field(box,'立替先（精算相手）','text','');counterparty.maxLength=100;
    const remember=field(extra,'この分類を次回の候補に保存','checkbox');
    const categoryStatus=el('p',suggestion.source,'muted');box.append(categoryStatus);
    const candidatesForStore=suggestion.candidates?.length?suggestion.candidates:[suggestion];
    for(const candidate of candidatesForStore.filter(x=>x.category)){
     box.append(button('候補を使う：'+[candidate.category,candidate.middle,candidate.person].filter(Boolean).join(' ／ '),()=>{
      if(category.disabled)return;
      picker.setPath(candidate);if(candidate.person&&!Array.from(person.options).some(o=>o.value===candidate.person))person.append(new Option(candidate.person,candidate.person));person.value=candidate.person||'';refresh();
     }));
    }
    const separate=field(box,'同日・同額の履歴とは別の購入であることを確認','checkbox');
    if(rowData.identicalCount>1)box.append(el('p','CSV内に同日・同店・同額の行が複数あります。行ごとに確認してください。','notice'));
    const chosen=field(box,'一括変更の対象にする','checkbox');
    const update=()=>{
     const enabled=action.value==='add'||action.value.startsWith('plan:');
     for(const input of [category,picker.middle,person,purchase,spending,savings,remember,chosen])input.disabled=!enabled;
     separate.disabled=action.value!=='add'||!(candidates.length||pending.length);
     advance.disabled=!enabled||rowData.signedAmount<0;
     counterparty.disabled=advance.disabled||!advance.checked;
     counterparty.required=!counterparty.disabled;
    };
    action.onchange=()=>{update();refresh();};advance.onchange=()=>{update();refresh();};counterparty.oninput=()=>{confirmInput.checked=false;};update();
    const store=merchantKey(rowData.merchant);
    const refreshCategory=category.onchange;
    category.onchange=()=>{
     refreshCategory();
     if(!data.classificationVersion&&category.value&&!suggestion.review)fillUnclassified(category.value,store);
     refresh();
    };
    for(const input of [picker.middle,person,purchase,spending,savings,remember,chosen,separate])input.addEventListener('change',refresh);
    controls.push({row:rowData,key,action,category,categoryStatus,separate,store,picker,person,purchase,spending,savings,remember,chosen,box,suggestion,advance,counterparty});
   }
   previewHost.prepend(el('p',excluded+'件の登録済み明細を自動除外しました'+(controls.some(x=>x.autoMatch)?'（既存履歴との対応付け・請求月更新は保存時に実行します）':'')+'。','notice'));
   bulk.hidden=!controls.some(x=>x.box);
   f.querySelector('button[type=submit]').disabled=!controls.length;
   if(!controls.length)previewHost.append(el('p','新規明細はありません。再登録は不要です。','notice'));
   refresh();
  }catch(e){rows=[];controls=[];error(e);}
 };
 saveForm(f,'確認したCSV明細を取り込む','csv.import',()=>{
  if(!rows.length)throw Error('CSVを読み込んでください');
  const selected=controls.filter(x=>x.action.value!=='skip');if(selected.some(x=>x.category&&!x.category.disabled&&!x.category.value))throw Error('取り込む明細の大カテゴリを選んでください');if(!selected.length)throw Error('登録または対応付けする明細を選んでください');
  if(selected.some(x=>!x.row.billingDeferred&&x.row.billingMonthNumber&&x.row.billingMonthNumber!==Number(statement.value.slice(5))))throw Error('選んだ明細の支払月と請求月が一致しません。対象の月の明細だけ選んでください');
  return {cardId:card.id,statementMonth:statement.value,confirm:confirmInput.checked,rows:selected.map(x=>({key:x.key,date:x.row.date,merchant:x.row.merchant,signedAmount:x.row.signedAmount,method:x.row.method,paymentMonth:x.row.paymentMonth,billingMonthNumber:x.row.billingMonthNumber,occurrence:x.row.occurrence,...x.picker?.read(),person:x.person?.value,purchase:x.purchase?.value,spendingKind:x.spending?.value,savingsKind:x.savings?.value,remember:x.remember?.checked,advance:!!x.advance?.checked,counterparty:x.counterparty?.value,autoMatch:x.autoMatch===true,separate:x.separate?.checked,action:x.action.value==='assign'?'assign':x.action.value.startsWith('match:')?'match':x.action.value.startsWith('plan:')?'plan':'add',planId:x.action.value.startsWith('plan:')?x.action.value.slice(5):null,entryId:x.action.value.startsWith('match:')?x.action.value.slice(6):null}))};
 });dialog.append(f);
}

function historicalCsvBillingForm(entries){
 modal('開始日前のCSV明細の請求月');
 const f=el('form');
 f.append(el('p','カードの請求書に載っている明細を選んでください。選んだ明細の利用日と登録額はそのまま、引落見込の月を更新します。','notice'));
 const target=field(f,'請求書の支払月','month',today.slice(0,7),true);
 const actions=el('div',undefined,'actions');
 const count=el('p',undefined,'muted');
 count.setAttribute('role','status');
 f.append(actions,count);
 const choices=entries.map(entry=>({
  id:entry.id,
  checkbox:field(f,entry.date+' ／ '+entry.memo+' ／ '+yen(entry.amount)+' ／ '+(entry.csvBilling?.month||'請求月未確定'),'checkbox'),
 }));
 const confirm=field(f,'選んだ明細がこの請求月の請求書に載っていることを確認しました','checkbox','',true);
 const selected=()=>choices.filter(choice=>choice.checkbox.checked);
 const updateSelection=()=>{
  count.textContent=selected().length+'件を選択中（全'+choices.length+'件）';
  confirm.checked=false;
 };
 const setSelection=checked=>{
  for(const choice of choices)choice.checkbox.checked=checked;
  updateSelection();
 };
 actions.append(button('すべて選択',()=>setSelection(true)),button('すべて解除',()=>setSelection(false)));
 for(const choice of choices)choice.checkbox.onchange=updateSelection;
 target.onchange=updateSelection;
 updateSelection();
 saveForm(f,'選んだ明細の請求月を保存','csv.billing.assign',()=>{
  const entryIds=selected().map(choice=>choice.id);
  if(!entryIds.length)throw Error('請求月を変更する明細を選んでください');
  return {entryIds,month:target.value,confirm:confirm.checked};
 });
 dialog.append(f);
}
function csvBillingForm(entry){
 modal('カード利用の請求月を確認');const f=el('form');f.append(el('p',entry.memo+' ／ '+yen(entry.amount)+' ／ '+entry.csvBilling.earliestMonth+'以降'));const target=field(f,'確定した請求月','month',entry.csvBilling.earliestMonth,true);target.min=entry.csvBilling.earliestMonth;const check=field(f,'カード明細で請求月を確認しました','checkbox','',true);f.append(el('p','利用額を再計上せず、請求月と引落見込だけ更新します。銀行残高は変更しません。','notice'));saveForm(f,'請求月を設定','csv.billing.assign',()=>({entryId:entry.id,month:target.value,confirm:check.checked}));dialog.append(f);
}
