const FOODS=window.FOODS||[], NUTRIENTS=window.NUTRIENTS||{};
const powers=[
{key:'head_power',label:'あたま',icon:'🧠',cls:'p-head',desc:'考（かんが）える・覚（おぼ）える。頭（あたま）や神経（しんけい）を応援（おうえん）！'},
{key:'sparkle_power',label:'キラキラ',icon:'✨',cls:'p-sparkle',desc:'肌（はだ）・髪（かみ）・爪（つめ）をつくるのを応援（おうえん）！'},
{key:'muscle_power',label:'マッチョ',icon:'💪',cls:'p-muscle',desc:'筋肉（きんにく）や体（からだ）をつくる材料（ざいりょう）を集（あつ）めよう！'},
{key:'bone_power',label:'ほね',icon:'🦴',cls:'p-bone',desc:'骨（ほね）と歯（は）をつくるのを応援（おうえん）！'},
{key:'immunity_power',label:'めんえき',icon:'🛡️',cls:'p-immunity',desc:'体（からだ）を守（まも）る仕組（しく）みを応援（おうえん）！'}];
const target=8;
let activeChild=localStorage.getItem('kp_child')||'長女', category='すべて',query='';
let batchMode=false;
let batchSelected=new Set();

function localDateString(d=new Date()){
  const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
let selectedDate=localStorage.getItem('kp_selected_date')||localDateString();
let activeMeal=localStorage.getItem('kp_active_meal')||'breakfast';

const MEALS={
 breakfast:{label:'朝ごはん',icon:'🌅'},
 lunch:{label:'昼ごはん',icon:'☀️'},
 dinner:{label:'夜ごはん',icon:'🌙'},
 snack:{label:'おやつ',icon:'🍭'},
 other:{label:'以前の記録',icon:'📝'}
};

const recordKey=(child=activeChild,date=selectedDate)=>`kp_record_v12_${child}_${date}`;
function emptyRecord(){return {version:12,breakfast:[],lunch:[],dinner:[],snack:[],other:[],updatedAt:null}}
function normalizeRecord(r){
  const x={...emptyRecord(),...(r||{})};
  Object.keys(MEALS).forEach(k=>{if(!Array.isArray(x[k]))x[k]=[]});
  return x;
}
function getRecord(child=activeChild,date=selectedDate){
  try{
    const saved=localStorage.getItem(recordKey(child,date));
    if(saved)return normalizeRecord(JSON.parse(saved));
    const old=localStorage.getItem(`kp_today_${child}_${date}`);
    if(old){
      const migrated=emptyRecord();
      migrated.other=[...new Set(JSON.parse(old)||[])];
      migrated.updatedAt=new Date().toISOString();
      localStorage.setItem(recordKey(child,date),JSON.stringify(migrated));
      return migrated;
    }
  }catch(e){}
  return emptyRecord();
}
function saveRecord(r,child=activeChild,date=selectedDate){
  const x=normalizeRecord(r);x.updatedAt=new Date().toISOString();
  localStorage.setItem(recordKey(child,date),JSON.stringify(x));
  if(typeof cloudPushRecord==='function') cloudPushRecord(child,date,x);
}
function mealIds(meal=activeMeal){return getRecord()[meal]||[]}
function setMealIds(ids,meal=activeMeal){
  const r=getRecord();r[meal]=[...new Set(ids)];saveRecord(r);
}
function getToday(){
  const r=getRecord(),all=[];
  Object.keys(MEALS).forEach(k=>all.push(...(r[k]||[])));
  return all;
}
function setToday(ids){setMealIds(ids,activeMeal)}
const prefKey=(child=activeChild)=> 'kp_prefs_'+child;
const allergyKey=(child=activeChild)=> 'kp_allergies_'+child;
const settingsUpdatedKey=(child=activeChild)=> 'kp_settings_updated_v14_'+child;
function parseLocalJson(key,fallback={}){try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback))}catch{return fallback}}
const getPrefs=(child=activeChild)=>parseLocalJson(prefKey(child),{});
const getAllergies=(child=activeChild)=>parseLocalJson(allergyKey(child),{});
function markSettingsUpdated(child=activeChild){const now=new Date().toISOString();localStorage.setItem(settingsUpdatedKey(child),now);return now}
function setPrefs(x,child=activeChild){
  localStorage.setItem(prefKey(child),JSON.stringify(x));
  const updatedAt=markSettingsUpdated(child);
  if(typeof cloudPushSettings==='function') cloudPushSettings(child,updatedAt);
}
function setAllergies(x,child=activeChild){
  localStorage.setItem(allergyKey(child),JSON.stringify(x));
  const updatedAt=markSettingsUpdated(child);
  if(typeof cloudPushSettings==='function') cloudPushSettings(child,updatedAt);
}
function toggleAllergy(foodId){
  let a=getAllergies();
  if(a[foodId]) delete a[foodId]; else a[foodId]=true;
  setAllergies(a); openFood(foodId);
}
// v14 migration: existing local preferences/allergy flags become syncable without losing them.
for(const child of ['長女','次女']){
  const hasSettings=Object.keys(getPrefs(child)).length||Object.keys(getAllergies(child)).length;
  if(hasSettings&&!localStorage.getItem(settingsUpdatedKey(child))) localStorage.setItem(settingsUpdatedKey(child),new Date().toISOString());
}

