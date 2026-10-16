const root=document.querySelector('#app'),sheet=document.querySelector('#sheet');
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
const btn=(text,fn,cls='')=>{const n=el('button',text,cls);n.type='button';n.onclick=async()=>{n.disabled=true;try{await fn()}catch(e){error(e)}finally{n.disabled=false}};return n};
const fmt=n=>Number(n).toLocaleString('ja-JP');
let giftData=null;
let households=[],household='',state,finance=null,rewards=[],requests=[],selected='',choreData=null,choreError='',choreScope='person',preview=new URLSearchParams(location.search).get('preview'),demo=Boolean(preview);
async function api(path='',method='GET',body){const r=await fetch('/api/passbook'+path+(path.includes('?')?'&':'?')+'household='+encodeURIComponent(household),{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const d=await r.json();if(r.status===401){location.replace('/login');throw Error('ログインしてください')}if(!r.ok)throw Error(d.error);return d}
function error(e){const target=sheet.open?sheet:root;for(const old of target.querySelectorAll('.error'))old.remove();const n=el('p',e.message,'error');n.setAttribute('role','alert');target.append(n)}
function modal(title){sheet.replaceChildren(btn('閉じる',()=>sheet.close(),'quiet small close'),el('h2',title));if(!sheet.open)sheet.showModal()}
function example(){const admin=preview==='admin';return {admin,active:true,household:{name:'サンプルの家庭'},own_child_id:'sample-a',children:[{id:'sample-a',display_name:'こども A'},{id:'sample-b',display_name:'こども B'}],accounts:[{id:'money-a',child_id:'sample-a',display_name:'こども A',name:'現金',code:'cash',kind:'money',symbol:'円',balance:2400,pending:0},{id:'points-a',child_id:'sample-a',display_name:'こども A',name:'お手伝いポイント',code:'chores',kind:'points',symbol:'ポイント',balance:180,pending:30},{id:'money-b',child_id:'sample-b',display_name:'こども B',name:'現金',code:'cash',kind:'money',symbol:'円',balance:1200,pending:0},{id:'points-b',child_id:'sample-b',display_name:'こども B',name:'お手伝いポイント',code:'chores',kind:'points',symbol:'ポイント',balance:95,pending:0}].filter(a=>admin||a.id!=='money-b'),sibling_points_visible:true}}
async function load(){if(demo){state=example();rewards=[{id:'r1',name:'好きなおやつ',cost:30,stock:null,unit_name:'お手伝いポイント'},{id:'r2',name:'おでかけのリクエスト',cost:200,stock:null,unit_name:'お手伝いポイント'}];requests=[{id:'sample-request',account_id:'points-a',display_name:'こども A',reward_name:'好きなおやつ',cost:30,status:'pending'}]}else{state=await api();if(state.active&&state.gift)giftData=await api('/gifts');if(state.active&&!state.gift_only){[rewards,requests,choreData,finance]=await Promise.all([api('/rewards'),api('/requests'),api('/chores').catch(e=>{choreError=e.message;return null}),api('/finance')]);if(choreData)choreError=''}}selected=selected||state.own_child_id||state.children[0]?.id||state.accounts[0]?.child_id;render()}
function render(){root.replaceChildren();const h=el('header'),brand=el('div',undefined,'brand'),image=el('img');image.src='/home-icon-192.png';image.alt='';const title=el('div');title.append(el('small','WAGAYA','eyebrow'),el('h1','つうちょう'));brand.append(image,title);const back=el('a','わが家へ');back.href='/';h.append(brand,back);root.append(h);if(!demo&&households.length>1){const chooser=el('select');chooser.setAttribute('aria-label','家庭を選ぶ');for(const g of households){const o=el('option',g.name);o.value=g.id;chooser.append(o)}chooser.value=household;chooser.onchange=async()=>{household=chooser.value;selected='';choreData=null;choreScope='person';try{await load()}catch(e){error(e)}};root.append(chooser)}if(demo)root.append(el('p','見た目・操作の確認用です。名前と金額はサンプルで、実際のデータは変更しません。','notice demo'));if(!state.active&&!state.imported){root.append(el('section',undefined,'card'));const card=root.lastChild;card.append(el('h2','残高と履歴を引き継ぐ準備中'),el('p','これまでのお金・ポイントを確認してから、このつうちょうに引き継ぎます。'));if(state.admin){card.append(btn('子ども画面を見てみる',()=>location.assign('/apps/passbook/?preview=child'),'quiet'),btn('ママ画面を見てみる',()=>location.assign('/apps/passbook/?preview=admin'),'quiet'),btn('旧データの接続を確認',legacyPreview,'quiet'),btn('バックアップと引き継ぎ',migration,'quiet'))}return}
if(state.active&&!demo)renderGifts();
if(state.gift_only)return;
if(state.admin)renderFamilyBalances();
if(!state.active)root.append(el('p','引き継いだ残高の確認画面です。旧アプリの更新停止と照合が終わるまで、入出金・交換はできません。','notice'),btn('引き継ぎ状況を見る',migration,'quiet'));if(state.admin){const s=el('select');for(const c of state.children){const o=el('option',c.display_name);o.value=c.id;s.append(o)}s.value=selected;s.onchange=()=>{selected=s.value;render()};root.append(el('p','管理する人','muted'),s)}else root.append(el('p',(state.accounts.find(a=>a.child_id===selected)?.display_name||'あなた')+' のつうちょう','name'));

if(state.admin&&state.active&&!demo)root.append(btn('お金の設定（お小遣い・利息・おさいふ）',financeSettings,'quiet'));
for(const a of state.accounts.filter(a=>a.child_id===selected)){const c=el('section',undefined,'card '+(a.kind==='money'?'cash':'points')),top=el('div',undefined,'topline');top.append(el('h2',a.kind==='money'?(a.code==='wallet'?'おさいふ':'ママ銀行'):a.name),btn('履歴を見る',()=>history(a),'history'));if(!demo&&(state.gift?.guardian||a.child_id===state.own_child_id||a.child_id?.startsWith('user:')))top.append(btn('通帳表示・印刷',()=>{const u=new URL('book.html',location.href);u.searchParams.set('household',household);u.searchParams.set('account',a.id);location.assign(u.href);},'history'));const value=el('div',fmt(a.balance),'balance');value.append(el('span',a.symbol));c.append(top,value);if(a.pending)c.append(el('p','ママの確認待ち：'+fmt(a.pending)+' ポイント','muted'));if(a.kind==='points'){if(!state.admin)c.append(btn('🎁 ポイントをこうかん',()=>exchange(a),'exchange'));else c.append(el('p','交換に使える：'+fmt(a.balance-a.pending)+' ポイント','muted'))}if(state.admin){const actions=el('div',undefined,'actions');actions.append(btn(a.kind==='money'?'＋ 入金':'＋ ポイントを追加',()=>entry(a,1),'quiet'),btn(a.kind==='money'?'− 出金':'− ポイントを調整',()=>entry(a,-1),'quiet'));if(!state.active)for(const b of actions.querySelectorAll('button'))b.disabled=true;c.append(actions)}root.append(c)}
if(state.active&&!demo){renderCashTools();renderDailyChores();}
const pending=requests.filter(r=>r.status==='pending');if(pending.length){const c=el('section',undefined,'card');c.append(el('h2',state.admin?'交換申請 · '+pending.length+'件':'ママの確認待ち'));for(const r of pending){const row=el('div',undefined,'row'),t=el('div');t.append(el('strong',r.reward_name),el('p',(state.admin?r.display_name+' · ':'')+fmt(r.cost)+' ポイント','muted'));row.append(t);if(state.admin){const b=btn('確認する',()=>resolve(r),'quiet small');b.disabled=!state.active;row.append(b)}else row.append(el('span','確認待ち','pending'));c.append(row)}root.append(c)}
if(!state.admin&&state.sibling_points_visible){const others=state.accounts.filter(a=>a.child_id!==selected&&a.kind==='points');if(others.length){const c=el('section',undefined,'card');c.append(el('h2','みんなのポイント'));for(const a of others){const r=el('div',undefined,'row');r.append(el('span',a.display_name),el('strong',fmt(a.balance)+' ポイント'));c.append(r)}root.append(c)}}if(state.admin&&state.active){root.append(btn('交換するもの・共有の設定',settings,'quiet'))}root.append(el('p','残高をまとめて、毎日のがんばりをひとつずつ。','note'))}
async function history(a){modal(a.kind==='money'?'おかねの履歴':a.name+'の履歴');let before=null;async function more(){const rows=demo?[{delta:100,memo:'お手伝いをがんばった',occurred_at:'2026-10-02T10:00:00Z'},{delta:-30,memo:'好きなおやつ',occurred_at:'2026-10-01T10:00:00Z'}]:await api('/history?account='+encodeURIComponent(a.id)+(before?'&before='+encodeURIComponent(before):''));if(!rows.length&&!before)sheet.append(el('p','まだ履歴はありません。','empty'));for(const r of rows){const n=el('div',undefined,'row'),t=el('div');t.append(el('strong',r.memo),el('p',new Date(r.occurred_at).toLocaleDateString('ja-JP'),'muted'));n.append(t,el('strong',(r.delta>0?'+':'')+fmt(r.delta)+' '+a.symbol,r.delta>0?'plus':'minus'));sheet.append(n)}if(rows.length===50){before=rows.at(-1).id;const b=btn('前の履歴を見る',async()=>{b.remove();await more()},'quiet');sheet.append(b)}}await more()}
async function exchange(a){modal('ポイントをこうかん');sheet.append(el('p','つかえるポイント：'+fmt(a.balance-a.pending),'notice'));const list=rewards.filter(r=>demo||r.unit_id===a.unit_id);if(!list.length)sheet.append(el('p','交換できるものは、まだ登録されていません。','empty'));const grid=el('div',undefined,'reward-grid');sheet.append(grid);for(const r of list){const n=rewardCard(r);const waiting=requests.some(q=>q.reward_id===r.id&&q.account_id===a.id&&q.status==='pending'),ok=r.stock!==0&&a.balance-a.pending>=r.cost&&!waiting;const b=btn(waiting?'ママの確認待ち':r.stock===0?'いまは交換できません':ok?'これとこうかんする':'あと '+fmt(r.cost-(a.balance-a.pending))+' ポイント',async()=>{if(!confirm(r.name+' を '+r.cost+' ポイントで申請しますか？'))return;if(demo){requests.push({id:crypto.randomUUID(),reward_id:r.id,account_id:a.id,reward_name:r.name,cost:r.cost,status:'pending'});a.pending+=r.cost;render()}else{await api('/requests','POST',{reward_id:r.id});await load()}sheet.close()});b.disabled=!ok;n.append(b);grid.append(n)}}
function field(f,name,label,type='text'){const l=el('label',label);l.htmlFor='field-'+name;f.append(l);const i=el('input');i.id='field-'+name;i.name=name;i.type=type;i.required=true;f.append(i);return i}
function entry(a,sign){modal(a.kind==='money'?(sign>0?'入金する':'出金する'):(sign>0?'ポイントを追加':'ポイントを調整'));const f=el('form');const amount=field(f,'amount',a.symbol,'number');amount.min=1;amount.max=10000000;amount.step=1;const memo=field(f,'memo','理由（任意）');memo.required=false;const presets=el('div',undefined,'actions');for(const label of a.kind==='money'?['おこづかい','お手伝い','おふろあらい']:['お手伝い','がんばった','調整'])presets.append(btn(label,()=>{memo.value=label},'quiet small'));f.append(presets);const submit=el('button','登録する');submit.type='submit';f.append(submit);const event=crypto.randomUUID();f.onsubmit=async e=>{e.preventDefault();submit.disabled=true;try{const data=Object.fromEntries(new FormData(f));if(demo){a.balance+=sign*Number(data.amount);render()}else{await api('/entries','POST',{account_id:a.id,delta:sign*Number(data.amount),memo:data.memo||(a.kind==='money'?(sign>0?'入金':'出金'):(sign>0?'ポイント追加':'ポイント調整')),event_id:event});await load()}sheet.close()}catch(e){error(e)}finally{submit.disabled=false}};sheet.append(f)}
function resolve(r){modal('交換申請を確認');sheet.append(el('p',r.display_name+' · '+r.reward_name),el('p',fmt(r.cost)+' ポイント'));for(const [status,label] of [['approved','交換を承認する'],['rejected','今回は見送る']])sheet.append(btn(label,async()=>{if(!confirm(label+'？'))return;if(demo){r.status=status;const a=state.accounts.find(a=>a.id===r.account_id);a.pending-=r.cost;if(status==='approved')a.balance-=r.cost;render()}else{await api('/requests/'+encodeURIComponent(r.id),'PUT',{status});await load()}sheet.close()},status==='rejected'?'quiet':''))}
function rewardCard(r){const n=el('article',undefined,'reward-card'),media=el('div',undefined,'reward-media'),fallback=el('span','🎁','reward-placeholder');media.append(fallback);if(r.image_path){const img=el('img');img.src=r.image_path;img.alt=r.name;img.loading='lazy';img.onload=()=>{fallback.hidden=true};img.onerror=()=>{img.remove();fallback.hidden=false};media.append(img)}n.append(media,el('strong',r.name),el('p',fmt(r.cost)+' ポイント','reward-price'));return n}
function settings(){modal('交換するもの・共有');sheet.append(btn('＋ 交換するものを追加',()=>rewardForm(),'quiet'));const grid=el('div',undefined,'reward-grid');for(const r of rewards){const c=rewardCard(r);if(!r.enabled&&!demo)c.append(el('span','非表示','muted'));c.append(btn('編集する',()=>rewardForm(r),'quiet small'));grid.append(c)}sheet.append(grid);const section=el('section',undefined,'sharing-settings'),l=el('label'),check=el('input');check.type='checkbox';check.checked=state.sibling_points_visible;check.onchange=async()=>{try{if(!demo)await api('/settings','PUT',{sibling_points_visible:check.checked});state.sibling_points_visible=check.checked}catch(e){check.checked=!check.checked;error(e)}};l.append(check,document.createTextNode('姉妹・兄弟のポイントを見られるようにする'));section.append(el('h2','ポイントの共有'),l,el('p','お金の残高と履歴は本人と管理者だけが見られます。','muted'));sheet.append(section)}
function rewardForm(reward=null){
 modal(reward?'交換するものを編集':'交換するものを追加');const f=el('form');const name=field(f,'name','商品名');name.value=reward?.name||'';name.maxLength=200;
 const select=el('select');select.name='unit_id';const seen=new Set();for(const a of state.accounts.filter(a=>a.kind==='points')){if(seen.has(a.unit_id||a.name))continue;seen.add(a.unit_id||a.name);const o=el('option',a.name);o.value=a.unit_id||a.name;select.append(o)}if(reward){select.value=reward.unit_id;select.disabled=true}f.append(el('label','ポイントの種類'),select);
 const cost=field(f,'cost','必要ポイント','number');cost.min=1;cost.max=10000000;cost.step=1;cost.value=reward?.cost||'';const stock=field(f,'stock','個数（空欄は制限なし）','number');stock.required=false;stock.min=0;stock.max=10000000;stock.step=1;stock.value=reward?.stock??'';
 const preview=el('div',undefined,'reward-edit-preview'),status=el('p','','muted');if(reward)preview.append(rewardCard(reward));let changed=false,image=null,preparing=false;const choose=el('input');choose.type='file';choose.accept='image/*';choose.id='reward-photo';choose.name='photo';f.append(el('label','商品画像'),choose,preview,status);choose.onchange=async()=>{if(!choose.files?.[0])return;preparing=true;submit.disabled=true;status.textContent='画像を準備しています…';try{const data=await compressImageFile(choose.files[0]);if(data.length>500000)throw Error('画像が大きすぎます。小さめの写真を選んでください');image=data;changed=true;preview.replaceChildren();const img=el('img');img.src=data;img.alt='選んだ画像';preview.append(img);status.textContent='画像を選びました。「保存する」で反映します。'}catch(e){status.textContent=e.message;choose.value=''}finally{preparing=false;submit.disabled=false}};
 f.append(btn('画像を外す',()=>{image=null;changed=true;choose.value='';preview.replaceChildren(el('span','🎁','reward-placeholder'));status.textContent='画像を外します。「保存する」で反映します。'},'quiet small'));
 const enabled=el('input');enabled.type='checkbox';enabled.checked=reward?Boolean(reward.enabled??true):true;const label=el('label');label.append(enabled,document.createTextNode('交換するものを表示する'));if(reward)f.append(label);
 const submit=el('button',reward?'保存する':'登録する');submit.type='submit';f.append(submit);f.onsubmit=async e=>{e.preventDefault();if(preparing)return;submit.disabled=true;try{const data={name:name.value,cost:Number(cost.value),stock:stock.value===''?null:Number(stock.value),unit_id:select.value,enabled:enabled.checked,edit_revision:reward?.edit_revision??0};if(changed||!reward)data.image_url=image;if(demo){if(reward)Object.assign(reward,data);else rewards.push({...data,id:crypto.randomUUID(),unit_name:select.selectedOptions[0].textContent});settings()}else{await api('/rewards'+(reward?'/'+encodeURIComponent(reward.id):''),reward?'PUT':'POST',data);await load();settings()}}catch(e){error(e)}finally{submit.disabled=false}};sheet.append(f)
}
addEventListener('pageshow',e=>{if(e.persisted)location.reload()});
(async()=>{const groups=await api('/households');households=groups;if(groups.length>1&&!household){household=groups[0].id}if(!demo)household=household||groups[0]?.id||'';await load();if(!demo&&new URLSearchParams(location.search).get('gifts')==='1'&&state.active)await giftList();})().catch(error);

async function legacyPreview(){modal('引き継ぎの確認');const d=await api('/legacy-preview');if(!d.configured){sheet.append(el('p',d.message,'notice'));return}sheet.append(el('p','旧データを読み取った結果です。まだ移行・変更していません。','notice'));for(const [key,value] of Object.entries(d.balances||{}))sheet.append(el('p',key+'：'+fmt(value)+' 円'));for(const m of d.members||[])sheet.append(el('p',m.name+'：'+fmt(Number(m.earned)-Number(m.spent))+' ポイント（確認待ち '+fmt(m.pending)+'）'));sheet.append(el('p','銀行の履歴：'+(d.history_count??'形式の確認が必要')+'件','muted'))}


async function migration(){
 modal('バックアップと引き継ぎ');const data=await api('/migration');
 if(data.imported){sheet.append(el('p',data.active?'本番のつうちょうは利用開始済みです。':'バックアップと取込は完了しています。','notice'));const names=new Map([...data.children,data.self].map(c=>[c.id,c.display_name]));for(const r of data.summary)sheet.append(el('p',(names.get(r.target)||r.target)+'：'+fmt(r.balance)+(r.unit==='cash'?' 円':' ポイント')));if(!data.active){sheet.append(el('p',data.changed?'取込後に旧アプリのデータが更新されています。本番への切り替えは止めています。':'取込時点の旧データと一致しています。旧アプリの更新停止を確認してから本番へ切り替えます。','notice'));sheet.append(el('p','切替後の入出金・ポイント登録は、このつうちょうのママ画面から行います。旧銀行・旧お手伝いからは登録できなくなります。','muted'));const start=btn('確認して本番のつうちょうを使い始める',async()=>{if(!confirm('残高と履歴を確認しましたか？旧Workerの停止とバックアップを再確認して、新つうちょうを有効にします。'))return;start.disabled=true;try{await api('/activation','POST',{confirmed:true});sheet.close();await load();modal('つうちょうの利用を開始しました');sheet.append(el('p','HOMEからつうちょうを開けます。入出金・ポイント追加・交換が使えます。','notice'))}catch(e){error(e);start.disabled=false}});start.disabled=data.changed;sheet.append(start)}return}
 sheet.append(el('p','今あるHOMEアカウントへの対応先を選んでください。再登録は不要です。バックアップを保存してから取り込みます。','notice'));
 const form=el('form'),mapping={bank:{},points:{}};
 function choose(kind,id,label,adult=false){const lab=el('label',label),sel=el('select');sel.id='map-'+kind+'-'+id;lab.htmlFor=sel.id;sel.required=true;sel.append(el('option','対応先を選んでください'));sel.firstChild.value='';for(const c of adult?[...data.children,data.self]:data.children){const o=el('option',c.display_name+(c.user_id===null?'（未登録）':''));o.value=c.id;o.disabled=c.user_id===null;sel.append(o)}sel.onchange=()=>{mapping[kind][id]=sel.value};form.append(lab,sel)}
 form.append(el('h2','銀行の口座'));
 for(const a of data.bank_accounts)choose('bank',a.id,(a.id==='usagi'?'うさぎ（長女）':a.id==='kuma'?'ユニコーン（次女）':a.id)+'：'+fmt(a.balance)+' 円');
 form.append(el('h2','お手伝いポイント'));
 for(const m of data.members)choose('points',String(m.id),m.name,true);
 const submit=el('button','バックアップを保存して取り込む');submit.type='submit';form.append(submit);form.onsubmit=async e=>{e.preventDefault();submit.disabled=true;try{const result=await api('/migration','POST',{mapping});sheet.close();await load();modal('引き継ぎの結果');sheet.append(el('p',result.reconciled?'バックアップ保存・取込・残高照合が完了しました。':'この家庭は取込済みです。','notice'),el('p','まだ本番の入出金はできません。旧アプリの更新停止と最終確認を行ってから切り替えます。'))}catch(e){error(e)}finally{submit.disabled=false}};sheet.append(form)
}

function renderDailyChores(){
 const card=el('section',undefined,'card daily-chores'),top=el('div',undefined,'topline');top.append(el('h2','🧹 今日のお手伝い'));if(state.admin)top.append(btn('設定・追加',choresSettings,'quiet small'));card.append(top);root.append(card);
 if(!choreData){card.append(el('p',choreError||'お手伝いを読み込めませんでした','muted'),btn('読み直す',load,'quiet'));return}
 const d=choreData,names=new Map(d.people.map(p=>[p.id,p.display_name]));card.append(el('small',d.today.replaceAll('-',' / ')));
 if(state.admin&&!d.imported&&d.can_import&&!d.chores.length){card.append(el('p','初回だけ、今までの当番設定を引き継いでください。','muted'),btn('当番設定を引き継ぐ（初回のみ）',async()=>{if(!confirm('お手伝いと当番設定を引き継ぎます。過去の残高・履歴は再加算しません。'))return;await api('/chores/import','POST',{});await load()},'quiet'));return}
 const enabled=d.chores.filter(c=>c.enabled),doneIds=new Set(d.done.map(v=>v.chore_id));
 const remaining=enabled.filter(c=>!doneIds.has(c.id)),visible=remaining.filter(c=>c.next_target&&(choreScope==='all'||c.next_target===selected));
 const controls=el('div',undefined,'actions');controls.append(btn(choreScope==='all'?'この人の当番に戻る':'みんなの当番を見る',()=>{choreScope=choreScope==='all'?'person':'all';render()},'quiet small'));if(state.admin&&remaining.length)controls.append(btn('ほかのお手伝いを登録',quickChore,'quiet small'));card.append(controls);
 if(!visible.length)card.append(el('p',!enabled.length?'お手伝いはまだ登録されていません。':choreScope==='all'?(remaining.length?'残っている当番はありません。':'今日のお手伝いはすべて完了です。'):'この人の今日の当番はありません。','muted'));
 for(const c of visible){const target=c.next_target||selected,row=el('div',undefined,'daily-chore-row'),info=el('div');info.append(el('strong',c.icon+' '+c.name),el('p',(c.next_target?names.get(c.next_target):'当番なし')+' · '+c.points+' ポイント'+(c.money?' ＋ '+fmt(c.money)+' 円':''),'muted'));row.append(info);if(state.admin&&d.people.some(p=>p.id===target)){const actions=el('div',undefined,'daily-chore-actions'),event=crypto.randomUUID();actions.append(btn((names.get(target)||'この人')+'が完了',async()=>{await api('/chores/complete','POST',{chore_id:c.id,target,event_id:event,revision:c.revision});await load()},'small'),btn('別の人',()=>completeChore(c,d),'quiet small'));row.append(actions)}card.append(row)}
 const completed=enabled.filter(c=>doneIds.has(c.id));if(completed.length){const details=el('details');details.append(el('summary','今日の完了 · '+completed.length+'件'));for(const c of completed){const v=d.done.find(v=>v.chore_id===c.id);details.append(el('p','✓ '+c.icon+' '+c.name+' · '+(names.get(v.target)||'登録した人'),'muted'))}card.append(details)}
}
function quickChore(){
 const d=choreData,done=new Set(d.done.map(v=>v.chore_id)),list=d.chores.filter(c=>c.enabled&&!done.has(c.id));modal('お手伝いを登録');if(!list.length){sheet.append(el('p','今日のお手伝いはすべて完了です。'));return}
 const f=el('form'),task=el('select'),person=el('select'),amount=el('p',undefined,'notice');task.name='chore';person.name='person';for(const c of list){const o=el('option',c.icon+' '+c.name);o.value=c.id;task.append(o)}for(const p of d.people){const o=el('option',p.display_name);o.value=p.id;person.append(o)}person.value=selected;const update=()=>{const c=list.find(c=>c.id===task.value)||list[0];amount.textContent=c.points+' ポイント'+(c.money?' ＋ '+fmt(c.money)+' 円':'')+' を追加します。';};task.onchange=update;update();f.append(el('label','お手伝い'),task,el('label','実際にした人'),person,amount);const submit=el('button','完了して通帳に追加');submit.type='submit';f.append(submit);const event=crypto.randomUUID();f.onsubmit=async e=>{e.preventDefault();submit.disabled=true;try{const c=list.find(c=>c.id===task.value)||list[0];await api('/chores/complete','POST',{chore_id:c.id,target:person.value,event_id:event,revision:c.revision});await load();sheet.close()}catch(e){error(e)}finally{submit.disabled=false}};sheet.append(f);
}
async function choresSettings(){
 const d=choreData||await api('/chores');modal('お手伝いの設定');sheet.append(btn('＋ お手伝いを追加',()=>choreForm(null,d),'quiet'));
 for(const c of d.chores){const row=el('div',undefined,'row'),info=el('div');info.append(el('strong',c.icon+' '+c.name),el('p',c.enabled?'表示中':'非表示','muted'));row.append(info,btn('設定',()=>choreForm(c,d),'quiet small'));sheet.append(row)}
 if(!d.chores.length)sheet.append(el('p','お手伝いはまだ登録されていません。','empty'));
}
function completeChore(c,d){
 modal(c.icon+' '+c.name+' の完了');sheet.append(el('p',c.points+' ポイント'+(c.money?' ＋ '+fmt(c.money)+' 円':'')+' を同時に追加します。1日1回の登録です。','notice'));
 const f=el('form'),label=el('label','実際にお手伝いした人'),select=el('select');select.name='target';for(const p of d.people){const o=el('option',p.display_name);o.value=p.id;select.append(o)}select.value=c.next_target||selected;label.append(select);f.append(label);const submit=el('button','完了して通帳に追加');submit.type='submit';f.append(submit);const event=crypto.randomUUID();f.onsubmit=async e=>{e.preventDefault();submit.disabled=true;try{await api('/chores/complete','POST',{chore_id:c.id,target:select.value,event_id:event,revision:c.revision});await load();sheet.close()}catch(e){error(e)}finally{submit.disabled=false}};sheet.append(f);
}
function choreForm(c,d){
 modal(c?'お手伝いの設定':'お手伝いを追加');const f=el('form');const name=field(f,'name','お手伝いの名前');name.value=c?.name||'';name.maxLength=80;const icon=field(f,'icon','マーク');icon.value=c?.icon||'🧹';icon.maxLength=20;
 const points=field(f,'points','ポイント','number');points.value=c?.points??0;points.min=0;points.max=10000000;points.step=1;const money=field(f,'money','お金（円）','number');money.value=c?.money??0;money.min=0;money.max=10000000;money.step=1;
 const unit=el('select');unit.name='point_unit_id';const seen=new Set();for(const a of state.accounts.filter(a=>a.kind==='points')){if(seen.has(a.unit_id))continue;seen.add(a.unit_id);const o=el('option',a.name);o.value=a.unit_id;unit.append(o)}if(c)unit.value=c.point_unit_id;f.append(el('label','ポイントの種類'),unit);
 let order=c?JSON.parse(c.rotation_json):[];const rotationBox=el('div');f.append(el('label','当番の順番'),el('p','名前を押して順番に追加。誰も選ばなければ当番なしです。','muted'),rotationBox);
 function drawOrder(){rotationBox.replaceChildren();for(const [i,id] of order.entries()){const row=el('div',undefined,'row');row.append(el('span',(i+1)+' · '+(d.people.find(p=>p.id===id)?.display_name||'要確認')));const actions=el('div',undefined,'order-actions');if(i>0)actions.append(btn('↑',()=>{[order[i-1],order[i]]=[order[i],order[i-1]];drawOrder()},'quiet small'));if(i<order.length-1)actions.append(btn('↓',()=>{[order[i+1],order[i]]=[order[i],order[i+1]];drawOrder()},'quiet small'));actions.append(btn('外す',()=>{order=order.filter(v=>v!==id);drawOrder()},'quiet small'));row.append(actions);rotationBox.append(row)}const add=el('div',undefined,'actions');for(const p of d.people.filter(p=>!order.includes(p.id)))add.append(btn('＋ '+p.display_name,()=>{order.push(p.id);drawOrder()},'quiet small'));rotationBox.append(add)}drawOrder();
 const next=el('select');next.name='next_target';next.append(el('option','先頭の人から'));next.firstChild.value='';for(const p of d.people){const o=el('option',p.display_name);o.value=p.id;next.append(o)}next.value=c?.next_target||'';f.append(el('label','次の当番'),next);
 const enabled=el('input');enabled.type='checkbox';enabled.checked=c?Boolean(c.enabled):true;const l=el('label');l.append(enabled,document.createTextNode('このお手伝いを表示する'));if(c)f.append(l);
 const submit=el('button','保存する');submit.type='submit';f.append(submit);f.onsubmit=async e=>{e.preventDefault();submit.disabled=true;try{await api('/chores'+(c?'/'+encodeURIComponent(c.id):''),c?'PUT':'POST',{name:name.value,icon:icon.value,points:Number(points.value),money:Number(money.value),point_unit_id:unit.value,rotation:order,next_target:next.value||order[0]||null,enabled:enabled.checked,revision:c?.revision});await load();await choresSettings()}catch(e){error(e)}finally{submit.disabled=false}};sheet.append(f);
}

// Reuse the original point-app compression and data-URL storage format.
async function compressImageFile(file, maxSide = 900, quality = 0.78) {
  if (!file || !file.type.startsWith('image/')) throw new Error('画像ファイルを選んでください');

  const sourceUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('画像を読み込めませんでした'));
      el.src = sourceUrl;
    });

    let w = img.naturalWidth || img.width;
    let h = img.naturalHeight || img.height;
    if (!w || !h) throw new Error('画像サイズを取得できませんでした');

    const scale = Math.min(1, maxSide / Math.max(w, h));
    const nw = Math.max(1, Math.round(w * scale));
    const nh = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement('canvas');
    canvas.width = nw;
    canvas.height = nh;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, nw, nh);
    ctx.drawImage(img, 0, 0, nw, nh);

    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}


