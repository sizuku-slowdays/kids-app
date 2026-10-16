const $=id=>document.getElementById(id),directory=new URL('./',location.href),endpoint=new URL('../../api/school-prep',directory),login=new URL('../../login',directory);
const initial=new URL(location.href).searchParams;
let household=initial.get('household')||'',child=initial.get('child')||'',phase=['homework','night','morning'].includes(initial.get('phase'))?initial.get('phase'):'homework',day=initial.get('day')||'',state,loadId=0,busy=false;
const labels={homework:'宿題',night:'夜のじゅんび',morning:'朝のかくにん'};
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function button(text,fn,cls){const b=el('button',text,cls);b.type='button';b.onclick=async()=>{if(busy)return;busy=true;b.disabled=true;$('status').textContent='';try{await fn();}catch(e){$('status').textContent=e.message;}finally{busy=false;if(b.isConnected)b.disabled=false;}};return b;}
function field(parent,label,node){const l=el('label',label);l.append(node);parent.append(l);return node;}
function dateLabel(value){return new Date(value+'T12:00:00+09:00').toLocaleDateString('ja-JP',{month:'long',day:'numeric',weekday:'short'});}
function tomorrow(value){return new Date(Date.parse(value+'T12:00:00+09:00')+86400000).toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'});}
function targetDay(p){if(p!=='night')return state.today;return state.days.filter(d=>d.is_school_day&&d.school_day>state.today).map(d=>d.school_day).sort()[0]||tomorrow(state.today);}
async function api(path='',method='GET',body){
 const url=new URL(endpoint);url.pathname+=path;if(household)url.searchParams.set('household',household);if(child)url.searchParams.set('child',child);if(day)url.searchParams.set('day',day);
 const response=await fetch(url,{method,credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});
 if(response.status===401){location.replace(login.pathname);throw Error('HOMEにログインしてください');}
 if(!(response.headers.get('Content-Type')||'').includes('application/json'))throw Error('HOMEからひらき直してください');
 const data=await response.json();if(!response.ok)throw Error(data.error||'保存できませんでした');return data;
}
async function load(adjust=false){
 const token=++loadId;$('content').replaceChildren(el('p','よみこみ中…','muted'));try{
  const data=await api();if(token!==loadId)return;state=data;household=data.household_id;child=data.selected||'';day=data.day;
  if(adjust&&day!==targetDay(phase)){day=targetDay(phase);return load();}
  $('status').textContent='';render();
 }catch(e){if(token===loadId)$('status').textContent=navigator.onLine===false?'通信できません。保存されていない操作は反映されません。':e.message;}
}
function card(){const c=el('section',undefined,'card');$('content').append(c);return c;}
function render(){
 $('people').replaceChildren();$('tabs').replaceChildren();$('content').replaceChildren();
 if(state.groups.length>1){const select=el('select');for(const g of state.groups){const option=el('option',g.name);option.value=g.id;select.append(option);}select.value=household;select.setAttribute('aria-label','家庭');select.onchange=()=>{household=select.value;child='';day='';load(true);};$('people').append(select);}
 if(state.admin&&state.children.length>1){const select=el('select');select.setAttribute('aria-label','子ども');for(const c of state.children){const option=el('option',c.display_name);option.value=c.id;select.append(option);}select.value=child;select.onchange=()=>{child=select.value;day='';load(true);};$('people').append(select);}
 else $('people').append(el('p',state.children.find(c=>c.id===child)?.display_name||'子どものHOMEアカウントを連携してください','person'));
 for(const [p,label] of Object.entries(labels)){const b=button(label,async()=>{phase=p;day=targetDay(p);await load();});b.setAttribute('aria-pressed',String(phase===p));$('tabs').append(b);}
 if(!child)return;
 const plan=state.plan,c=card();c.append(el('p',dateLabel(day)+' の'+labels[phase],'date'));
 const sub={homework:'きょうの宿題',night:'次の登校日のもちもの',morning:'きょう学校に持っていくもの'}[phase];c.append(el('h2',sub));
 if(state.admin){const picker=el('input');picker.type='date';picker.value=day;picker.onchange=()=>{if(picker.value){day=picker.value;load();}};field(c,'見る日・登録する日',picker);}
 if(plan?.dismissal)c.append(el('p','下校じこく '+plan.dismissal,'muted'));
 if(!plan)c.append(el('p',state.admin?'この日はまだ登録していません。下の「内容を登録・変更」から入力できます。':'まだ内容がありません。おうちの人に登録してもらおう。','muted'));
 else if(!plan.is_school_day)c.append(el('p','この日は学校がお休みです。'));
 else{
  const tasks=plan.tasks.filter(t=>t.kind===(phase==='homework'?'homework':'belonging')).map(t=>({...t,done:state.checks.some(c=>c.task_id===t.id&&c.phase===phase&&c.done===1)})).sort((a,b)=>Number(a.done)-Number(b.done));
  for(const t of tasks){const row=el('div',undefined,'task'+(t.done?' done':''));row.append(el('span',t.text,'task-name'));
   const b=button(t.done?'できた！':phase==='night'?'用意した':phase==='morning'?'持った':'できた！',async()=>{
    const request_id=crypto.randomUUID();await api('/check','POST',{revision:plan.revision,task_id:t.id,phase,done:!t.done,request_id});await load();
   },t.done?'stamp':'');b.disabled=state.admin||day!==targetDay(phase);b.setAttribute('aria-label',t.text+(t.done?'・完了を取り消す':'・完了にする'));b.setAttribute('aria-pressed',String(t.done));row.append(b);c.append(row);
  }
  if(!tasks.length)c.append(el('p','登録された項目はありません。','muted'));
  if(tasks.length&&tasks.every(t=>t.done))c.append(el('p','🌸 ぜんぶできたね！','cheer'));
 }
 if(state.admin){renderEditor();renderNotifications();}
 const summary=card();summary.append(el('h2','30登校日のきろく'),el('p',`${state.summary.completed} 日 できた！`,'summary-number'),el('p',`登録された直近 ${state.summary.school_days} / 30 登校日`,'muted'),el('small','宿題と、夜・朝のもちものを全部確認できた日です。空のリスト・お休みは数えません。ランク・ポイント付与はまだありません。'));
}
function renderEditor(){
 const c=card(),details=el('details');details.open=!state.plan;details.append(el('summary','内容を登録・変更（保護者）'));c.append(details);
 const form=el('form'),hw=el('textarea'),bag=el('textarea'),time=el('input'),school=el('input');time.type='time';time.value=state.plan?.dismissal||'';school.type='checkbox';school.checked=state.plan?!!state.plan.is_school_day:true;
 hw.value=(state.plan?.tasks||[]).filter(t=>t.kind==='homework').map(t=>t.text).join('\n');bag.value=(state.plan?.tasks||[]).filter(t=>t.kind==='belonging').map(t=>t.text).join('\n');hw.maxLength=16000;bag.maxLength=16000;
 field(form,'登校日',school);field(form,'宿題（1行に1つ）',hw);field(form,'持ち物（1行に1つ）',bag);field(form,'下校時刻（空欄でもOK）',time);
 form.append(el('small','確定すると子どもの画面に表示されます。変更して再確定すると、その日のチェックは新しく始まります。以前の版と記録は残ります。'));
 const save=button('確認して確定する',async()=>{
  const tasks=[...hw.value.split('\n').map(text=>({kind:'homework',text})),...bag.value.split('\n').map(text=>({kind:'belonging',text}))].filter(t=>t.text.trim()).map(t=>({...t,id:crypto.randomUUID()}));
  if(tasks.length>80||tasks.some(t=>t.text.length>200))throw Error('項目は80件まで、1項目200文字以内で入力してください');
  if(state.plan&&!confirm('この日の内容を新しい版として確定します。チェックは新しく始まります。よろしいですか？'))return;
  await api('/confirm','POST',{day,expected_revision:state.plan?.revision||0,is_school_day:school.checked,dismissal:time.value||null,tasks});await load();
 },'primary');form.append(save);form.onsubmit=e=>e.preventDefault();details.append(form);
}
function renderNotifications(){
 const c=card(),details=el('details');details.append(el('summary','自分への完了通知'));c.append(details);
 const checkbox=el('input');checkbox.type='checkbox';checkbox.checked=state.notify_enabled;
 field(details,'宿題・夜・朝が全部終わったら自分に通知',checkbox);
 checkbox.onchange=async()=>{checkbox.disabled=true;try{await api('/preferences','PUT',{notify_enabled:checkbox.checked});await load();}catch(e){checkbox.checked=!checkbox.checked;$('status').textContent=e.message;}finally{checkbox.disabled=false;}};
 details.append(el('small','我が家HOMEで登録済みの自分の端末へ送ります。名前・宿題の内容は通知文に出しません。学校準備の通知だけを設定します。'));
 const a=el('a','端末登録を確認する（カレンダー）');a.href=new URL('../calendar/',directory).pathname;details.append(a);details.append(el('small','すでにHOMEカレンダーの通知が届く端末は再登録不要です。未登録ならカレンダーの「この端末で、自分として通知を受け取る」から登録できます。'));
 if(state.notifications.length){const list=el('ul',undefined,'notification-history');for(const n of state.notifications)list.append(el('li',dateLabel(n.school_day)+' '+labels[n.phase]+'：'+({sent:'送信済み',cancelled:'取消・権限変更で停止',pending:'送信待ち',sending:'送信中'})[n.status]));details.append(list);if(state.notifications.some(n=>n.status==='pending'))details.append(button('送信待ちをもう一度送る',async()=>{await api('/notifications/retry','POST',{});await load();}));}
}
$('reload').onclick=()=>load();document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!document.querySelector('details[open] form')){day='';load(true);}});load(!initial.get('day'));