const prefOptions=[
 {v:'love',e:'😍',t:'おいしい！'},
 {v:'ok',e:'🙂',t:'食べられる'},
 {v:'depends',e:'🤔',t:'料理による'},
 {v:'dislike',e:'😣',t:'苦手'},
 {v:'no',e:'🚫',t:'イヤ！'}
];
function savePref(foodId,val){
 let p=getPrefs(), old=p[foodId]||{};
 let note=old.note||'';
 if(val==='depends') note=prompt('どんな料理なら食べられた？\\n例：しらすバターいため、ハンバーグに入れた',note)||note;
 p[foodId]={value:val,note,updated:new Date().toISOString()};
 setPrefs(p); openFood(foodId);
}

function showView(name){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.view===name));document.getElementById('view-'+name).classList.add('active');if(name==='today')renderToday();if(name==='foods')renderFoods()}
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>showView(b.dataset.view));document.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>showView(b.dataset.jump));
function renderChild(){document.querySelectorAll('.child-btn').forEach(b=>b.classList.toggle('active',b.dataset.child===activeChild));document.getElementById('today-child').textContent=activeChild}
document.querySelectorAll('.child-btn').forEach(b=>b.onclick=()=>{activeChild=b.dataset.child;localStorage.setItem('kp_child',activeChild);renderChild();renderToday();renderFoods()});renderChild();
function topFoods(k,n=6){return [...FOODS].filter(f=>f[k]>0).sort((a,b)=>b[k]-a[k]||a.name.localeCompare(b.name,'ja')).slice(0,n)}
function renderHome(){let g=document.getElementById('power-grid');g.innerHTML=powers.map(p=>`<button class="power-card ${p.cls}" data-power="${p.key}"><div class="power-icon">${p.icon}</div><h3>${p.label}</h3><p>${p.desc}</p><div class="power-foods">${topFoods(p.key).map(f=>`<span class="mini-food">${f.emoji} ${f.reading}</span>`).join('')}</div></button>`).join('');g.querySelectorAll('.power-card').forEach(b=>b.onclick=()=>{category='すべて';query='';document.getElementById('food-search').value='';showView('foods');renderFoods(b.dataset.power)})}renderHome();
const cats=['すべて',...new Set(FOODS.map(f=>f.category_ui))];
function renderChips(){let e=document.getElementById('category-chips');e.innerHTML=cats.map(c=>`<button class="chip ${c===category?'active':''}" data-cat="${c}">${c==='すべて'?'🌈 全部（ぜんぶ）':c}</button>`).join('');e.querySelectorAll('.chip').forEach(b=>b.onclick=()=>{category=b.dataset.cat;renderChips();renderFoods()})}renderChips();
document.getElementById('food-search').oninput=e=>{query=e.target.value.trim();renderFoods()};
function tinyPower(f,p){return f[p.key]>0?`<span class="badge">${p.icon}${'★'.repeat(f[p.key])}</span>`:''}

function updateBatchBar(){
  const actions=document.getElementById('batch-actions');
  const modeBtn=document.getElementById('batch-mode-btn');
  const count=document.getElementById('batch-count');
  if(!actions||!modeBtn||!count) return;
  actions.classList.toggle('hidden',!batchMode);
  modeBtn.classList.toggle('hidden',batchMode);
  count.textContent=`${batchSelected.size}こ選択`;
  const add=document.getElementById('batch-add');
  if(add) add.disabled=batchSelected.size===0;
}
function startBatchMode(){
  batchMode=true; batchSelected=new Set(getToday());
  renderFoods(); updateBatchBar();
}
function stopBatchMode(){
  batchMode=false; batchSelected.clear();
  renderFoods(); updateBatchBar();
}
function toggleBatchFood(id){
  const f=FOODS.find(x=>String(x.id)===String(id));
  const realId=f?f.id:id;
  if(batchSelected.has(realId)) batchSelected.delete(realId); else batchSelected.add(realId);
  renderFoods(); updateBatchBar();
}
function commitBatchFoods(){
  setToday([...batchSelected]);
  batchMode=false; batchSelected.clear();
  renderFoods(); renderToday(); updateBatchBar();
  showView('today');
}


const POWER_HELP={
 head:{icon:'🧠',name:'あたま',text:'考える・覚える。頭や神経を応援！'},
 sparkle:{icon:'✨',name:'キラキラ',text:'肌・髪・爪をつくるのを応援！'},
 muscle:{icon:'💪',name:'マッチョ',text:'筋肉や体をつくる材料を集めよう！'},
 bone:{icon:'🦴',name:'ほね',text:'骨と歯をつくるのを応援！'},
 immunity:{icon:'🛡️',name:'めんえき',text:'体を守る仕組みを応援！'}
};
function powerHelp(key){const pop=document.getElementById('power-popover'),x=POWER_HELP[key];if(!pop||!x)return;pop.innerHTML=`<b>${x.icon} ${x.name}</b><div>${x.text}</div>`;pop.classList.remove('hidden');requestAnimationFrame(()=>pop.classList.add('show'))}
function closePowerHelp(){const pop=document.getElementById('power-popover');if(pop){pop.classList.remove('show');setTimeout(()=>pop.classList.add('hidden'),120)}}
function toggleTodayQuick(id,e){
  if(e){e.preventDefault();e.stopPropagation()}
  const f=FOODS.find(x=>String(x.id)===String(id)),realId=f?f.id:id;
  let ids=mealIds(),i=ids.findIndex(x=>String(x)===String(realId));
  if(i>=0)ids.splice(i,1);else ids.push(realId);
  setMealIds(ids);renderFoods();renderToday();
}
function renderPowerGuide(){const box=document.getElementById('power-guide-body');if(!box)return;box.innerHTML=Object.entries(POWER_HELP).map(([k,x])=>`<button class="guide-power" data-guide-power="${k}"><span>${x.icon}</span><b>${x.name}</b><small>${x.text}</small></button>`).join('');box.querySelectorAll('.guide-power').forEach(b=>b.onclick=e=>{e.stopPropagation();powerHelp(b.dataset.guidePower)})}

