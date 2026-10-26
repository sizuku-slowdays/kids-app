import {drawQR} from './qr.js';
const $=id=>document.getElementById(id),app=$('app');
let me,selected='',talk='',timer,loading=false,readSeq=0;
let invitation=new URLSearchParams(location.hash.slice(1)).get('invite')||'';
if(invitation)history.replaceState(null,'',location.pathname);
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
function field(parent,label,node){const l=el('label',label);l.append(node);parent.append(l);return node;}
function input(parent,label,type='text'){const n=el('input');n.type=type;field(parent,label,n);return n;}
function card(title,parent=app){const n=el('section',undefined,'card');if(title)n.append(el('h2',title));parent.append(n);return n;}
function btn(text,fn,cls=''){const b=el('button',text,cls);b.type='button';b.onclick=async()=>{if(b.disabled)return;b.disabled=true;$('status').textContent='';try{await fn();}catch(e){$('status').textContent=e.message;}finally{if(b.isConnected)b.disabled=false;}};return b;}
async function api(path,method='GET',data){const response=await fetch('/api/'+path,{method,credentials:'same-origin',cache:'no-store',headers:method==='GET'?{}:{'Content-Type':'application/json','X-Oshaberi':'1'},body:data===undefined?undefined:JSON.stringify(data)});let value;try{value=await response.json();}catch{throw Error('通信できませんでした。ひらき直してください');}if(!response.ok)throw Error(value.error||'もう一度ためしてください');return value;}
function consent(parent){const check=input(parent,'保護者です。子どものトークを双方の保護者が閲覧できること、写真は相手が保存できること、データの扱いを読み、同意します。','checkbox');const a=el('a','同意とプライバシーの説明を読む');a.href='/privacy.html';a.target='_blank';a.rel='noopener';parent.append(a);return check;}
function credentials(parent,create=false){const name=create?input(parent,'呼び名（本名でなくて大丈夫）'):null,login=input(parent,'ログインID'),password=input(parent,'パスワード（12文字以上）','password');login.autocomplete='username';password.autocomplete=create?'new-password':'current-password';return {name,login,password};}
function data(c){return {login:c.login.value,password:c.password.value,...(c.name?{alias:c.name.value}:{})};}
function showRecovery(code){const c=card('復旧コードを保管してください');c.append(el('p','パスワードを忘れたときに使います。この画面で一度だけ表示します。子どもや相手の家庭には渡さず、安全な場所へ保管してください。'),el('pre',code));}
async function start(){clearInterval(timer);try{me=await api('me');selected=me.role==='child'?me.id:(selected||me.children[0]?.id||'');await dashboard();}catch{loginScreen();}}
async function loginScreen(){app.replaceChildren();$('identity').replaceChildren();const info=await api('info');const hero=card('すきなときに、おしゃべり。');hero.classList.add('hero');hero.append(el('p','おうちの人が、ふたりを友だちにしたらスタート。通知はこないよ。'),el('p','おうちの人も、ふたりのおはなしを見られます。','notice'));const c=card('ログイン');const creds=credentials(c),device=input(c,'この端末の呼び名');device.value='この端末';c.append(btn('ログイン',async()=>{await api('login','POST',{...data(creds),device:device.value});await start();},'primary'));
 const d=el('details');d.append(el('summary','はじめての保護者の方'));c.append(d);const reg=credentials(d,true),code=input(d,invitation?'招待を読み込みました（登録用コードは不要）':'登録用コード','password'),agree=consent(d);d.append(btn('保護者アカウントを作る',async()=>{const result=await api('register','POST',{...data(reg),setup_code:code.value,invite:invitation,agree:agree.checked,consent_version:info.consent_version});showRecovery(result.recovery_code);$('status').textContent='登録しました。復旧コードを保管して、上のログインから入ってください。';},'primary'));
 const recovery=el('details');recovery.append(el('summary','パスワードを忘れた保護者の方'));c.append(recovery);const rc=credentials(recovery),key=input(recovery,'復旧コード','password');rc.password.autocomplete='new-password';recovery.append(btn('新しいパスワードで復旧',async()=>{const result=await api('recover','POST',{...data(rc),recovery_code:key.value});showRecovery(result.recovery_code);}));
}
async function dashboard(){clearInterval(timer);talk='';app.replaceChildren();$('identity').replaceChildren(el('span',me.alias),btn('ログアウト',async()=>{await api('logout','POST',{});me=null;loginScreen();}));
 if(me.role==='guardian')await parentView();else await childView();
}
async function childView(){
 const intro=card('こんにちは、'+me.alias+'！');intro.append(el('p','おうちの人も、ふたりのおはなしを見られるよ。','notice'));
 if(!me.available){intro.append(el('p','いまは、おやすみの時間。おうちの人が決めた時間に、またひらいてね。'));return;}
 const friends=card('ともだち');await renderFriends(friends);timer=setInterval(async()=>{if(document.hidden||talk)return;try{const content=el('div');await renderFriends(content);friends.replaceChildren(el('h2','ともだち'),content);}catch(e){clearInterval(timer);friends.replaceChildren(el('p',e.message));}},10000);const media=card('じぶんのスタンプ');await mediaList(media,false);uploadForm(media,'stamp');
}
async function renderFriends(parent){const {friends}=await api('friends'+(me.role==='guardian'?'?child='+selected:''));const list=el('div',undefined,'friends');parent.append(list);if(!friends.length)list.append(el('p','まだトークはありません。おうちの人に友だち登録をしてもらおう。','muted'));
 for(const f of friends){const box=el('div',undefined,'card');box.append(el('h3',f.peer_alias),el('span',({pending:'双方のおうちの人の承認待ち',active:'おしゃべりできます',ended:'友だち登録を解除しました',blocked:'ブロック中'})[f.state],'badge'));
 if(f.unread)box.append(el('p',`新しいおはなし ${f.unread} 件`));
 if(f.state==='active')box.append(btn(me.role==='guardian'?'トークを見守る':'おはなしする',()=>openTalk(f), 'primary'));
 if(me.role==='guardian'){
  if(f.state==='pending')box.append(btn('この友だち登録を承認',async()=>{await api('friends/'+f.id+'/approve','POST',{});await dashboard();}));
  if(['pending','active'].includes(f.state))box.append(btn('友だち登録を解除',async()=>{if(confirm('このトークは双方とも開けなくなります。解除しますか？')){await api('friends/'+f.id+'/end','POST',{});await dashboard();}},'danger'),btn('ブロック',async()=>{if(confirm('この相手をブロックしますか？')){await api('friends/'+f.id+'/block','POST',{});await dashboard();}},'danger'));
  if(f.state==='blocked')box.append(btn('自分側のブロックを解除',async()=>{await api('friends/'+f.id+'/unblock','POST',{});$('status').textContent='解除しました。トーク再開には新しい招待と双方の承認が必要です。';}));
 }list.append(box);}
}
async function parentView(){
 const top=card('おうちの人の見守り');top.append(el('p','子どもの発言と相手の発言を見られます。ここで見ても、子どもの「既読」は変わりません。','notice'));
 if(me.children.length){const sel=el('select');for(const c of me.children){const o=el('option',c.alias);o.value=c.id;sel.append(o);}sel.value=selected;sel.setAttribute('aria-label','管理する子ども');sel.onchange=()=>{selected=sel.value;dashboard().catch(showError);};top.append(sel);}
 const add=el('details');add.append(el('summary','子どものアカウントを作る'));top.append(add);const creds=credentials(add,true),agree=consent(add);add.append(el('small','親子で別のログインIDとパスワードを使います。初期状態では利用時間が未設定、写真送信はOFFです。'));
 add.append(btn('この子を登録',async()=>{await api('children','POST',{...data(creds),agree:agree.checked,consent_version:me.consent_version});await start();},'primary'));
 if(selected){
  const friends=card('友だちとトーク');await renderFriends(friends);
  const inv=card('友だちを招待');inv.append(el('p','相手の保護者へURLかQRコードを渡してください。1回・3日間のみ有効。参加後、双方が相手の子を確認して承認します。'));
  inv.append(btn('招待URLとQRコードを作る',async()=>{const r=await api('invitations','POST',{child_id:selected});const box=el('div'),url=el('input');url.value=r.url;url.readOnly=true;url.setAttribute('aria-label','招待URL');box.append(url);const canvas=el('canvas');await drawQR(canvas,r.url);box.append(canvas,btn('URLをコピー',async()=>{await navigator.clipboard.writeText(r.url);}));inv.append(box);}));
  if(invitation)inv.append(btn('受け取った招待に、この子で参加',async()=>{await api('invitations/accept','POST',{child_id:selected,token:invitation});invitation='';await dashboard();$('status').textContent='友だち申請を作りました。双方のおうちの人が、相手の子を確認して承認してください。';},'primary'));
  const {invitations}=await api('invitations');for(const i of invitations.filter(i=>i.child_id===selected&&!i.revoked&&!i.used&&i.expires_at>Date.now()))inv.append(btn('未使用の招待を取り消す（'+new Date(i.created_at).toLocaleDateString('ja-JP')+'）',async()=>{await api('invitations/'+i.id,'DELETE',{});await dashboard();}));
  const media=card('写真・スタンプの承認');media.append(el('p','顔・住所・学校名・裸や下着姿が写っていないか確認してください。相手や相手の保護者が保存することがあります。'));await mediaList(media,true);
  settingsForm(card('利用時間と写真送信'));await sessionsView(card('子どもの端末'),true);
  const reset=el('details');reset.append(el('summary','子どものパスワードを変更'));const sec=card('アカウント管理');sec.append(reset);const pw=input(reset,'新しい子どものパスワード','password');reset.append(btn('変更して全端末をログアウト',async()=>{await api('children/'+selected+'/password','POST',{password:pw.value});$('status').textContent='変更しました。子どもの端末は新しいパスワードでログインしてください。';}));
  const erase=el('details');erase.append(el('summary','この子のデータを削除'));sec.append(erase);const ep=input(erase,'保護者のパスワード','password');erase.append(el('p','この子のアカウントを停止し、この子が送った本文・画像を削除対象にします。相手が保存済みの画像までは消せません。元に戻せません。'),btn('この子を削除',async()=>{if(confirm('子どものアカウントと送信内容を削除しますか？')){await api('children/'+selected+'/delete','POST',{password:ep.value,confirm:true});selected='';await start();}},'danger'));
 }
 await sessionsView(card('自分の端末'),false);
 const account=card('保護者アカウント');const del=el('details');del.append(el('summary','退会と管理する子どもの削除'));account.append(del);del.append(el('p','管理する子どもも停止・削除対象になります。相手の家庭のアカウントは削除しません。'));const pw=input(del,'自分のパスワード','password');del.append(btn('退会する',async()=>{if(confirm('管理する子どもを含めて退会しますか？')){await api('account/delete','POST',{password:pw.value,confirm:true});await start();}},'danger'));
}
function settingsForm(parent){const child=me.children.find(c=>c.id===selected),paused=input(parent,'メッセージを一時停止する','checkbox'),photos=input(parent,'毎回承認の写真送信を許可する','checkbox');paused.checked=!!child.paused;photos.checked=!!child.photos_enabled;
 const tz=input(parent,'タイムゾーン');tz.value=child.timezone;parent.append(el('small','利用時間外は、子どもの送信とトーク閲覧ができません。保護者はいつでも管理できます。未設定の曜日はお休みです。初期画面は1日1つの時間帯を編集します。'));
 const schedule=JSON.parse(child.schedule_json),rows=[];
 for(const [d,label] of ['日','月','火','水','木','金','土'].entries()){
  const row=el('div',undefined,'time-row'),from=el('input'),to=el('input');from.type=to.type='time';from.setAttribute('aria-label',label+'曜日の開始');to.setAttribute('aria-label',label+'曜日の終了');
  if(schedule[d]?.[0]){const fmt=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');from.value=fmt(schedule[d][0][0]);to.value=schedule[d][0][1]===1440?'23:59':fmt(schedule[d][0][1]);}
  row.append(el('span',label+'曜'),from,to);parent.append(row);rows.push([from,to]);
 }
 parent.append(btn('この子の設定を保存',async()=>{const schedule=rows.map(([from,to])=>{if(!from.value&&!to.value)return [];if(!from.value||!to.value)throw Error('開始と終了の両方を選んでください');const minute=s=>s.split(':').reduce((a,n,i)=>a+Number(n)*(i?1:60),0);return [[minute(from.value),minute(to.value)]];});await api('children/'+selected+'/settings','PUT',{paused:paused.checked,photos_enabled:photos.checked,timezone:tz.value,schedule,revision:child.revision});await start();},'primary'));
}
async function sessionsView(parent,childMode){const path=childMode?'children/'+selected+'/sessions':'sessions',data=await api(path);for(const s of data.sessions.filter(s=>!s.revoked&&s.expires_at>Date.now())){const row=el('div',undefined,'row');row.append(el('span',s.device),el('small',new Date(s.created_at).toLocaleString('ja-JP')),btn('この端末をログアウト',async()=>{await api(path,'DELETE',{session_id:s.id});await start();}));parent.append(row);}}
async function mediaList(parent,guardian){const {media}=await api('media'+(guardian?'?child='+selected:''));for(const m of media){const row=el('div',undefined,'divider');row.append(el('p',(m.kind==='stamp'?'スタンプ：':'写真：')+m.label+' / '+({pending:'承認待ち',approved:'使用できます',rejected:'却下',disabled:'無効'})[m.status]));if(['pending','approved'].includes(m.status)){const img=el('img',undefined,'media-preview');img.src='/media/'+m.id+(guardian?'?child='+selected:'');img.alt=m.label;row.append(img);}if(guardian){if(m.status==='pending')row.append(btn('承認して'+(m.kind==='photo'?'相手に送る':'スタンプを使えるようにする'),async()=>{await api('media/'+m.id+'/approve','POST',{});await dashboard();},'primary'),btn('却下',async()=>{await api('media/'+m.id+'/reject','POST',{});await dashboard();}));if(m.status==='approved')row.append(btn('画像を無効にする',async()=>{await api('media/'+m.id+'/disable','POST',{});await dashboard();},'danger'));}parent.append(row);}}
function uploadForm(parent,kind,friendship){const details=el('details');details.append(el('summary',kind==='stamp'?'オリジナルスタンプを登録':'写真をおうちの人に確認してもらう'));parent.append(details);
 details.append(el('p','顔・じゅうしょ・学校の名前・はだかや下着の写真は送らないでね。おうちの人が見てから、相手にとどくよ。相手が写真をほぞんすることもあるよ。','warning'));
 const file=input(details,'写真ライブラリからえらぶ','file');file.accept='image/jpeg,image/png';const name=input(details,'画像の呼び名');name.value=kind==='stamp'?'わたしのスタンプ':'写真';const ack=input(details,'送ってよい写真か、かくにんしたよ','checkbox');
 details.append(btn('確認をおねがいする',async()=>{if(!file.files[0]||!ack.checked)throw Error('写真と、かくにんのチェックをえらんでね');const f=file.files[0];if(f.size>15*1024*1024)throw Error('写真が大きすぎます');const image=new Image(),url=URL.createObjectURL(f);let blob;try{image.src=url;await image.decode();const max=kind==='stamp'?512:1200,scale=Math.min(1,max/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);blob=await new Promise(r=>canvas.toBlob(r,'image/jpeg',.8));}catch{throw Error('JPEGかPNGの写真をえらび直してください');}finally{URL.revokeObjectURL(url);}const params=new URLSearchParams({kind,label:name.value});if(friendship)params.set('talk',friendship);const response=await fetch('/api/media?'+params,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'image/jpeg','X-Oshaberi':'1'},body:blob});const r=await response.json();if(!response.ok)throw Error(r.error);$('status').textContent='おうちの人の確認待ちです。まだ相手にはとどいていません。';file.value='';ack.checked=false;},'primary'));
}
function showError(e){$('status').textContent=e.message;}
async function openTalk(f){clearInterval(timer);talk=f.id;readSeq=0;app.replaceChildren();const c=card(f.peer_alias+'とのおはなし');c.append(btn('一覧にもどる',()=>start()),el('p',me.role==='guardian'?'見守り中です。既読は変わりません。':'おうちの人も、このおはなしを見られるよ。','notice'));
 const history=el('div',undefined,'bubbles');history.setAttribute('aria-label','トーク履歴');const older=btn('前のおはなしを読む',async()=>{const seq=Number(history.firstElementChild?.dataset.seq||0);if(seq)await refresh(false,seq);});c.append(older,history);let maxSeq=0;
 const pending=new Map();async function send(payload){const key=JSON.stringify(payload);if(!pending.has(key))pending.set(key,crypto.randomUUID());const result=await api('talks/'+f.id+'/messages','POST',{...payload,nonce:pending.get(key)});pending.delete(key);return result;}
 const child=me.role==='child'?me.id:selected,query=()=>me.role==='guardian'?'?child='+selected:'?';
 async function markVisible(){if(me.role!=='child'||document.hidden)return;const bounds=history.getBoundingClientRect();if(bounds.top>=innerHeight||bounds.bottom<=0)return;let last=readSeq;for(const n of history.children){const r=n.getBoundingClientRect();if(r.top<Math.min(bounds.bottom,innerHeight)&&r.bottom>Math.max(bounds.top,0))last=Math.max(last,Number(n.dataset.seq));}if(last>readSeq){await api('talks/'+f.id+'/read','POST',{seq:last});readSeq=last;}}
 async function refresh(initial=false,before){if(loading||talk!==f.id||document.hidden)return;loading=true;try{const r=await api('talks/'+f.id+'/messages'+query()+(before?'&before='+before:!initial&&maxSeq?'&after='+maxSeq:''));if(talk!==f.id)return;const nearBottom=history.scrollHeight-history.scrollTop-history.clientHeight<80,fragment=document.createDocumentFragment();for(const m of r.messages){maxSeq=Math.max(maxSeq,m.seq);if(history.querySelector('[data-seq="'+m.seq+'"]'))continue;const bubble=el('div',undefined,'message'+(m.author_id===child?' mine':''));bubble.dataset.seq=String(m.seq);bubble.dataset.author=m.author_id;bubble.dataset.time=String(m.created_at);if(m.kind==='text')bubble.append(el('span',m.text));else if(m.kind==='standard')bubble.append(el('span',me.stamps[m.text]||'スタンプ'));else if(['photo','stamp'].includes(m.kind)&&m.media_status==='approved'){const img=el('img');img.alt=m.kind==='photo'?'承認された写真':'承認されたスタンプ';img.src='/media/'+m.media_id+(me.role==='guardian'?'?child='+child:'');bubble.append(img);}else bubble.append(el('span','画像・メッセージは削除されました'));bubble.append(el('small',new Date(m.created_at).toLocaleString('ja-JP')+(m.author_id===child&&r.peer_read_seq>=m.seq?' ・きどく':'')));fragment.append(bubble);}if(before){const oldHeight=history.scrollHeight;history.prepend(fragment);history.scrollTop+=history.scrollHeight-oldHeight;}else{history.append(fragment);if(initial||nearBottom)history.scrollTop=history.scrollHeight;}for(const n of history.children)if(n.dataset.author===child)n.querySelector('small').textContent=new Date(Number(n.dataset.time)).toLocaleString('ja-JP')+(r.peer_read_seq>=Number(n.dataset.seq)?' ・きどく':'');older.disabled=r.messages.length<60&&(!maxSeq||!!before||initial);await markVisible();}catch(e){clearInterval(timer);history.replaceChildren(el('p','トークを表示できません。利用時間や友だちの状態を確認してください。'));showError(e);}finally{loading=false;}}
 history.addEventListener('scroll',()=>markVisible().catch(showError));
 if(me.role==='child'){
  const compose=el('div',undefined,'composer'),text=el('textarea');text.maxLength=2000;text.setAttribute('aria-label','メッセージ');compose.append(text,btn('おくる',async()=>{const value=text.value;await send({kind:'text',text:value});text.value='';await refresh();},'primary'));c.append(compose);
  const stamps=el('div',undefined,'stamps');for(const [key,label] of Object.entries(me.stamps))stamps.append(btn(label,async()=>{await send({kind:'standard',stamp:key});await refresh();}));c.append(stamps);
  const {media}=await api('media');for(const m of media.filter(m=>m.kind==='stamp'&&m.status==='approved')){const b=btn(m.label,async()=>{await send({kind:'stamp',media_id:m.id});await refresh();});const img=el('img');img.src='/media/'+m.id;img.alt='';b.prepend(img);stamps.append(b);}
  if(me.settings.photos_enabled)uploadForm(c,'photo',f.id);
 }
 await refresh(true);timer=setInterval(()=>refresh(),10000);
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(talk)start().catch(showError);else start().catch(showError);}});
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
start().catch(showError);
