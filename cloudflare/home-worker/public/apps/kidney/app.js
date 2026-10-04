const nutrients = [
  { key:'salt', label:'えんぶん', max:6, unit:'g', color:'#3184d8' },
  { key:'protein', label:'たんぱく質', max:55, unit:'g', color:'#e1873a' },
  { key:'potassium', label:'カリウム', max:2000, unit:'mg', color:'#55a657' },
  { key:'phosphorus', label:'リン', max:800, unit:'mg', color:'#a46bc5' },
  { key:'energy', label:'エネルギー', max:1800, unit:'kcal', color:'#d45f78' }
];

const foods = window.BOOK_FOODS || [];
const categories = ['すべて', '外食', '主食', '肉', '魚', '野菜', '豆・卵', '果物', '汁物'];
const emptyTotals = () => Object.fromEntries(nutrients.map(n => [n.key, 0]));
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
let shared=null, household=null, selectedDay=todayKey(), followToday=true, busy=false, loading=false, pendingMeal=null, readGeneration=0;
const state={plan:new Map(),totals:emptyTotals(),committed:[],selectedGauge:'salt',category:'すべて',query:''};
async function api(path,method='GET',body){
 const res=await fetch('/api/kidney'+path,{method,credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
 const data=await res.json();if(res.status===401){location.replace('/login');throw Error('ログインしてください');}
 if(!res.ok)throw Error(data.error||'つながりませんでした');return data;
}
const scope=()=>`household=${encodeURIComponent(household)}`;
function applyShared(data){
 shared=data;state.committed=data.records;state.totals=emptyTotals();
 for(const record of state.committed)for(const item of record.items)for(const n of nutrients)state.totals[n.key]+=item.values[n.key]*item.qty;
 for(const n of nutrients){n.max=data.settings?.[n.key]?.max||n.max;n.visible=data.settings?.[n.key]?.visible!==false;}
 document.querySelector('.icon-button').hidden=!data.admin;
 document.querySelector('#syncNote').textContent=data.settings?'家族で共有中 · '+data.household.name:'家族で共有中 · 目標量は仮の表示です（家族が設定できます）';
 document.querySelector('#today-title').textContent=selectedDay===todayKey()?'今日のゲージ':selectedDay+'のゲージ';
 renderPlan();updateGauges();renderHistory();
}
async function refresh(){
 if(!household||loading||busy)return;loading=true;const generation=++readGeneration;
 try{
  if(followToday&&selectedDay!==todayKey()){selectedDay=todayKey();document.querySelector('#recordDay').value=selectedDay;}
  const data=await api('?'+scope()+'&day='+selectedDay);
  if(generation===readGeneration&&!busy)applyShared(data);
 }catch(e){document.querySelector('#syncNote').textContent='再接続待ち · '+e.message;}finally{loading=false;}
}
async function init(){
 try{
  const groups=await api('/households');if(!groups.length)throw Error('家庭への招待から参加してください');
  const select=document.querySelector('#householdSelect');
  for(const g of groups){const o=document.createElement('option');o.value=g.id;o.textContent=g.name;select.append(o);}
  household=groups[0].id;select.hidden=groups.length===1;
  select.addEventListener('change',async()=>{if(busy){select.value=household;return;}readGeneration++;loading=false;shared=null;state.totals=emptyTotals();state.committed=[];household=select.value;state.plan.clear();pendingMeal=null;renderPlan();updateGauges();renderHistory();await refresh();});
  await refresh();setInterval(()=>{if(!document.hidden)refresh();},15000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
 }catch(e){document.querySelector('#syncNote').textContent=e.message;}
}

const gaugeInstances=new Map();
const gaugesHost=document.querySelector('#gauges');
nutrients.forEach(n => gaugeInstances.set(n.key,new window.ShapeFillGauge(gaugesHost,Object.assign(n,{onSelect:selectGauge}))));

function format(value) {
  if (value>=100) return Math.round(value).toLocaleString('ja-JP');
  return Number(value.toFixed(1)).toString();
}
function foodById(id) { return foods.find(f => f.id===id); }
function planTotals() {
  const result=emptyTotals();
  state.plan.forEach((qty,id) => nutrients.forEach(n => result[n.key]+=foodById(id).values[n.key]*qty));
  return result;
}
function unavailableState(key) {
  const current=state.committed.some(record => record.items.some(item => item.qty>0&&item.unavailable?.includes(key)));
  const planned=[...state.plan].some(([id,qty]) => qty>0&&foodById(id).unavailable?.includes(key));
  return {current,planned,any:current||planned};
}
function selectGauge(key) { state.selectedGauge=key; updateGauges(); }
function updateGauges() {
  const totals=planTotals();
  nutrients.forEach(n => gaugeInstances.get(n.key).update(state.totals[n.key],totals[n.key],state.selectedGauge===n.key));
  nutrients.forEach(n => gaugeInstances.get(n.key).node.hidden=!n.visible);
  gaugesHost.style.gridTemplateColumns=`repeat(${Math.max(1,nutrients.filter(n=>n.visible).length)},minmax(0,1fr))`;
  if (!nutrients.find(n=>n.key===state.selectedGauge)?.visible) state.selectedGauge=nutrients.find(n=>n.visible)?.key || 'salt';
  const main=nutrients.find(n => n.key===state.selectedGauge);
  const ratio=(state.totals[main.key]+totals[main.key])/main.max;
  const missing=unavailableState(main.key);
  document.querySelector('#gaugeDetails').textContent=`${main.label}：現在 ${format(state.totals[main.key])}${main.unit} ＋ 今回 ${format(totals[main.key])}${main.unit}${missing.any?'（公式値なしの食品あり）':''}`;
  const status=document.querySelector('#statusText'); status.className='status-pill';
  if(missing.any){status.textContent='公式値なしを含むため判定なし';status.classList.add('unknown');return;}
  if(!shared?.settings){status.textContent='目標量は家族が設定';return;}
  if (ratio>1) { status.textContent='上限超過：今日は多め'; status.classList.add('over'); }
  else if (ratio>=.9) { status.textContent='⚠️ 上限に近い'; status.classList.add('near'); }
  else if (ratio>=.72) { status.textContent='▲ そろそろ注意'; status.classList.add('watch'); }
  else { status.textContent='◎ まだ余裕'; status.classList.add('good'); }
}

function renderCategories() {
  const host=document.querySelector('#categoryChips'); host.innerHTML='';
  categories.forEach(category => {
    const button=document.createElement('button'); button.type='button'; button.className='category-chip';
    button.classList.toggle('active',category===state.category); button.textContent=category;
    button.addEventListener('click',() => { state.category=category; renderCategories(); renderFoods(); });
    host.appendChild(button);
  });
}
function filteredFoods() {
  const q=state.query.trim().toLowerCase();
  return foods.filter(f => (state.category==='すべて'||f.category===state.category) && (!q||`${f.name} ${f.portion} ${f.category}`.toLowerCase().includes(q)));
}
function renderFoods() {
  const host=document.querySelector('#foodGrid'); host.innerHTML=''; host.scrollTop=0;
  const visible=filteredFoods();
  document.querySelector('#foodResultCount').textContent=`${visible.length}件（全${foods.length}件）`;
  if (!visible.length) { host.innerHTML='<p class="no-result">見つかりませんでした。別の名前でも試してみてください。</p>'; return; }
  visible.forEach(food => {
    const button=document.createElement('button'); button.type='button'; button.className='food-button';
    const potassium=food.unavailable?.includes('potassium')?'K 公式掲載なし':`K ${format(food.values.potassium)}mg`;
    const boiled=food.boiledPotassium ? `<small>ゆでるとK ${format(food.boiledPotassium)}mg</small>` : '';
    const fat=food.extras?.fat!=null?`　脂 ${format(food.extras.fat)}g　${format(food.values.energy)}kcal`:'';
    const source=food.source||`本 p.${food.page}`;
    const missing=food.unavailable?.length?'<small>カリウム・リンは公式掲載なし</small>':'';
    const estimate=food.estimated?'<small class="estimate-note">⚠ 栄養値は安全側の参考推定</small>':'';
    button.innerHTML=`<strong>${food.name}</strong><span>${food.portion}</span><span class="food-nutrients">塩 ${format(food.values.salt)}g　た ${format(food.values.protein)}g　${potassium}${fat}</span>${boiled}${estimate}${missing}<em>${source}</em><i class="plus">＋</i>`;
    button.addEventListener('click',() => changeQty(food.id,1)); host.appendChild(button);
  });
}
function changeQty(id,change) {
  if(busy)return; pendingMeal=null;
  const next=(state.plan.get(id)||0)+change;
  if (next<=0) state.plan.delete(id); else state.plan.set(id,next);
  renderPlan(); updateGauges();
}
function renderPlan() {
  const host=document.querySelector('#planList'), empty=document.querySelector('#emptyPlan');
  const count=[...state.plan.values()].reduce((a,b)=>a+b,0);
  document.querySelector('#planCount').textContent=`${count}品`; document.querySelector('#commitMeal').disabled=count===0||busy||!shared; document.querySelector('#lateAdd').disabled=count===0||busy||!shared;
  empty.hidden=count>0; host.innerHTML='';
  state.plan.forEach((qty,id) => {
    const food=foodById(id), row=document.createElement('div'); row.className='plan-item';
    const missing=food.unavailable?.length?'　K・リンは公式掲載なし':'';
    const estimate=food.estimated?'　⚠参考推定':'';
    row.innerHTML=`<div><strong>${food.name}</strong><span>${food.portion} × ${qty}　塩 ${format(food.values.salt*qty)}g${estimate}${missing}</span></div><div class="quantity"><button type="button" aria-label="${food.name}を減らす">−</button><b>${qty}</b><button type="button" aria-label="${food.name}を増やす">＋</button></div>`;
    const buttons=row.querySelectorAll('button'); buttons[0].addEventListener('click',()=>changeQty(id,-1)); buttons[1].addEventListener('click',()=>changeQty(id,1)); host.appendChild(row);
  });
}
function mealSlot() {
  const hour=new Date().getHours();
  if (hour<10) return '朝'; if (hour<15) return '昼'; if (hour<21) return '夜'; return '間食';
}
async function commitMeal(late=false) {
 if(busy||!shared)return;
 if(!state.plan.size){showToast('先に食品を選んでください');return;}
 busy=true;readGeneration++;renderPlan();
 if(!pendingMeal)pendingMeal={id:crypto.randomUUID(),day:selectedDay,meal:document.querySelector('#mealSlot').value,items:[...state.plan].map(([id,qty])=>{const f=foodById(id);return {id,qty,name:f.name,portion:f.portion,values:f.values,unavailable:f.unavailable||[],extras:f.extras||{},estimated:f.estimated===true};})};
 try{await api('/meals?'+scope(),'POST',pendingMeal);state.plan.clear();pendingMeal=null;showToast(late?'あとから記録しました':'家族の記録に追加しました');}
 catch(e){showToast(e.message+'。もう一度押して保存できます');}
 finally{busy=false;loading=false;await refresh();renderPlan();}
}
function renderHistory(){
 const host=document.querySelector('#historyList');host.replaceChildren();
 for(const slot of ['朝','昼','夜','間食']){
  const title=document.createElement('h3');title.textContent=slot;host.append(title);
  const records=state.committed.filter(r=>r.meal===slot);
  if(!records.length){const p=document.createElement('p');p.className='empty-plan';p.textContent='まだ登録はありません';host.append(p);}
  for(const record of records){
   const row=document.createElement('div');row.className='shared-record';
   const heading=document.createElement('p');heading.textContent=record.actor+' が登録 · '+new Date(record.created_at).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'});row.append(heading);
   record.items.forEach((item,index)=>{
    const line=document.createElement('div');line.className='shared-item';const label=document.createElement('span');label.textContent=item.name+' '+item.portion+' × '+item.qty+(item.estimated?'（参考推定）':'')+(item.unavailable?.length?'（K・リン 公式掲載なし）':'');line.append(label);
    if(record.editable){for(const delta of [-1,1]){const b=document.createElement('button');b.textContent=delta<0?'−':'＋';b.type='button';b.setAttribute('aria-label',item.name+(delta<0?'を減らす':'を増やす'));b.disabled=busy;b.onclick=()=>editRecord(record,index,delta);line.append(b);}}
    row.append(line);
   });
   if(record.editable){const b=document.createElement('button');b.textContent='この記録を取り消す';b.className='late-button';b.type='button';b.disabled=busy;b.onclick=()=>deleteRecord(record);row.append(b);}
   host.append(row);
  }
 }
}
async function editRecord(record,index,delta){
 if(busy)return;const items=record.items.map(i=>({...i}));items[index].qty+=delta;const remaining=items.filter(i=>i.qty>0);
 if(!remaining.length)return deleteRecord(record);
 await mutateRecord(record,'PUT',{revision:record.revision,items:remaining},'量を変更しました');
}
async function deleteRecord(record){await mutateRecord(record,'DELETE',{revision:record.revision},'記録を取り消しました');}
async function mutateRecord(record,method,body,message){
 if(busy)return;busy=true;readGeneration++;renderHistory();
 try{await api('/meals/'+record.id+'?'+scope(),method,body);showToast(message);}catch(e){showToast(e.message);}finally{busy=false;loading=false;await refresh();renderHistory();}
}
let toastTimer;
function showToast(message) {
  const toast=document.querySelector('#toast'); toast.textContent=message; toast.classList.add('show');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>toast.classList.remove('show'),2200);
}

function openSettings() {
  const host=document.querySelector('#settingsFields'); host.innerHTML='';
  nutrients.forEach(n => {
    const row=document.createElement('div'); row.className='setting-row';
    row.innerHTML=`<label class="setting-visible"><input type="checkbox" data-visible="${n.key}" ${n.visible?'checked':''}><span>${n.label}</span></label><label class="setting-number"><input type="number" min="0.1" step="0.1" inputmode="decimal" data-max="${n.key}" value="${n.max}"><span>${n.unit}</span></label>`;
    host.appendChild(row);
  });
  document.querySelector('#settingsDialog').showModal();
}
async function saveSettings(event) {
 event.preventDefault();if(busy||!shared?.admin)return;
 const settings={};
 for(const n of nutrients){const max=Number(document.querySelector(`[data-max="${n.key}"]`).value);if(!(max>0)){showToast('目標量を確認してください');return;}settings[n.key]={max,visible:document.querySelector(`[data-visible="${n.key}"]`).checked};}
 if(!Object.values(settings).some(n=>n.visible)){showToast('1つ以上表示してください');return;}
 busy=true;readGeneration++;document.querySelector('#saveSettings').disabled=true;
 try{await api('/settings?'+scope(),'PUT',{settings,revision:shared.revision});document.querySelector('#settingsDialog').close();showToast('家族共通の目標量を保存しました');}
 catch(e){showToast(e.message);}finally{busy=false;document.querySelector('#saveSettings').disabled=false;await refresh();}
}

document.querySelector('#foodSearch').addEventListener('input',e=>{ state.query=e.target.value; renderFoods(); });
document.querySelector('#clearPlan').addEventListener('click',()=>{ if(busy)return;pendingMeal=null;state.plan.clear(); renderPlan(); updateGauges(); });
document.querySelector('#commitMeal').addEventListener('click',()=>commitMeal(false));
document.querySelector('#lateAdd').addEventListener('click',()=>commitMeal(true));
document.querySelector('.icon-button').addEventListener('click',openSettings);
document.querySelector('#saveSettings').addEventListener('click',saveSettings);

document.querySelector('#recordDay').value=selectedDay;
document.querySelector('#recordDay').addEventListener('change',async e=>{if(busy){e.target.value=selectedDay;return;}if(!e.target.value)return;readGeneration++;loading=false;selectedDay=e.target.value;followToday=selectedDay===todayKey();state.plan.clear();pendingMeal=null;await refresh();});
document.querySelector('#mealSlot').value=mealSlot();
document.querySelector('#mealSlot').addEventListener('change',()=>{pendingMeal=null;});
renderCategories(); renderFoods(); renderPlan(); updateGauges(); renderHistory();init();