function renderFoods(sortPower=null){let list=FOODS.filter(f=>(category==='すべて'||f.category_ui===category)&&(!query||(f.name+f.reading+f.main_nutrients).includes(query)));if(sortPower)list.sort((a,b)=>b[sortPower]-a[sortPower]||a.name.localeCompare(b.name,'ja'));document.getElementById('food-grid').innerHTML=list.map(f=>`<button class="food-card ${batchMode&&batchSelected.has(f.id)?'batch-selected':''}" data-id="${f.id}"><div class="food-top"><div class="food-emoji">${f.emoji}</div><div>${batchMode?`<div class="batch-check">${batchSelected.has(f.id)?"✓":""}</div>`:""}<button class="quick-eaten ${mealIds().some(x=>String(x)===String(f.id))?'checked':''}" data-quick="${f.id}" aria-label="今日食べた">${mealIds().some(x=>String(x)===String(f.id))?'✓':''}</button><div class="food-name">${f.name}${f.reading!==f.name?`<span class="inline-reading">（${f.reading}）</span>`:''}</div>${getAllergies()[f.id]?'<div class="allergy-badge">⚠️ アレルギー</div>':''}<div class="food-cat">${f.category_ui}</div></div></div><div class="stars-row">${powers.map(p=>tinyPower(f,p)).join('')}</div></button>`).join('');document.querySelectorAll('.food-card').forEach(b=>b.onclick=()=>(batchMode?toggleBatchFood(b.dataset.id):openFood(b.dataset.id)))}
function kidCopy(s){
  let t=(s||'')
    .replace(/食物繊維/g,'食物繊維（しょくもつせんい）')
    .replace(/炭水化物/g,'炭水化物（たんすいかぶつ）')
    .replace(/筋肉/g,'筋肉（きんにく）')
    .replace(/材料/g,'材料（ざいりょう）')
    .replace(/栄養/g,'栄養（えいよう）')
    .replace(/酸素/g,'酸素（さんそ）')
    .replace(/必要/g,'必要（ひつよう）')
    .replace(/神経/g,'神経（しんけい）')
    .replace(/細胞/g,'細胞（さいぼう）')
    .replace(/皮ふ/g,'皮膚（ひふ）')
    .replace(/血/g,'血（ち）')
    .replace(/骨/g,'骨（ほね）')
    .replace(/歯/g,'歯（は）')
    .replace(/髪/g,'髪（かみ）')
    .replace(/体/g,'体（からだ）');
  if(t && !/[。！？!?]$/.test(t)) t+='。';
  return t;
}
function openFood(id){
  let f=FOODS.find(x=>String(x.id)===String(id));if(!f)return;
  let ids=mealIds(),inMeal=ids.some(x=>String(x)===String(id)),meal=MEALS[activeMeal];
  document.getElementById('modal-content').innerHTML=`<div class="modal-food-head"><div class="food-emoji">${f.emoji}</div><div><div class="food-cat">${f.category_ui}</div><h2>${f.name}${f.reading!==f.name?`<span class="title-reading">（${f.reading}）</span>`:''}</h2></div></div><p class="modal-copy">${kidCopy(f.kids_text)}</p><div class="power-detail">${powers.map(p=>`<div>${p.icon}<br>${p.label}<br>${f[p.key]?'★'.repeat(f[p.key]):'—'}</div>`).join('')}</div><div class="nutrients"><b>🔎 入ってる栄養</b><div class="nutrient-buttons">${f.nutrient_list.map(n=>`<button class="nutrient-btn" data-nutrient="${n}">${(NUTRIENTS[n]?.icon||'🔎')} ${n}</button>`).join('')}</div></div>
<div class="allergy-box ${getAllergies()[id]?'active':''}"><div><b>⚠️ アレルギー</b><div class="allergy-help">これは「苦手・イヤ」とは別だよ。</div></div><button id="allergy-toggle" class="allergy-btn">${getAllergies()[id]?'⚠️ アレルギー登録中':'アレルギーに登録'}</button></div>
<div class="pref-box"><b>この食べもの、どうだった？</b><div class="pref-buttons">${prefOptions.map(o=>`<button class="pref-btn ${getPrefs()[id]?.value===o.v?'selected':''}" data-pref="${o.v}">${o.e}<span>${o.t}</span></button>`).join('')}</div>${getPrefs()[id]?.note?`<div class="pref-note">🍳 ${getPrefs()[id].note}</div>`:''}</div>
<div class="meal-add-box"><div class="meal-add-label">${meal.icon} <b>${formatSelectedDateShort()}の${meal.label}</b>に記録</div><button class="primary-btn" id="toggle-today">${inMeal?'✓ 入ってる（取り消す）':'＋ このごはんに追加！'}</button></div>`;
  document.getElementById('modal').classList.remove('hidden');
  document.getElementById('toggle-today').onclick=()=>{
    let a=mealIds(),i=a.findIndex(x=>String(x)===String(id));
    if(i>=0)a.splice(i,1);else a.push(f.id);
    setMealIds(a);closeFood();renderFoods();renderToday();
  };
  document.querySelectorAll('.nutrient-btn').forEach(b=>b.onclick=()=>openNutrient(b.dataset.nutrient));
  document.querySelectorAll('.pref-btn').forEach(b=>b.onclick=()=>savePref(id,b.dataset.pref));
  const ab=document.getElementById('allergy-toggle');if(ab)ab.onclick=()=>toggleAllergy(id);
}
function closeFood(){document.getElementById('modal').classList.add('hidden')}
function openNutrient(n){let info=NUTRIENTS[n]||{icon:'🔎',reading:n,title:'この栄養（えいよう）について',desc:'この栄養（えいよう）の説明（せつめい）は、これから追加（ついか）していくよ。',power:null};let rel=FOODS.filter(f=>f.nutrient_list.includes(n)).slice(0,8);let power=info.power?powers.find(p=>p.key===info.power):null;document.getElementById('nutrient-content').innerHTML=`<div class="nutrient-big">${info.icon}</div><h2>${n}</h2>${info.reading!==n?`<div class="reading">${info.reading}</div>`:''}<h3>${info.title}</h3><p class="modal-copy">${info.desc}</p>${power?`<div class="hint">${power.icon} <b>${power.label}パワー</b>にも、つながるよ！</div>`:''}<h3>この栄養（えいよう）がある食（た）べもの</h3><div class="related-foods">${rel.map(f=>`<button class="related-food" data-food="${f.id}">${f.emoji} ${f.reading}</button>`).join('')}</div>`;document.getElementById('nutrient-modal').classList.remove('hidden');document.querySelectorAll('.related-food').forEach(b=>b.onclick=()=>{document.getElementById('nutrient-modal').classList.add('hidden');openFood(b.dataset.food)})}
function status(v){if(v>=target)return'いい感じ！';if(v>=target*.65)return'もう少（すこ）し！';if(v>0)return'これから！';return'まだないよ。'}
function parseDateLocal(s){const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)}
function formatDateLabel(s){
  const d=parseDateLocal(s),w='日月火水木金土'[d.getDay()];
  return `${d.getMonth()+1}月${d.getDate()}日（${w}）`;
}
function formatSelectedDateShort(){return formatDateLabel(selectedDate).replace(/（.）/,'')}
function changeDate(delta){
  const d=parseDateLocal(selectedDate);d.setDate(d.getDate()+delta);
  selectedDate=localDateString(d);localStorage.setItem('kp_selected_date',selectedDate);
  renderToday();renderFoods();
}
function setActiveMeal(meal){
  activeMeal=meal;localStorage.setItem('kp_active_meal',meal);renderToday();renderFoods();
}
function recordFoods(r){
  const all=[];Object.keys(MEALS).forEach(k=>(r[k]||[]).forEach(id=>all.push(id)));
  return all.map(id=>FOODS.find(f=>String(f.id)===String(id))).filter(Boolean);
}
function removeMealFood(meal,id){
  const r=getRecord();r[meal]=(r[meal]||[]).filter(x=>String(x)!==String(id));saveRecord(r);
  renderToday();renderFoods();
}
function recordedDates(child=activeChild){
  const dates=[],p=`kp_record_v12_${child}_`,old=`kp_today_${child}_`;
  for(let i=0;i<localStorage.length;i++){
    const k=localStorage.key(i);
    if(k&&k.startsWith(p))dates.push(k.slice(p.length));
    if(k&&k.startsWith(old))dates.push(k.slice(old.length));
  }
  return [...new Set(dates)].sort((x,y)=>y.localeCompare(x));
}
function renderHistory(){
  const box=document.getElementById('history-list');if(!box)return;
  const dates=recordedDates().filter(d=>{
    const r=getRecord(activeChild,d);
    return Object.keys(MEALS).some(k=>(r[k]||[]).length);
  });
  if(!dates.length){box.innerHTML='<div class="history-empty">まだ記録はないよ。今日から残していこう！</div>';return}
  box.innerHTML=dates.slice(0,31).map(d=>{
    const r=getRecord(activeChild,d);
    const mealCount=['breakfast','lunch','dinner','snack'].filter(k=>(r[k]||[]).length).length;
    const foodCount=Object.keys(MEALS).reduce((n,k)=>n+(r[k]||[]).length,0);
    return `<button class="history-row ${d===selectedDate?'active':''}" data-history="${d}"><span><b>${formatDateLabel(d)}</b><small>${mealCount}つの食事を記録</small></span><strong>${foodCount}こ 🍽️</strong></button>`;
  }).join('');
  box.querySelectorAll('[data-history]').forEach(b=>b.onclick=()=>{
    selectedDate=b.dataset.history;localStorage.setItem('kp_selected_date',selectedDate);
    renderToday();renderFoods();window.scrollTo({top:0,behavior:'smooth'});
  });
}
function renderToday(){
  renderChild();
  const r=getRecord(),list=recordFoods(r),s={};
  document.getElementById('date-label').textContent=formatDateLabel(selectedDate)+(selectedDate===localDateString()?'　今日':'');
  document.getElementById('date-next').disabled=selectedDate>=localDateString();
  document.querySelectorAll('#meal-tabs [data-meal]').forEach(b=>b.classList.toggle('active',b.dataset.meal===activeMeal));

  const meal=MEALS[activeMeal];
  document.getElementById('active-meal-title').textContent=`${meal.icon} ${meal.label}`;
  const ml=(r[activeMeal]||[]).map(id=>FOODS.find(f=>String(f.id)===String(id))).filter(Boolean);
  document.getElementById('meal-foods').innerHTML=ml.length
    ?ml.map(f=>`<span class="meal-food-tag">${f.emoji} ${f.reading}<button data-remove-meal="${activeMeal}" data-remove-id="${f.id}" aria-label="削除">×</button></span>`).join('')
    :`<div class="meal-empty">${meal.icon} ${meal.label}は、まだ何も入ってないよ。</div>`;
  document.querySelectorAll('[data-remove-meal]').forEach(b=>b.onclick=()=>removeMealFood(b.dataset.removeMeal,b.dataset.removeId));

  powers.forEach(p=>s[p.key]=list.reduce((n,f)=>n+(Number(f[p.key])||0),0));
  document.getElementById('today-bars').innerHTML=powers.map(p=>`<div class="bar-row"><div class="bar-label">${p.icon} ${p.label}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.min(100,s[p.key]/target*100)}%"></div></div><div class="bar-val">${status(s[p.key])}</div></div>`).join('');

  document.getElementById('today-foods').innerHTML=list.length
    ?Object.entries(MEALS).filter(([k])=>(r[k]||[]).length).map(([k,m])=>`<div class="day-meal-group"><b>${m.icon} ${m.label}</b><div>${(r[k]||[]).map(id=>{const f=FOODS.find(x=>String(x.id)===String(id));return f?`<button class="today-tag" data-id="${f.id}">${f.emoji} ${f.reading}</button>`:''}).join('')}</div></div>`).join('')
    :'<span style="color:#8b7e76">まだないよ。図鑑から選んでね。</span>';
  document.querySelectorAll('.today-tag').forEach(b=>b.onclick=()=>openFood(b.dataset.id));

  if(!list.length){
    document.getElementById('today-hint').textContent='今日は、どんなパワーが集まるかな？';
  }else{
    let min=[...powers].sort((a,b)=>s[a.key]-s[b.key])[0],prefs=getPrefs(),allergies=getAllergies();
    let pool=[...FOODS].filter(f=>f[min.key]>0&&!allergies[f.id]&&!['no','dislike'].includes(prefs[f.id]?.value))
      .sort((a,b)=>{let pa=prefs[a.id]?.value==='love'?2:prefs[a.id]?.value==='ok'?1:0,pb=prefs[b.id]?.value==='love'?2:prefs[b.id]?.value==='ok'?1:0;return pb-pa||b[min.key]-a[min.key]});
    let opts=pool.slice(0,4);
    document.getElementById('today-hint').innerHTML=`${min.icon} <b>${min.label}パワー</b>は、明日や次のごはんで集めてもいいね。<div class="suggestions">${opts.map(f=>`<button class="suggestion" data-suggest="${f.id}">${f.emoji} ${f.reading}</button>`).join('')}</div>`;
    document.querySelectorAll('.suggestion').forEach(b=>b.onclick=()=>openFood(b.dataset.suggest));
  }
  renderHistory();
}
document.getElementById('clear-today').onclick=()=>{
  if(confirm(activeChild+'の「'+formatDateLabel(selectedDate)+'」の記録を全部消す？\nほかの日の記録は消えません。')){
    localStorage.removeItem(recordKey());if(typeof cloudDeleteRecord==='function')cloudDeleteRecord(activeChild,selectedDate);renderToday();renderFoods();
  }
};