function renderFamilyBalances(){
 const children=state.children.filter(c=>!c.id.startsWith('user:'));
 if(!children.length)return;
 const section=el('section',undefined,'family-balances');section.append(el('h2','みんなの残高'));
 const grid=el('div',undefined,'family-balance-grid');section.append(grid);
 for(const child of children){
  const card=el('section',undefined,'family-balance-card');card.append(el('h3',child.display_name));
  const accounts=state.accounts.filter(a=>a.child_id===child.id);
  if(!accounts.length)card.append(el('p','残高はまだありません','muted'));
  for(const a of accounts){
   const line=el('div',undefined,'family-balance-line');line.append(el('span',a.kind==='money'?(a.code==='wallet'?'おさいふ':'ママ銀行'):a.name),el('strong',fmt(a.balance)+' '+a.symbol));card.append(line);
   if(a.pending)card.append(el('small','確認待ち '+fmt(a.pending)+' '+a.symbol));
  }
  card.append(btn('管理する',()=>{selected=child.id;render()},'quiet small'));grid.append(card);
 }
 root.append(section);
}


function renderCashTools(){
 if(!finance)return;
 const rows=finance.accounts.filter(a=>a.child_id===selected),bank=rows.find(a=>a.code==='cash'),wallet=rows.find(a=>a.code==='wallet');
 if(bank){const box=el('section',undefined,'card');box.append(el('h2','銀行 ＋ おさいふ'),el('p',fmt(bank.balance+(wallet?.balance||0))+' 円','balance'),el('p','銀行 '+fmt(bank.balance)+'円 ／ おさいふ '+fmt(wallet?.balance||0)+'円','muted'));if(!wallet)box.append(el('p','おさいふはまだ未登録です。現金を数えて保護者が登録できます。','muted'));
 const plans=finance.plans.filter(p=>p.account_id===bank.id);for(const p of plans){box.append(el('p','お小遣い：毎月 '+fmt(p.amount)+'円 · 残り '+p.remaining+'回'+(p.next_month?' · 次回 '+p.next_month+'-01':p.remaining?' · 一時停止':' · 終了'),'muted'));}
 const interest=finance.interest.find(p=>p.account_id===bank.id);if(interest)box.append(el('p','利息：年 '+((interest.policy?.rate_bps||0)/100)+'％ · 年間上限 '+fmt(interest.policy?.annual_cap||0)+'円 · '+(interest.policy?.enabled?'ON':'OFF')+'（1円未満は繰り越し）','muted'));root.append(box);}
}
async function financeSettings(){
 if(!state.admin||demo)return;finance=await api('/finance');modal('お金の設定');
 const self=state.accounts.find(a=>a.child_id.startsWith('user:')&&a.code==='cash');
 if(!self)sheet.append(btn('自分の現金通帳を作る（0円）',async()=>{await api('/finance/self-account','POST',{});await load();await financeSettings();},'quiet'));
 const bank=finance.accounts.find(a=>a.child_id===selected&&a.code==='cash');
 if(bank){sheet.append(el('h3',bank.display_name+' のお金'),btn('おさいふの登録・残高調整',()=>walletForm(bank),'quiet'));
 const wallet=finance.accounts.find(a=>a.child_id===selected&&a.code==='wallet');if(wallet)sheet.append(btn('銀行とおさいふを振り替える',()=>transferForm(bank,wallet),'quiet'));
 const plans=finance.plans.filter(p=>p.account_id===bank.id);sheet.append(el('h3','毎月1日のお小遣い'));
 for(const p of plans){const row=el('section',undefined,'card');row.append(el('p',fmt(p.amount)+'円 · '+p.paid_count+' / '+p.total_payments+'回 · '+(p.enabled?'有効':p.remaining?'一時停止':'終了')),el('p',p.next_month?'次回 '+p.next_month+'-01':'次回予定なし','muted'));if(p.remaining>0){const f=el('form'),value=field(f,'allowance-'+p.id,'毎月の金額（円）','number');value.min=1;value.max=10000000;value.value=p.amount;const enabled=el('input');enabled.type='checkbox';enabled.checked=!!p.enabled;const l=el('label');l.append(enabled,document.createTextNode('自動入金を有効にする'));const save=el('button','金額・停止・再開を保存');save.type='submit';f.append(l,save);f.onsubmit=async e=>{e.preventDefault();save.disabled=true;try{await api('/finance/allowance/'+p.id,'PUT',{amount:Number(value.value),enabled:enabled.checked,revision:p.revision});await load();await financeSettings();}catch(e){error(e);save.disabled=false;}};row.append(f);}sheet.append(row);}
 if(!plans.some(p=>p.enabled))sheet.append(btn('新しいお小遣いの設定を作る',()=>allowanceForm(bank),'quiet'));
 sheet.append(btn('利息を設定する',()=>interestForm(bank),'quiet'),el('p','利息は子どもの銀行だけが対象。おさいふとポイントには付きません。設定変更は翌日から。停止中・過去月のまとめ払いは行いません。','muted'));}
 else sheet.append(el('p','お小遣い・利息・おさいふは、管理する人で子どもを選んで設定します。','muted'));
 sheet.append(el('h3','自動処理の確認'),btn('月初当日の未処理分を再試行',async()=>{const r=await api('/finance/retry','POST',{});await load();await financeSettings();sheet.append(el('p',r.skipped||'再試行完了。実行ログを確認してください。'));},'quiet'),btn('未払いのお手伝いを照合',choreAudit,'quiet'));
 const logs=el('details');logs.append(el('summary','実行ログ（最新60件）'));for(const l of finance.logs)logs.append(el('p',l.target_month+' · '+(l.kind==='interest'?'利息':'お小遣い')+' · '+l.status+' · '+l.detail));sheet.append(logs);
}
function financeForm(title,submitLabel,run){modal(title);const f=el('form'),save=el('button',submitLabel);save.type='submit';const event=crypto.randomUUID();f.onsubmit=async e=>{e.preventDefault();save.disabled=true;try{await run(f,event);await load();sheet.close();}catch(e){error(e);save.disabled=false;}};sheet.append(f);return {f,save};}
function walletForm(bank){const wallet=finance.accounts.find(a=>a.child_id===bank.child_id&&a.code==='wallet');const {f,save}=financeForm('おさいふの現金を数えて登録','残高を保存',async(f,event)=>{await api('/finance/wallet','POST',{account_id:bank.id,balance:Number(f.elements.balance.value),event_id:event});});const balance=field(f,'balance','いま手元にある現金（円）','number');balance.min=0;balance.max=10000000;balance.step=1;balance.value=wallet?.balance||0;f.append(el('p','銀行の残高は変わりません。差額は「残高調整」の履歴に残ります。','muted'),save);}
function transferForm(bank,wallet){const {f,save}=financeForm('銀行 ⇄ おさいふ','振り替える',async(f,event)=>{const out=f.elements.direction.value==='out';await api('/finance/transfer','POST',{from_account:out?bank.id:wallet.id,to_account:out?wallet.id:bank.id,amount:Number(f.elements.amount.value),event_id:event});});const direction=el('select');direction.name='direction';direction.add(new Option('銀行 → おさいふ','out'));direction.add(new Option('おさいふ → 銀行','in'));f.append(el('label','振替の向き'),direction);const value=field(f,'amount','金額（円）','number');value.min=1;value.max=10000000;value.step=1;f.append(el('p','両方の合計金額は変わりません。','muted'),save);}
function allowanceForm(bank){const {f,save}=financeForm('毎月のお小遣い','設定する',async()=>{await api('/finance/allowance','POST',{account_id:bank.id,amount:Number(value.value),start_month:start.value,total_payments:Number(count.value)});});const value=field(f,'amount','毎月のお小遣い（円）','number');value.min=1;value.max=10000000;const start=field(f,'start_month','開始年月','month');const d=new Date(Date.now()+9*3600000);d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+1);start.value=d.toISOString().slice(0,7);const count=field(f,'total_payments','入金回数','number');count.value=12;count.min=1;count.max=120;count.step=1;f.append(el('p','毎月1日に入金。12回で終了します。停止した月や過去月をまとめて入金しません。再開は翌月からです。','muted'),save);}
function interestForm(bank){const p=finance.interest.find(a=>a.account_id===bank.id)?.policy;const {f,save}=financeForm('ママ銀行の利息','利息設定を保存',async()=>{await api('/finance/interest','PUT',{account_id:bank.id,rate_bps:Math.round(Number(rate.value)*100),annual_cap:Number(cap.value),enabled:on.checked});});const rate=field(f,'rate','年利（％）','number');rate.value=(p?.rate_bps??300)/100;rate.min=0;rate.max=100;rate.step='0.01';const cap=field(f,'cap','年間の利息上限（円）','number');cap.value=p?.annual_cap??300;cap.min=0;cap.max=10000000;cap.step=1;const on=el('input');on.type='checkbox';on.checked=!!p?.enabled;const l=el('label');l.append(on,document.createTextNode('利息の自動付与をONにする'));f.append(l,el('p','翌日からの日次残高で計算し、翌月1日に付与します。年365日（うるう年366日）で日割り。1円未満は繰り越し、年間上限に達した超過分は翌年へ持ち越しません。','muted'),save);}
async function choreAudit(){modal('未払いのお手伝いを照合');const input=el('input');input.type='date';input.value='2026-10-14';input.setAttribute('aria-label','確認日');const result=el('div');sheet.append(input,btn('完了記録と入金を確認',async()=>{const r=await api('/finance/chore-audit','POST',{day:input.value});result.replaceChildren(el('p',r.note));for(const x of r.recorded){const box=el('section',undefined,'card');box.append(el('p',x.memo+' · 報酬 '+fmt(x.money)+'円 / 入金 '+fmt(x.credited)+'円'));if(x.kind==='complete'&&x.money>0&&x.credited===0)box.append(btn('確認できた未払いを精算',async()=>{if(!confirm(x.memo+' の '+x.money+'円を一度だけ加算しますか？'))return;await api('/finance/chore-repair','POST',{day_id:x.id});await load();await choreAudit();},'quiet'));result.append(box);}for(const x of r.attempts){const box=el('section',undefined,'card');box.append(el('p',x.day+' · 現金 '+fmt(x.money)+'円 / '+fmt(x.points)+'ポイント · '+x.status));if(x.status==='pending')box.append(btn('未払い記録を再処理',async()=>{if(!confirm('記録された現金とポイントを再処理しますか？'))return;await api('/finance/chore-retry','POST',{event_id:x.event_id});await load();await choreAudit();},'quiet'));result.append(box);}},'quiet'),result);}
function renderGifts(){
 if(!giftData)return;
 const c=el('section',undefined,'card gift-card');c.append(el('h2','🎁 ごほうびプレゼント'));
 if(giftData.access.sender)c.append(btn('ごほうびをプレゼント 🎁',giftForm));
 if(giftData.access.guardian)c.append(btn('プレゼント承認待ち · '+fmt(giftData.access.pending)+'件',giftList,'quiet'),btn('申請できる家族の設定',giftPermissions,'quiet small'));
 else c.append(btn(giftData.access.sender?'自分の申請状況を見る':'もらったプレゼントを見る',giftList,'quiet'));
 if(state.gift_only)c.append(el('p','保護者が承認すると、子どもの通帳に反映されます。','muted'));
 if(!giftData.access.sender&&!state.own_child_id&&!giftData.access.guardian)c.append(el('p','申請するには、保護者にHOMEの家族設定で「大人」の区分を確認してもらってください。','muted'));
 c.append(btn('最新の状態を確認',load,'quiet small'));if(!giftData.access.sender&&!giftData.access.guardian)for(const r of giftData.records.filter(r=>r.status==='approved').slice(0,3))c.append(giftRecord(r));root.append(c);
}
function giftRecord(r){
 const c=el('article',undefined,'gift-record');c.append(el('strong','🎁 '+r.sender_name+'から'+fmt(r.amount)+(r.kind==='cash'?'円':'ポイント')),el('p',r.reason),el('p',r.child_name+' · '+({pending:'保護者の承認待ち',approved:'承認済み',rejected:'却下'})[r.status],'muted'),el('small',new Date(r.requested_at*1000).toLocaleString('ja-JP')));
 if(r.resolved_at)c.append(el('small','確認：'+(r.resolver_name||'保護者')+' · '+new Date(r.resolved_at*1000).toLocaleString('ja-JP')));
 if(r.kind==='cash')c.append(el('small','ママ銀行への入金記録です。現金の受け渡し・立替・精算の完了を示すものではありません。おさいふには加算しません。'));
 return c;
}
async function giftList(){
 giftData=await api('/gifts');modal(giftData.access.guardian?'プレゼント申請の確認':giftData.access.sender?'自分のプレゼント申請':'もらったプレゼント');
 if(giftData.access.guardian){sheet.append(el('p','承認待ち '+giftData.access.pending+'件','notice'));const queue=el('section');sheet.append(queue);async function morePending(before){const data=await api('/gifts?status=pending'+(before?'&before='+encodeURIComponent(before):''));for(const r of data.records.filter(r=>r.can_resolve)){const c=giftRecord(r);c.append(btn('確認する',()=>giftDecision(r),'quiet'));queue.append(c);}if(data.next_before){const b=btn('ほかの承認待ちを見る',async()=>{b.remove();await morePending(data.next_before);},'quiet');queue.append(b);}}await morePending();}
 const details=el('details');details.open=!giftData.access.guardian;details.append(el('summary','申請・受け取り履歴'));sheet.append(details);
 function appendRecords(data){for(const r of data.records){const c=giftRecord(r);if(giftData.access.guardian&&r.status==='pending'&&r.can_resolve)c.append(btn('この申請を確認',()=>giftDecision(r),'quiet'));details.append(c);}if(data.next_before){const more=btn('前の履歴を見る',async()=>{const next=await api('/gifts?before='+encodeURIComponent(data.next_before));more.remove();appendRecords(next);},'quiet');details.append(more);}}
 appendRecords(giftData);if(!giftData.records.length)details.append(el('p','まだプレゼントの記録はありません。','muted'));
 if(giftData.notifications?.length)sheet.append(el('p','端末への通知が送信待ちです。通知登録をご確認ください。申請は一覧に保存されています。','muted'),btn('自分への送信待ち通知を再送',async()=>{await api('/gifts/retry','POST',{});await giftList();},'quiet'));
}
function giftDecision(r){modal('プレゼント申請を確認');sheet.append(giftRecord(r));for(const [status,label]of [['approved','承認する'],['rejected','却下する']])sheet.append(btn(label,async()=>{if(!confirm(label+'？'))return;await api('/gifts/'+encodeURIComponent(r.id),'PUT',{status});await load();await giftList();},status==='rejected'?'quiet':''));}
async function giftForm(){
 giftData=await api('/gifts');modal('ごほうびをプレゼント 🎁');sheet.append(el('p','申請者：'+(giftData.viewer?.display_name||'HOMEログイン中の本人'),'notice'));
 if(!giftData.targets.length){sheet.append(el('p','プレゼントできる子どもがいません。保護者に通帳・許可設定をご確認ください。'));return;}
 const f=el('form'),target=el('select'),kind=el('select');target.name='gift_child';kind.name='gift_kind';for(const t of giftData.targets){const o=el('option',t.display_name);o.value=t.id;target.append(o);}f.append(el('label','誰にあげる？'),target,el('label','何をあげる？'),kind);
 function kinds(){const codes=giftData.targets.find(t=>t.id===target.value).codes.split(','),previous=kind.value;kind.replaceChildren();for(const [value,label,code]of [['points','お手伝いポイント','chores'],['cash','現金（ママ銀行へ入金）','cash']])if(codes.includes(code)){const o=el('option',label);o.value=value;kind.append(o);}if(Array.from(kind.options).some(o=>o.value===previous))kind.value=previous;}
 target.onchange=kinds;kinds();
 const amount=field(f,'gift_amount','いくつ・いくら？','number');amount.min=1;amount.max=10000000;amount.step=1;amount.inputMode='numeric';
 const reason=el('textarea');reason.name='gift_reason';reason.required=true;reason.maxLength=500;reason.rows=3;f.append(el('label','どうしてあげる？（子どもにも表示します）'),reason,el('p','申請者はHOMEログイン中の本人です。承認までは残高が変わりません。現金の受け渡し・精算は別に確認してください。','muted'));
 const event=crypto.randomUUID(),submit=el('button','申請する');submit.type='submit';f.append(submit);f.onsubmit=async e=>{e.preventDefault();submit.disabled=true;try{await api('/gifts','POST',{child_id:target.value,kind:kind.value,amount:Number(amount.value),reason:reason.value,event_id:event});await load();await giftList();}catch(e){error(e);}finally{submit.disabled=false;}};sheet.append(f);
}
async function giftPermissions(){
 const d=await api('/gifts/permissions');modal('申請できる家族の設定');sheet.append(el('p','同じ家庭の大人が対象です。許可しても子どもの残高・履歴は公開されず、保護者の承認が必要です。別家庭からの申請はまだ利用できません。','muted'));
 for(const child of d.children){const group=el('section',undefined,'gift-record');group.append(el('h3',child.display_name));for(const sender of d.senders){const label=el('label'),input=el('input');input.type='checkbox';input.checked=d.permissions.find(p=>p.child_id===child.id&&p.sender_id===sender.id)?.enabled!==0;label.append(input,document.createTextNode(sender.display_name));input.onchange=async()=>{input.disabled=true;try{await api('/gifts/permissions','PUT',{child_id:child.id,target_sender_id:sender.id,enabled:input.checked});}catch(e){input.checked=!input.checked;error(e);}finally{input.disabled=false;}};group.append(label);}sheet.append(group);}
}
