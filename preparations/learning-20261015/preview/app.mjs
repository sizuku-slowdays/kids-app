import {catalog} from '../catalog.mjs';
import {jstDay,sortedTasks,summarizeSchoolDays} from '../core.mjs';
const $=id=>document.getElementById(id),content=$('content');
let app='school',viewer='child',learner='sample-a',phase='homework',index=0,bookItem=null;
const samples={};
for(const key of ['sample-a','sample-b'])samples[key]={level:key==='sample-a'?'words':'alphabet',daily_count:3,known:new Set(),confirmed:new Set(),checks:[],revision:1,tasks:[{id:'read',kind:'homework',text:'音読を1回する'},{id:'pencil',kind:'belonging',text:'ふでばこ'},{id:'bottle',kind:'belonging',text:'すいとう'}],dismissal:'14:30'};
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function button(text,fn,cls){const b=el('button',text,cls);b.type='button';b.onclick=fn;return b;}
function message(text=''){$('status').textContent=text;}
function card(){const c=el('div',undefined,'card');content.append(c);return c;}
function field(parent,text,node){const l=el('label',text);l.append(node);parent.append(l);return node;}
function input(value,type='text'){const i=document.createElement('input');i.type=type;i.value=value;return i;}
function stopSpeech(){if('speechSynthesis'in window)window.speechSynthesis.cancel();}
function speak(item){
 stopSpeech();if(!('speechSynthesis'in window)){message('この端末では音声を利用できません。');return;}
 const voice=window.speechSynthesis.getVoices().find(v=>v.lang.replace('_','-').toLowerCase()==='en-us');
 if(!voice){message('アメリカ英語の音声を準備できません。端末の音声設定を確認して、もう一度押してください。');return;}
 const u=new SpeechSynthesisUtterance(item.speech);u.voice=voice;u.lang='en-US';u.rate=.8;u.onerror=()=>message('音声を再生できませんでした。もう一度試してください。');message();window.speechSynthesis.speak(u);
}
function render(){
 content.replaceChildren();const s=samples[learner];$('heading').textContent=app==='school'?'学校のじゅんび':'英語フラッシュ';
 for(const id of ['school','english'])$(id).setAttribute('aria-pressed',String(app===id));
 if(app==='school')renderSchool(s);else renderEnglish(s);
}
function renderSchool(s){
 if(viewer==='guardian'){
  const c=card();c.append(el('h2','読み取り結果の確認・修正（手入力の試作）'),el('p','AI接続は確認待ちです。下の内容を直して確定できます。','muted'));
  const hw=field(c,'宿題（1行に1項目）',el('textarea',s.tasks.filter(t=>t.kind==='homework').map(t=>t.text).join('\n')));
  const belongings=field(c,'持ち物（1行に1項目）',el('textarea',s.tasks.filter(t=>t.kind==='belonging').map(t=>t.text).join('\n')));
  const dismissal=field(c,'下校時刻',input(s.dismissal,'time'));
  c.append(button('確認して確定',()=>{s.tasks=[...hw.value.split('\n').map(text=>({kind:'homework',text})),...belongings.value.split('\n').map(text=>({kind:'belonging',text}))].filter(t=>t.text.trim()).map((t,i)=>({...t,id:'task-'+i}));s.dismissal=dismissal.value;s.checks=[];s.revision++;message('サンプルの内容を確定しました。古い版のチェックは新しい版へ引き継ぎません。');render();},'primary'));
  c.append(el('p','本実装では版ごとの内容・チェック履歴を保存します。','muted'));
 }
 const c=card();c.append(el('h2',phase==='homework'?'今日の宿題':'明日のじゅんび'),el('p','サンプルの下校時刻 '+s.dismissal,'muted'));
 const tabs=el('div',undefined,'row');for(const [key,label]of [['homework','宿題'],['night','夜 · 用意した'],['morning','朝 · 持った']]){const b=button(label,()=>{phase=key;render();});b.setAttribute('aria-pressed',String(phase===key));tabs.append(b);}c.append(tabs);
 const tasks=sortedTasks(s.tasks,s.checks,phase);
 for(const t of tasks){const row=el('div',undefined,'task');row.append(el('span',t.text));const b=button(t.done?'できた！':'できた！',()=>{if(viewer==='guardian')return;const old=s.checks.find(c=>c.task_id===t.id&&c.phase===phase);if(old)old.done=old.done?0:1;else s.checks.push({task_id:t.id,phase,done:1});render();},t.done?'stamp':'');b.setAttribute('aria-pressed',String(t.done));b.setAttribute('aria-label',t.text+(t.done?' 完了を取り消す':' 完了にする'));b.disabled=viewer==='guardian';row.append(b);c.append(row);}
 if(!tasks.length)c.append(el('p','項目はありません。'));
 if(tasks.length&&tasks.every(t=>t.done))c.append(el('p','🌸 ぜんぶできたね！'));
 const r=card(),summary=summarizeSchoolDays([]);r.append(el('h2','30登校日のきろく'),el('p',`${summary.school_days} / 30登校日`),el('p','登校日・ランク・ポイントの条件は確認待ちです。通知とポイントは送信しません。','muted'));
}
function renderEnglish(s){
 if(viewer==='guardian'){
  const c=card();c.append(el('h2','学習の設定（サンプル）'));
  const select=document.createElement('select');for(const [value,text]of [['alphabet','アルファベット'],['words','やさしい単語']]){const o=el('option',text);o.value=value;select.append(o);}select.value=s.level;field(c,'はじめるレベル',select);
  const count=field(c,'1日の数（1〜10、仮に3を表示）',input(s.daily_count,'number'));count.min=1;count.max=10;
  c.append(button('サンプル設定を保存',()=>{if(!Number.isInteger(Number(count.value))||Number(count.value)<1||Number(count.value)>10){message('1〜10の数を入れてください');return;}s.level=select.value;s.daily_count=Number(count.value);index=0;message('サンプル設定を変更しました。本番への保存はありません。');render();},'primary'),el('p',`覚えた数 ${s.known.size}文字・単語`));
 }else{
  // Preview only: deterministic sample. The prepared API persists randomized daily sets.
  const daily=catalog.filter(i=>i.level===s.level).slice(0,s.daily_count),item=bookItem||daily[Math.min(index,daily.length-1)],c=card();c.classList.add('flash');
  c.append(el('p',bookItem?'ずかんでふくしゅう':`${jstDay()} · ${Math.min(index+1,daily.length)} / ${daily.length}`,'muted'));
  c.append(el('div',item.display,'letter'),el('p',item.meaning,'meaning'),button('🔊 きく',()=>speak(item)));
  if(!bookItem)c.append(button(s.confirmed.has(item.id)?'覚えたね！':'覚えた！',()=>{s.known.add(item.id);s.confirmed.add(item.id);index=Math.min(index+1,daily.length-1);stopSpeech();render();},'primary'));
  else c.append(button('今日にもどる',()=>{bookItem=null;stopSpeech();render();}));
  const progress=document.createElement('progress');progress.max=daily.length;progress.value=daily.filter(i=>s.confirmed.has(i.id)).length;c.append(progress);
  if(daily.every(i=>s.confirmed.has(i.id)))c.append(el('h2','🌼 今日の英語クリア！'));
 }
 const c=card(),details=document.createElement('details');details.append(el('summary',`ずかん · ${s.known.size}文字・単語`));const grid=el('div',undefined,'book');
 for(const item of catalog.filter(i=>i.level===s.level)){const b=button(item.display+(s.known.has(item.id)?' ✓':''),()=>{bookItem=item;viewer='child';$('viewer').value='child';stopSpeech();render();});if(s.known.has(item.id))b.classList.add('known');b.disabled=!s.known.has(item.id);grid.append(b);}details.append(grid);c.append(details);
}
for(const key of ['school','english'])$(key).onclick=()=>{stopSpeech();app=key;bookItem=null;message();render();};
$('viewer').onchange=e=>{stopSpeech();viewer=e.target.value;bookItem=null;message();render();};
$('learner').onchange=e=>{stopSpeech();learner=e.target.value;bookItem=null;index=0;message();render();};
window.addEventListener('pagehide',stopSpeech);render();