document.getElementById('date-prev').onclick=()=>changeDate(-1);
document.getElementById('date-next').onclick=()=>changeDate(1);
document.getElementById('date-today').onclick=()=>{
  selectedDate=localDateString();localStorage.setItem('kp_selected_date',selectedDate);renderToday();renderFoods();
};
document.querySelectorAll('#meal-tabs [data-meal]').forEach(b=>b.onclick=()=>setActiveMeal(b.dataset.meal));

const backupBtn=document.getElementById('backup-records');
if(backupBtn)backupBtn.onclick=()=>{
  const payload={app:'karada-power',version:12,exportedAt:new Date().toISOString(),data:{}};
  for(let i=0;i<localStorage.length;i++){
    const k=localStorage.key(i);if(k&&k.startsWith('kp_'))payload.data[k]=localStorage.getItem(k);
  }
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download=`karada-power-backup-${localDateString()}.json`;a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
};

document.querySelectorAll('[data-close="food"]').forEach(x=>x.onclick=closeFood);document.querySelectorAll('[data-close="nutrient"]').forEach(x=>x.onclick=()=>document.getElementById('nutrient-modal').classList.add('hidden'));renderToday();
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
  });
}


const batchModeBtn=document.getElementById('batch-mode-btn');
if(batchModeBtn) batchModeBtn.onclick=startBatchMode;
const batchCancel=document.getElementById('batch-cancel');
if(batchCancel) batchCancel.onclick=stopBatchMode;
const batchAdd=document.getElementById('batch-add');
if(batchAdd) batchAdd.onclick=commitBatchFoods;
updateBatchBar();

