import {mondayOf,parseWeekText,templateText,homeworkLines} from './weekly-core.js';
const $=id=>document.getElementById(id),directory=new URL('./',location.href),endpoint=new URL('../../api/school-prep',directory),login=new URL('../../login',directory);
const initial=new URL(location.href).searchParams;
let household=initial.get('household')||'',child=initial.get('child')||'',phase=['homework','night','morning'].includes(initial.get('phase'))?initial.get('phase'):'homework',day=initial.get('day')||'',state,loadId=0,busy=false,chosenDay=!!initial.get('day');
const labels={homework:'宿題',night:'夜のじゅんび',morning:'朝のかくにん'};
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function button(text,fn,cls){const b=el('button',text,cls);b.type='button';b.onclick=async()=>{if(busy)return;busy=true;b.disabled=true;$('status').textContent='';try{await fn();}catch(e){$('status').textContent=e.message;}finally{busy=false;if(b.isConnected)b.disabled=false;}};return b;}
function field(parent,label,node){const l=el('label',label);l.append(node);parent.append(l);return node;}
function dateLabel(value){return new Date(value+'T12:00:00+09:00').toLocaleDateString('ja-JP',{month:'long',day:'numeric',weekday:'short'});}
function targetDay(p){return p==='night'?state.next_school_day:state.today;}
async function api(path='',method='GET',body,params={}){
 const url=new URL(endpoint);url.pathname+=path;if(household)url.searchParams.set('household',household);if(child)url.searchParams.set('child',child);if(day)url.searchParams.set('day',day);
 for(const [k,v] of Object.entries(params))url.searchParams.set(k,v);
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
 if(state.groups.length>1){const select=el('select');for(const g of state.groups){const option=el('option',g.name);option.value=g.id;select.append(option);}select.value=household;select.setAttribute('aria-label','家庭');select.onchange=()=>{household=select.value;child='';day='';chosenDay=false;load(true);};$('people').append(select);}
 if(state.admin&&state.children.length>1){const select=el('select');select.setAttribute('aria-label','子ども');for(const c of state.children){const option=el('option',c.display_name);option.value=c.id;select.append(option);}select.value=child;select.onchange=()=>{child=select.value;day='';chosenDay=false;load(true);};$('people').append(select);}
 else $('people').append(el('p',state.children.find(c=>c.id===child)?.display_name||'子どものHOMEアカウントを連携してください','person'));
 for(const [p,label] of Object.entries(labels)){const b=button(label,async()=>{phase=p;if(!chosenDay)day=targetDay(p);await load();});b.setAttribute('aria-pressed',String(phase===p));$('tabs').append(b);}
 if(!child)return;
 const plan=state.plan,c=card();c.append(el('p',dateLabel(day)+(phase==='night'?' のもちもの':' の'+labels[phase]),'date'));
 const sub={homework:day===state.today?'きょうの宿題':'この日の宿題',night:day===state.next_school_day?'次の登校日のもちもの':'この日のもちもの（夜）',morning:day===state.today?'きょう学校に持っていくもの':'この日のもちもの（朝）'}[phase];c.append(el('h2',sub));
 const picker=el('input');picker.type='date';picker.value=day;picker.setAttribute('aria-label','見る日');picker.onchange=()=>{if(picker.value){day=picker.value;chosenDay=true;load();}};field(c,state.admin?'見る日・登録する日':'見る日（みるひ）',picker);
 const dates=el('div',undefined,'row');
 for(const [label,offset] of [['前の日',-1],['今日',0],['次の日',1]])dates.append(button(label,async()=>{day=offset?new Date(Date.parse(day+'T12:00:00Z')+offset*86400000).toISOString().slice(0,10):state.today;chosenDay=true;await load();}));c.append(dates);
 if(plan?.dismissal)c.append(el('p','下校じこく '+plan.dismissal,'muted'));
 if(!plan)c.append(el('p',state.admin?'この日はまだ登録していません。下の「内容を登録・変更」から入力できます。':'まだ内容がありません。おうちの人に登録してもらおう。','muted'));
 else if(!plan.is_school_day)c.append(el('p','この日は学校がお休みです。'));
 else{
  const tasks=plan.tasks.filter(t=>t.kind===(phase==='homework'?'homework':'belonging')).map(t=>({...t,done:state.checks.some(c=>c.task_id===t.id&&c.phase===phase&&c.done===1)})).sort((a,b)=>Number(a.done)-Number(b.done));
  for(const t of tasks){const row=el('div',undefined,'task'+(t.done?' done':''));row.append(el('span',t.text,'task-name'));
   const b=button(t.done?'できた！':phase==='night'?'用意した':phase==='morning'?'持った':'できた！',async()=>{
    const request_id=crypto.randomUUID();await api('/check','POST',{revision:plan.revision,task_id:t.id,phase,done:!t.done,request_id});await load();
   },t.done?'stamp':'');b.disabled=state.admin||!state.checkable_phases?.includes(phase);b.setAttribute('aria-label',t.text+(t.done?'・完了を取り消す':'・完了にする'));b.setAttribute('aria-pressed',String(t.done));row.append(b);c.append(row);
  }
  if(!tasks.length)c.append(el('p','登録された項目はありません。','muted'));
  if(tasks.length&&tasks.every(t=>t.done))c.append(el('p','🌸 ぜんぶできたね！','cheer'));
 }
 renderTimetableLink();
 if(state.admin){renderEditor();renderTemplate();renderWeekEditor();renderNotifications();}
 const summary=card();summary.append(el('h2','30登校日のきろく'),el('p',`${state.summary.completed} 日 できた！`,'summary-number'),el('p',`登録された直近 ${state.summary.school_days} / 30 登校日`,'muted'),el('small','宿題と、夜・朝のもちものを全部確認できた日です。空のリスト・お休みは数えません。ランク・ポイント付与はまだありません。'));
}
function renderEditor(){
 const c=card(),details=el('details');details.open=!state.plan;details.append(el('summary','内容を登録・変更（保護者）'));c.append(details);
 const form=el('form'),hw=el('textarea'),bag=el('textarea'),time=el('input'),school=el('input');time.type='time';time.value=state.plan?.dismissal||'';school.type='checkbox';school.checked=state.plan?!!state.plan.is_school_day:![0,6].includes(new Date(day+'T12:00:00Z').getUTCDay());
 hw.value=state.plan?state.plan.tasks.filter(t=>t.kind==='homework').map(t=>t.text).join('\n'):templateText(state.template?.labels||[]);bag.value=(state.plan?.tasks||[]).filter(t=>t.kind==='belonging').map(t=>t.text).join('\n');hw.maxLength=16000;bag.maxLength=16000;hw.dataset.dailyHomework='true';
 field(form,'登校日',school);field(form,'宿題（1行に1つ）',hw);field(form,'持ち物（1行に1つ）',bag);field(form,'下校時刻（空欄でもOK）',time);
 form.append(el('small','基本は月〜金が登校日です。土曜授業は登校日に、お休みはチェックを外して確定してください。宿題の項目名だけの行は登録されません。'));
 form.append(el('small','確定すると子どもの画面に表示されます。変更して再確定すると、その日のチェックは新しく始まります。以前の版と記録は残ります。'));
 const save=button('確認して確定する',async()=>{
  const tasks=[...hw.value.split('\n').map(text=>({kind:'homework',text})),...bag.value.split('\n').map(text=>({kind:'belonging',text}))].filter(t=>t.text.trim()&&!((state.template?.labels||[]).some(label=>t.text.trim()===label+'：'||t.text.trim()===label+':'))).map(t=>({...t,id:crypto.randomUUID()}));
  if(tasks.length>80||tasks.some(t=>t.text.length>200))throw Error('項目は80件まで、1項目200文字以内で入力してください');
  if(state.plan&&!confirm('この日の内容を新しい版として確定します。チェックは新しく始まります。よろしいですか？'))return;
  await api('/confirm','POST',{day,expected_revision:state.plan?.revision||0,is_school_day:school.checked,dismissal:time.value||null,tasks});await load();
 },'primary');form.append(save);form.onsubmit=e=>e.preventDefault();details.append(form);
}
function renderTimetableLink(){
 const c=card(),a=el('a','🗓 時間割と、この週の宿題を見る');
 const target=new URL('https://cetus.fun/wagaya/timetable.html');
 for(const [key,value] of Object.entries({household,child,day}))target.searchParams.set(key,value);
 a.href=target.href;c.append(a);
}
function renderTemplate(){
 const c=card(),details=el('details');details.append(el('summary','宿題テンプレート（この子の設定）'));c.append(details);
 details.append(el('p','次に新しい日を入力するときの項目名です。過去の宿題や、入力中の内容は変更しません。','muted'));
 const list=el('div'),labels=[...(state.template?.labels||[])];details.append(list);
 function draw(){list.replaceChildren();labels.forEach((label,index)=>{
  const row=el('div',undefined,'template-row'),input=el('input');input.value=label;input.maxLength=60;input.setAttribute('aria-label','テンプレート項目 '+(index+1));input.oninput=()=>{labels[index]=input.value;};row.append(input);
  const up=button('↑',async()=>{[labels[index-1],labels[index]]=[labels[index],labels[index-1]];draw();});up.disabled=index===0;up.setAttribute('aria-label','項目 '+(index+1)+' を上へ');
  const down=button('↓',async()=>{[labels[index+1],labels[index]]=[labels[index],labels[index+1]];draw();});down.disabled=index===labels.length-1;down.setAttribute('aria-label','項目 '+(index+1)+' を下へ');
  row.append(up,down,button('削除',async()=>{labels.splice(index,1);draw();}));list.append(row);
 });}
 draw();details.append(button('＋ 項目を追加',async()=>{if(labels.length>=40)throw Error('40項目までです');labels.push('');draw();list.lastElementChild.querySelector('input').focus();}));
 details.append(button('テンプレートを保存',async()=>{
  const result=await api('/template','PUT',{expected_revision:state.template?.revision||0,labels});state.template=result;
  $('status').textContent='この子のテンプレートを保存しました。次の新規入力から使います。';
 },'primary'));
}
function renderWeekEditor(){
 const c=card(),details=el('details');details.append(el('summary','1週間分の宿題をまとめて登録'));c.append(details);
 details.append(el('p','外部AIで文字起こしした文章を貼り付けます。自動で送信・課金はしません。必ず日付と内容を確認してから保存してください。','muted'));
 const week=el('input');week.type='date';week.value=mondayOf(day);field(details,'対象週（月曜日を選択）',week);
 const source=el('textarea');source.maxLength=30000;source.placeholder='月曜日\n…\n火曜日\n…';field(details,'文字起こしした1週間分の文章',source);
 const preview=el('div');details.append(button('曜日に分けて確認する',async()=>{
  if(!week.value)throw Error('対象週を選んでください');week.value=mondayOf(week.value);
  const parsed=parseWeekText(source.value,week.value),data=await api('/week','GET',undefined,{week:week.value});
  preview.replaceChildren();const editors=[];
  preview.append(el('p','登録済みの日は「変更なし」が初期選択です。更新・追加を選んだ日だけ保存します。持ち物と下校時刻は引き継ぎます。','muted'));
  if(parsed.warnings.length)preview.append(el('p',parsed.warnings.join('。'),'warning'));
  for(const [i,old] of data.days.entries()){
   const section=el('section',undefined,'week-day'),heading=el('h3',dateLabel(old.day));section.append(heading);
   const current=old.tasks.filter(t=>t.kind==='homework').map(t=>t.text);
   const previous=el('pre',current.join('\n')||(old.revision?'（宿題の登録なし）':'（未登録）'),'existing-homework');section.append(el('small','現在の宿題'),previous);
   if(old.checks.some(x=>x.done))section.append(el('small','チェック済みの記録があります。同じ内容の項目はチェックを引き継ぎ、変更・削除した項目の旧記録も保管します。'));
   const text=el('textarea');text.maxLength=16000;text.value=parsed.days[i].text;field(section,'確認・修正する宿題（1行に1つ）',text);
   const fill=button('テンプレートの項目名を入れる',async()=>{text.value=[text.value,templateText(data.template.labels)].filter(Boolean).join('\n');updateDiff();});section.append(fill);
   const action=el('select');for(const [value,label] of [['skip','変更なし（保存しない）'],['append','追加（同じ内容は重複させない）'],['replace',old.revision?'更新（この内容にする）':'新規登録（空欄も可）']]){const option=el('option',label);option.value=value;action.append(option);}action.value=old.revision||!text.value.trim()?'skip':'replace';field(section,'この日の保存方法',action);
   const school=el('input');school.type='checkbox';school.checked=old.is_school_day;field(section,'登校日（祝日・休校日は外してください）',school);
   const diff=el('p',undefined,'muted');function updateDiff(){const lines=homeworkLines(text.value,data.template.labels),added=lines.filter(t=>!current.includes(t)).length,removed=current.filter(t=>!lines.includes(t)).length;diff.textContent=action.value==='skip'?'この日は保存しません':action.value==='append'?`追加候補 ${added} 件。今ある宿題・登校日設定は残します。`:`追加候補 ${added} 件／削除候補 ${removed} 件。持ち物は残します。`;school.disabled=action.value==='append'&&!!old.revision;}
   text.oninput=updateDiff;action.onchange=updateDiff;updateDiff();section.append(diff);preview.append(section);editors.push({old,text,action,school,updateDiff});
  }
  const unknown=el('textarea');unknown.value=parsed.unclassified;field(preview,'未分類（ここに残した文章は保存しません）',unknown);
  const dest=el('select');for(let i=0;i<5;i++){const op=el('option',dateLabel(data.days[i].day));op.value=String(i);dest.append(op);}field(preview,'未分類の文章を移す日',dest);
  preview.append(button('未分類の文章を選んだ日に移す',async()=>{const row=editors[Number(dest.value)];row.text.value=[row.text.value,unknown.value].filter(Boolean).join('\n');unknown.value='';row.updateDiff();}));
  const ack=el('input');ack.type='checkbox';field(preview,'残った未分類の文章は登録しないことを確認しました',ack);
  let pending=null;
  preview.append(button('確認した日をまとめて保存',async()=>{
   if(week.value!==data.week)throw Error('対象週を変更しました。曜日に分ける操作からやり直してください');
   if(unknown.value.trim()&&!ack.checked)throw Error('未分類の文章を日別欄へ移すか、登録しないことを確認してください');
   const days=editors.map(({old,text,action,school})=>({day:old.day,expected_revision:old.revision,action:action.value,is_school_day:school.checked,dismissal:old.dismissal,homework:homeworkLines(text.value,data.template.labels)}));
   const count=days.filter(d=>d.action!=='skip').length;if(!count)throw Error('保存する日の「新規登録」「追加」「更新」を選んでください');
   if(!confirm(`${dateLabel(data.week)}の週、${count}日分を保存します。日付と差分を確認しましたか？`))return;
   const fingerprint=JSON.stringify(days);if(!pending||pending.fingerprint!==fingerprint)pending={fingerprint,id:crypto.randomUUID()};
   const result=await api('/week','POST',{week:data.week,request_id:pending.id,days});
   await load();$('status').textContent=`週まとめ登録：${result.saved_days}日分を保存しました。変更のない日はそのままです。`;
  },'primary'));
 }),preview);
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
$('reload').onclick=()=>load();document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!document.querySelector('details[open] form,details[open] textarea,details[open] input')){if(!chosenDay)day='';load(!chosenDay);}});load(!initial.get('day'));
