import {period,bookTitle,headings,paginate,dayJST} from './book-core.js';
const $=id=>document.getElementById(id),el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;},fmt=n=>Number(n).toLocaleString('ja-JP');
const directory=new URL('./',location.href),endpoint=new URL('../../api/passbook/book',directory),login=new URL('../../login',directory),initial=new URL(location.href).searchParams;
let household=initial.get('household')||'',selected=initial.get('account')||'',data=null,accounts=[],controller=null,printing=false;
$('month').value=dayJST(new Date().toISOString()).slice(0,7);
function clear(){data=null;$('summary').hidden=true;$('warnings').hidden=true;$('transactions').hidden=true;$('ledger').replaceChildren();$('print-area').replaceChildren();$('print').disabled=true;}
async function api(path,params={},signal){const url=new URL(endpoint);url.pathname+=path;if(household)url.searchParams.set('household',household);for(const[k,v]of Object.entries(params))if(v!==null&&v!==undefined)url.searchParams.set(k,String(v));const r=await fetch(url,{credentials:'same-origin',cache:'no-store',signal});if(r.status===401){location.replace(login.pathname);throw Error('HOMEにログインしてください');}if(!(r.headers.get('Content-Type')||'').includes('application/json'))throw Error('HOMEからひらき直してください');const d=await r.json();if(!r.ok)throw Error(d.error||'通帳を読み込めませんでした');return d;}
async function load(){
 controller?.abort();const current=controller=new AbortController();clear();$('status').textContent='通帳を読み込んでいます…';
 try{
  const range=period($('mode').value,$('month').value,$('from').value,$('to').value),a=await api('/accounts',{},current.signal);accounts=a.accounts;
  const wanted=$('account').value||selected;selected=accounts.some(a=>a.id===wanted)?wanted:accounts[0]?.id;
  $('account').replaceChildren();for(const a of accounts){const o=el('option',a.display_name+' · '+bookTitle(a));o.value=a.id;$('account').append(o);}$('account').value=selected||'';
  if(!selected){$('status').textContent='表示・印刷できる本人の通帳がありません。';return;}
  let page=await api('',{account:selected,...range},current.signal),first=page,records=[...page.records];
  while(page.next_after){$('status').textContent=records.length+'件を読み込みました…';page=await api('',{account:selected,...range,snapshot:first.snapshot_rowid,after:page.next_after},current.signal);if(page.period_count!==first.period_count||page.closing_balance!==first.closing_balance||page.opening_balance!==first.opening_balance)throw Error('履歴の表示時点が変わりました。更新してください');records.push(...page.records);}
  if(records.length!==first.period_count)throw Error('履歴の件数が一致しません。更新してください');
  let balance=first.opening_balance;for(const r of records){balance+=r.delta;if(!Number.isSafeInteger(balance)||balance!==r.balance)throw Error('取引後残高の照合に失敗しました。履歴は変更していません');}if(balance!==first.closing_balance)throw Error('最終残高の照合に失敗しました');
  if(controller!==current)return;data={...first,records};render();$('status').textContent=records.length+'件 · '+dayJST(first.issued_at)+' 時点で読み込み。印刷で残高は変わりません。';$('print').disabled=false;
 }catch(e){if(e.name!=='AbortError'&&controller===current){clear();$('status').textContent=e.message;}}
}
function rangeLabel(){return data.range.from?data.range.from+' 〜 '+data.range.to:'全履歴';}
function warningText(){const w=data.warnings,result=[];if(w.legacy_adjustments)result.push('旧アプリ移行時に保存された残高調整を含みます。元の履歴を作り足さず、その記録を表示しています。');if(w.uncertain_legacy_dates)result.push('旧データに日時未確認の記録があります。保存された日付・順序で表示します。');if(w.negative_balances)result.push('途中残高がマイナスになる記録があります。自動修正はしていません。');return result;}
function rowDate(r){return r.source_app==='legacy-opening'?'移行前':r.day.replaceAll('-','/');}
function table(a,rows,opening,closing,{print=false}={}){
 const t=el('table'),head=el('thead'),hr=el('tr');for(const label of headings(a))hr.append(el('th',label));head.append(hr);t.append(head);const body=el('tbody');
 function carry(text,balance){const r=el('tr',undefined,'carry');r.append(el('td',''),el('th',text),el('td',''),el('td',''),el('td',fmt(balance),'number'));body.append(r);}
 carry('前からの繰越',opening);
 for(const r of rows){const line=el('tr'),final=!print||r.final_fragment;line.append(el('td',rowDate(r),'date'),el('td',(print&&r.continued?'（内容の続き）\n':'')+(print?r.memo_lines.join('\n'):r.memo),'memo'),el('td',final&&r.delta>0?fmt(r.delta):'','number'),el('td',final&&r.delta<0?fmt(-r.delta):'','number'),el('td',final?fmt(r.balance):'','number'));body.append(line);}
 carry('この欄の最終残高',closing);t.append(body);return t;
}
function render(){
 const a=data.account;$('summary').hidden=false;$('summary').replaceChildren(el('p',a.display_name+' の '+bookTitle(a),'owner'),el('strong',fmt(data.closing_balance)+' '+a.symbol),el('p',rangeLabel()+' · 繰越 '+fmt(data.opening_balance)+' '+a.symbol),el('small','期間の最終残高です。現在の通帳残高：'+fmt(data.total_balance)+' '+a.symbol));
 const warnings=warningText();$('warnings').replaceChildren(...warnings.map(t=>el('p',t)));$('warnings').hidden=!warnings.length;
 $('transactions').hidden=false;$('book-title').textContent=bookTitle(a)+' · '+a.symbol;
 const t=table(a,data.records,data.opening_balance,data.closing_balance);$('ledger').replaceChildren(...t.childNodes);
 renderPrint(a,warnings);
}
function renderPrint(a,warnings){
 const area=$('print-area');area.replaceChildren();const bodyPages=paginate(data.records,data.opening_balance),sheetCount=1+Math.ceil(bodyPages.length/2),issued=dayJST(data.issued_at).replaceAll('-','/');
 const cover=el('article',undefined,'paper cover-sheet'),back=el('section',undefined,'half cover-back'),front=el('section',undefined,'half cover-front');
 back.append(el('p','わが家で育てる、ためる力。','bank-mark'),el('h2',bookTitle(a)),el('p',a.code==='cash'?'家族の中で使う、お金の記録です。実際の金融機関の通帳ではありません。':a.code==='wallet'?'手元の現金を記録する帳面です。銀行預金とは別です。':'ポイントの記録です。お金の預金とは別です。'),el('p','片面印刷・A4二つ折り / 差し込み式'),el('p','表紙は印刷面を外に、本文は印刷面を内にして折り、用紙番号順に保管してください。'),el('p',rangeLabel()),el('small','用紙 1 / '+sheetCount));
 front.append(el('p','WAGAYA','bank-mark'),el('h1',bookTitle(a)),el('p',a.code==='cash'?'わたしのお金の通帳':a.code==='wallet'?'手元の現金の帳面':'わたしのポイント帳','subtitle'),el('p',a.display_name+' さま','cover-name'+(Array.from(a.display_name).length>20?' long-name':'')),el('p','発行日 '+issued),el('p',rangeLabel()),el('small','単位：'+a.symbol));cover.append(back,front);area.append(cover);
 for(let i=0;i<bodyPages.length;i+=2){const paper=el('article',undefined,'paper');for(let j=0;j<2;j++){const page=bodyPages[i+j],half=el('section',undefined,'half inside');if(page){const title=el('header');title.append(el('h2',bookTitle(a)),el('p',a.display_name+' さま · 単位 '+a.symbol),el('small',rangeLabel()+' / 発行 '+issued));half.append(title,table(a,page.rows,page.opening,page.closing,{print:true}));const foot=el('footer');foot.append(el('p','本文 '+(i+j+1)+' / '+bodyPages.length+' · 用紙 '+(Math.floor(i/2)+2)+' / '+sheetCount));if(data.warnings.legacy_adjustments)foot.append(el('p','※ 旧アプリ移行時の残高調整を含みます。'));if(data.warnings.uncertain_legacy_dates)foot.append(el('p','※ 旧データに日時未確認の記録があります。'));if(data.warnings.negative_balances)foot.append(el('p','※ 途中残高がマイナスになる記録があります。'));if(i+j+1<bodyPages.length)foot.append(el('small','次の本文へ続きます'));half.append(foot);}else half.append(el('p','記録はここまでです。','end-note'));paper.append(half);}area.append(paper);}
}
$('filters').onsubmit=e=>{e.preventDefault();load();};$('account').onchange=()=>{selected=$('account').value;load();};$('mode').onchange=()=>{controller?.abort();controller=null;const mode=$('mode').value;$('month-field').hidden=mode!=='month';$('range-fields').hidden=mode!=='range';clear();$('status').textContent='期間を選んで「通帳を表示・更新」を押してください。';};
for(const id of ['month','from','to'])$(id).oninput=()=>{controller?.abort();controller=null;clear();$('status').textContent='期間を変更しました。「通帳を表示・更新」を押してください。';};
$('print').onclick=async()=>{if(!data)return;$('print').disabled=true;try{const current=await api('/accounts');if(!current.accounts.some(a=>a.id===data.account.id)){clear();throw Error('この通帳の権限が変わりました。HOMEから確認してください');}printing=true;window.print();}catch(e){$('status').textContent=e.message;}finally{printing=false;$('print').disabled=!data;}};
addEventListener('pageshow',e=>{if(e.persisted)load();});document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!printing)load();});load();