document.addEventListener('click',e=>{
 const q=e.target.closest('.quick-eaten'); if(q){toggleTodayQuick(q.dataset.quick,e);return}
 const ph=e.target.closest('[data-power-help]'); if(ph){e.preventDefault();e.stopPropagation();powerHelp(ph.dataset.powerHelp);return}
 const pop=document.getElementById('power-popover'); if(pop&&!pop.contains(e.target))closePowerHelp();
});
renderPowerGuide();
const guide=document.getElementById('power-guide'),gt=document.getElementById('guide-toggle');
if(guide&&gt){let c=localStorage.getItem('kp_guide_collapsed')==='1';guide.classList.toggle('collapsed',c);gt.textContent=c?'開く':'閉じる';gt.onclick=()=>{let n=guide.classList.toggle('collapsed');localStorage.setItem('kp_guide_collapsed',n?'1':'0');gt.textContent=n?'開く':'閉じる'}}
const topBtn=document.getElementById('back-to-top');if(topBtn){window.addEventListener('scroll',()=>topBtn.classList.toggle('hidden',window.scrollY<500),{passive:true});topBtn.onclick=()=>window.scrollTo({top:0,behavior:'smooth'})}


// v7 食品を見る力
const learnToggle=document.getElementById('food-learning-toggle');
const learnBody=document.getElementById('food-learning-body');
const learnArrow=document.getElementById('food-learning-arrow');
if(learnToggle&&learnBody){
 learnToggle.onclick=()=>{
   const closed=learnBody.classList.toggle('hidden');
   if(learnArrow) learnArrow.textContent=closed?'＋':'−';
 };
}

// おやつカテゴリの表示名を補助。
function patchSnackCategory(){
 document.querySelectorAll('button,.chip').forEach(el=>{
   if(el.textContent.trim()==='おやつ') el.textContent='🍭 おやつ';
 });
}
setTimeout(patchSnackCategory,0);

// 食材詳細に「エネルギー」「食品を見る力」を追加する。
// 既存モーダルが開いた後に内容へ差し込むので、既存機能を壊しにくい。
const originalOpenFoodV7 = typeof openFood==='function' ? openFood : null;
if(originalOpenFoodV7){
 openFood=function(id){
   originalOpenFoodV7(id);
   const f=FOODS.find(x=>String(x.id)===String(id)); if(!f)return;
   const modal=document.querySelector('.modal-content,.modal-card,.dialog,.sheet');
   if(!modal)return;
   const old=modal.querySelector('.v7-food-info'); if(old)old.remove();
   const box=document.createElement('div'); box.className='v7-food-info';
   let energy=(f.energy_tags||[]).map(x=>`<span class="energy-pill">⚡ ${x}</span>`).join('');
   let type=f.food_type==='processed'
      ? `<div class="processed-note"><b>🏭 加工食品</b><p>加工した食べものだよ。原材料や添加物、食塩などは商品によってちがうよ。</p><b>🏷️ パッケージの「原材料名」を見てみよう！</b></div>`
      : `<div class="whole-note"><b>🌱 食材そのもの</b><p>食材に近い形だよ。料理するときに使う調味料なども合わせて見てみよう。</p></div>`;
   box.innerHTML=`${energy?`<div class="energy-box"><b>⚡ エネルギーになる栄養</b><div>${energy}</div></div>`:''}${type}`;
   const pref=modal.querySelector('.allergy-box,.pref-box');
   if(pref) modal.insertBefore(box,pref); else modal.appendChild(box);
 }
}

const sg=document.getElementById('score-guide-toggle'), sgb=document.getElementById('score-guide-body');
if(sg&&sgb)sg.onclick=()=>{const c=sgb.classList.toggle('hidden');sg.textContent=c?'くわしく':'閉じる'};

// v9: official source badge / nutrient facts
const _openFoodV9 = typeof openFood==='function' ? openFood : null;
if(_openFoodV9){
 openFood=function(id){
   _openFoodV9(id);
   const f=FOODS.find(x=>String(x.id)===String(id)); if(!f||!f.official_nutrients)return;
   const modal=document.querySelector('.modal-content,.modal-card,.dialog,.sheet');
   if(!modal)return;
   const old=modal.querySelector('.official-v9'); if(old)old.remove();
   const n=f.official_nutrients;
   const labels={
     protein_g:'たんぱく質',fat_g:'脂質',calcium_mg:'カルシウム',iron_mg:'鉄',zinc_mg:'亜鉛',
     vitamin_a_rae_ug:'ビタミンA',vitamin_d_ug:'ビタミンD',vitamin_e_mg:'ビタミンE',
     vitamin_k_ug:'ビタミンK',vitamin_b6_mg:'ビタミンB6',vitamin_b12_ug:'ビタミンB12',
     folate_ug:'葉酸',vitamin_c_mg:'ビタミンC'
   };
   const units={protein_g:'g',fat_g:'g',calcium_mg:'mg',iron_mg:'mg',zinc_mg:'mg',
     vitamin_a_rae_ug:'µg',vitamin_d_ug:'µg',vitamin_e_mg:'mg',vitamin_k_ug:'µg',
     vitamin_b6_mg:'mg',vitamin_b12_ug:'µg',folate_ug:'µg',vitamin_c_mg:'mg'};
   const chips=Object.keys(labels).filter(k=>n[k]!=null).map(k=>`<span class="official-chip">${labels[k]} ${n[k]}${units[k]}</span>`).join('');
   const box=document.createElement('div');
   box.className='official-v9';
   box.innerHTML=`<div class="official-head"><b>✅ 文科省データ確認済み</b><span>食品番号 ${n.mext_id}</span></div>
   <p class="official-name">${n.official_name}・可食部100gあたり</p>
   <div class="official-chips">${chips}</div>
   <p class="official-note">★はこの公式データをもとに調整中。表示値が未収載の成分は、勝手に0として扱っていないよ。</p>`;
   const info=modal.querySelector('.v7-food-info');
   if(info) info.before(box); else modal.appendChild(box);
 }
}

const _openFoodV10=typeof openFood==='function'?openFood:null;
if(_openFoodV10){
 openFood=function(id){
  _openFoodV10(id);
  const f=FOODS.find(x=>String(x.id)===String(id)); if(!f||!f.v10_calculated)return;
  const modal=document.querySelector('.modal-content,.modal-card,.dialog,.sheet');if(!modal)return;
  modal.querySelector('.calc-v10')?.remove();
  const names={head:'🧠 あたま',sparkle:'✨ キラキラ',muscle:'💪 マッチョ',bone:'🦴 ほね',immunity:'🛡️ めんえき'};
  const rows=Object.entries(f.v10_calculated).map(([k,v])=>`<div><span>${names[k]}</span><b>${'★'.repeat(v.stars)}${'☆'.repeat(3-v.stars)}</b></div>`).join('');
  const b=document.createElement('div');b.className='calc-v10';
  b.innerHTML=`<b>🧮 1回に食べる量で計算</b><p>この画面では約${f.serving_g_v10}gを1回量の目安として計算。</p><div class="calc-rows">${rows}</div><small>※1回量はアプリの比較用目安。必要量・ノルマではないよ。公式成分値が未照合の栄養は0と決めつけず、計算途中として扱うよ。</small>`;
  const off=modal.querySelector('.official-v9'); if(off)off.after(b);else modal.appendChild(b);
 }
}

const _openFoodV11=typeof openFood==='function'?openFood:null;
if(_openFoodV11){openFood=function(id){_openFoodV11(id);const f=FOODS.find(x=>String(x.id)===String(id));if(!f||!f.food_type)return;
const m=document.querySelector('.modal-content,.modal-card,.dialog,.sheet');if(!m)return;m.querySelector('.product-v11')?.remove();
const n=f.product_nutrition;let facts='';
if(n){facts=`<p><b>${n.basis}</b></p><div class="product-facts">${[['🔥',n.kcal,'kcal'],['たんぱく質',n.protein,'g'],['脂質',n.fat,'g'],['炭水化物',n.carb,'g'],['食塩',n.salt,'g'],['カルシウム',n.calcium,'mg']].filter(x=>x[1]!=null).map(x=>`<span>${x[0]} ${x[1]}${x[2]}</span>`).join('')}</div>`}
const al=(f.allergens||[]).length?`<p><b>⚠️ 表示アレルゲン：</b>${f.allergens.join('・')}</p>`:'';
const b=document.createElement('div');b.className='product-v11';b.innerHTML=`<b>🏷️ ${f.product_verified?f.brand+' 公表データ':'商品によってちがうよ'}</b>${facts}${al}<small>加工食品は商品が変わることもあるよ。食べるときは手元のパッケージも確認しよう。</small>`;
const t=m.querySelector('.v7-food-info');if(t)t.before(b);else m.appendChild(b);}}

function updateFoodAddContextV12(){
  const head=document.querySelector('#view-foods .section-head');if(!head)return;
  let x=document.getElementById('food-add-context-v12');
  if(!x){x=document.createElement('div');x.id='food-add-context-v12';x.className='food-add-context-v12';head.after(x)}
  const m=MEALS[activeMeal];
  x.innerHTML=`<span>📅 ${formatDateLabel(selectedDate)}</span><b>${m.icon} ${m.label}に追加中</b><button id="record-view-v12">記録を見る</button>`;
  const b=document.getElementById('record-view-v12');if(b)b.onclick=()=>showView('today');
}
const renderFoodsV12Original=renderFoods;
renderFoods=function(sortPower=null){
  renderFoodsV12Original(sortPower);
  updateFoodAddContextV12();
  patchSnackCategory();
};
updateFoodAddContextV12();


/* ===== v14 production: D1 cloud sync =====
   Same-origin Worker route: /api/karada-power/*
   D1 stores meal history + food preferences/allergy flags.
   localStorage remains the instant/offline cache.
*/
const KP_CLOUD_BASE='/api/karada-power';
const KP_DEVICE_TOKEN_KEY='kp_cloud_device_token_v1';
const KP_DEVICE_LABEL_KEY='kp_cloud_device_label_v1';
let kpCloudBusy=false;

function cloudToken(){return localStorage.getItem(KP_DEVICE_TOKEN_KEY)||''}
function cloudHeaders(extra={}){const t=cloudToken();return {...extra,...(t?{'Authorization':`Bearer ${t}`}:{})}}
function setCloudStatus(mode,msg=''){
  const title=document.getElementById('cloud-save-title'),detail=document.getElementById('cloud-save-detail'),btn=document.getElementById('cloud-pair-btn');
  if(!title||!detail||!btn)return;
  if(mode==='connected'){
    title.textContent='☁️ D1に保存中';
    detail.textContent=msg||'食事記録・好き嫌い・アレルギー設定を端末内＋D1の両方に保存しています。';
    btn.textContent='✓ 接続済み';
  }else if(mode==='error'){
    title.textContent='📱 端末には保存中';detail.textContent=msg||'D1に接続できません。端末内のデータはそのまま残っています。';btn.textContent='☁️ 再接続';
  }else{
    title.textContent='📱 この端末に保存中';detail.textContent=msg||'D1をつなぐと、食事記録や好き嫌いもクラウドに残るよ。';btn.textContent='☁️ D1につなぐ';
  }
}
async function cloudRequest(path,options={}){
  const headers=cloudHeaders(options.headers||{}),res=await fetch(KP_CLOUD_BASE+path,{...options,headers});
  let body=null;try{body=await res.json()}catch(e){}
  if(!res.ok){const err=new Error(body?.error||`HTTP ${res.status}`);err.status=res.status;throw err}
  return body;
}
async function cloudPushRecord(child,date,record){
  if(!cloudToken())return;
  try{await cloudRequest(`/records/${encodeURIComponent(child)}/${date}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({record})});setCloudStatus('connected')}
  catch(e){setCloudStatus('error','D1への食事記録保存に失敗。端末内には保存済みです。')}
}
async function cloudDeleteRecord(child,date){
  if(!cloudToken())return;
  try{await cloudRequest(`/records/${encodeURIComponent(child)}/${date}`,{method:'DELETE'});setCloudStatus('connected')}
  catch(e){setCloudStatus('error','D1側の削除に失敗。あとで再接続してね。')}
}
async function cloudPushSettings(child,updatedAt=null){
  if(!cloudToken())return;
  const stamp=updatedAt||localStorage.getItem(settingsUpdatedKey(child))||new Date().toISOString();
  const settings={version:14,prefs:getPrefs(child),allergies:getAllergies(child),updatedAt:stamp};
  try{
    await cloudRequest(`/settings/${encodeURIComponent(child)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({settings})});
    setCloudStatus('connected');
  }catch(e){setCloudStatus('error','好き嫌い・アレルギー設定のD1保存に失敗。端末内には保存済みです。')}
}
function localRecordEntries(){
  const rows=[];
  for(let i=0;i<localStorage.length;i++){
    const k=localStorage.key(i),m=k&&k.match(/^kp_record_v12_(.+)_(\d{4}-\d{2}-\d{2})$/);
    if(!m)continue;
    let r=null;try{r=JSON.parse(localStorage.getItem(k))}catch(e){}
    if(r)rows.push({key:k,child:m[1],date:m[2],record:normalizeRecord(r)});
  }
  return rows;
}
async function cloudPullAll(){
  if(!cloudToken()||kpCloudBusy)return;
  kpCloudBusy=true;
  try{
    const data=await cloudRequest('/bootstrap');

    // Meal records: newest client edit wins. Local-only dates are uploaded after merge.
    const remoteKeys=new Set();
    for(const row of (data.records||[])){
      const remote=normalizeRecord(row.record),key=recordKey(row.child,row.record_date);remoteKeys.add(key);
      let local=null;try{local=JSON.parse(localStorage.getItem(key)||'null')}catch(e){}
      if(!local){localStorage.setItem(key,JSON.stringify(remote));continue}
      local=normalizeRecord(local);
      const rt=String(remote.updatedAt||row.updated_at||''),lt=String(local.updatedAt||'');
      if(lt>rt) await cloudPushRecord(row.child,row.record_date,local);
      else localStorage.setItem(key,JSON.stringify(remote));
    }
    for(const row of localRecordEntries()) if(!remoteKeys.has(row.key)) await cloudPushRecord(row.child,row.date,row.record);

    // Child food settings: preferences, recipe notes and food-specific allergy flags.
    const remoteChildren=new Set();
    for(const row of (data.settings||[])){
      const child=row.child,remote=row.settings||{},remoteStamp=String(remote.updatedAt||row.updated_at||'');remoteChildren.add(child);
      const localStamp=String(localStorage.getItem(settingsUpdatedKey(child))||'');
      const hasLocal=Object.keys(getPrefs(child)).length||Object.keys(getAllergies(child)).length;
      if(hasLocal&&localStamp>remoteStamp){await cloudPushSettings(child,localStamp)}
      else{
        localStorage.setItem(prefKey(child),JSON.stringify(remote.prefs||{}));
        localStorage.setItem(allergyKey(child),JSON.stringify(remote.allergies||{}));
        localStorage.setItem(settingsUpdatedKey(child),remoteStamp||new Date().toISOString());
      }
    }
    for(const child of ['長女','次女']){
      if(remoteChildren.has(child))continue;
      const hasLocal=Object.keys(getPrefs(child)).length||Object.keys(getAllergies(child)).length;
      if(hasLocal) await cloudPushSettings(child,localStorage.getItem(settingsUpdatedKey(child))||markSettingsUpdated(child));
    }

    setCloudStatus('connected',`${(data.records||[]).length}日分の記録と姉妹の設定をD1と同期しました。`);
    renderToday();renderFoods();
  }catch(e){
    if(e.status===401){localStorage.removeItem(KP_DEVICE_TOKEN_KEY);setCloudStatus('error','D1の接続情報が無効です。もう一度つないでね。')}
    else setCloudStatus('error','D1に接続できません。端末内のデータは使えます。');
  }finally{kpCloudBusy=false}
}
async function cloudPair(){
  if(cloudToken()){await cloudPullAll();return}
  const code=prompt('D1の家族コードを入力してね。\n※最初にこの端末を登録するときだけ使います。');if(!code)return;
  const label=prompt('この端末の名前（例：長女iPhone）','iPhone')||'family-device';
  try{
    const res=await fetch(KP_CLOUD_BASE+'/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,label})});
    const body=await res.json().catch(()=>({}));if(!res.ok)throw new Error(body.error||`HTTP ${res.status}`);
    localStorage.setItem(KP_DEVICE_TOKEN_KEY,body.token);localStorage.setItem(KP_DEVICE_LABEL_KEY,label);
    setCloudStatus('connected','接続できたよ。D1と端末の新しい方を残して同期します。');
    // Important: pull/compare first. Do not blindly overwrite newer cloud data with stale local data.
    await cloudPullAll();
  }catch(e){setCloudStatus('error','家族コードかD1設定を確認してね。')}
}
function initCloudSync(){
  const btn=document.getElementById('cloud-pair-btn');if(btn)btn.onclick=cloudPair;
  if(cloudToken()){setCloudStatus('connected','D1へ接続しています…');cloudPullAll()}else setCloudStatus('local');
}
initCloudSync();
