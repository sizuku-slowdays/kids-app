// Shared pure parsing and matching. Files remain in the browser.
export function parseCsv(text){
 const rows=[];let row=[],cell='',quoted=false;
 text=text.replace(/^\uFEFF/,'');
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(quoted||!cell)quoted=!quoted;else throw Error('CSVの引用符を確認してください');}
  else if(!quoted&&c===','){row.push(cell);cell='';}
  else if(!quoted&&(c==='\n'||c==='\r')){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell='';}
  else cell+=c;
 }
 if(quoted)throw Error('CSVの引用符が閉じていません');
 row.push(cell);if(row.some(v=>v.trim()))rows.push(row);return rows;
}
export const merchantKey=value=>String(value||'').normalize('NFKC').replace(/\s+/g,'').toUpperCase();
const headerKey=value=>merchantKey(value).replace(/[・･]/g,'');
const aliases={date:['利用日','ご利用日'],merchant:['利用店名商品名','利用店舗名商品名','ご利用店名','利用店名'],amount:['利用金額','ご利用金額'],method:['支払方法','お支払方法'],fee:['分割手数料','手数料','手数料/利息'],paymentMonth:['支払月']};
export function decodeCardCsv(buffer){
 try{return {text:new TextDecoder('utf-8',{fatal:true}).decode(buffer),encoding:'UTF-8'};}
 catch{return {text:new TextDecoder('shift_jis',{fatal:true}).decode(buffer),encoding:'Shift_JIS'};}
}
export function parseRakutenCsv(text){
 const table=parseCsv(text);let header=-1,columns={};
 for(let i=0;i<table.length;i++){
  const normalized=table[i].map(headerKey),found={};
  for(const [key,names]of Object.entries(aliases))found[key]=normalized.findIndex(v=>names.includes(v));
  if(found.date>=0&&found.merchant>=0&&found.amount>=0){header=i;columns=found;break;}
 }
 if(header<0)throw Error('利用日・利用店名／商品名・利用金額の列が見つかりません。CSVの形式を確認してください');
 const counts=new Map(),rows=[];
 for(let i=header+1;i<table.length;i++){
  const cells=table[i],rawDate=cells[columns.date]?.trim()||'',merchant=cells[columns.merchant]?.trim()||'';
  let error='',date='',signedAmount=0;
  const m=rawDate.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
  if(m){date=m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0');if(!Number.isFinite(Date.parse(date))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)error='利用日が不正です';}
  else error='利用日を読み取れません。合計行・続きの行・対象外の行も確認してください';
  const money=(cells[columns.amount]||'').normalize('NFKC').replace(/[,￥¥円\s]/g,'').replace(/^[△▲]/,'-');
  if(!/^-?\d+$/.test(money)||!Number.isSafeInteger(Number(money))||Number(money)===0)error='利用金額を確認してください';else signedAmount=Number(money);
  if(!merchant)error='利用店名がありません';
  const method=columns.method>=0?cells[columns.method]||'':'';
  const fee=columns.fee>=0?(cells[columns.fee]||'').normalize('NFKC').replace(/[,￥¥円\s]/g,''):'';
  if(fee&&fee!=='0'&&fee!=='-')error='手数料を含む明細です。利用金額と手数料を個別に確認してください';
  if(/取消|キャンセル|返金/.test(method)&&signedAmount>0)error='返金の符号を確認してください。正の金額を自動で返金には変えません';
  const paymentMonth=columns.paymentMonth>=0?(cells[columns.paymentMonth]||'').normalize('NFKC').trim():'';
  const pm=paymentMonth.match(/^(\d{1,2})月(以降)?$/),billingMonthNumber=pm?Number(pm[1]):null,billingDeferred=!!pm?.[2];
  if(columns.paymentMonth>=0&&(!billingMonthNumber||billingMonthNumber>12))error='支払月を読み取れません。明細を確認してください';
  const canonical=JSON.stringify([date,merchantKey(merchant),signedAmount,merchantKey(method)]),occurrence=(counts.get(canonical)||0)+1;counts.set(canonical,occurrence);
  rows.push({rowNumber:i+1,date,merchant,signedAmount,method,paymentMonth,billingMonthNumber,billingDeferred,canonical,occurrence,error});
 }
 if(!rows.length)throw Error('取り込める行がありません');if(rows.length>2000)throw Error('一度に確認する明細は2000行までです');
 return rows.map(r=>({...r,identicalCount:counts.get(r.canonical)}));
}
export async function fingerprint(card,row){
 const bytes=new TextEncoder().encode(JSON.stringify([card,row.canonical,row.occurrence]));
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
}
export function csvCandidates(state,card,row){
 const type=row.signedAmount<0?'refund':'expense',amount=Math.abs(row.signedAmount);
 return state.entries.filter(e=>!e.void&&e.payment===card&&e.type===type&&e.date===row.date&&e.amount===amount);
}
export function suggestCategory(state,merchant){
 const key=merchantKey(merchant),saved=state.merchantCategories?.[key];
 if(saved?.disabled)return {category:'',source:'自動提案を停止中'};
 const rule=typeof saved==='string'?{category:saved}:saved;
 const prior=state.entries.filter(e=>!e.void&&merchantKey(e.merchant||e.memo)===key&&e.splits.length===1).sort((a,b)=>b.date.localeCompare(a.date));
 const valid=part=>part&&Object.hasOwn(state.categories.tree,part.category);
 const mixed=/AMAZON|アマゾン|楽天市場/.test(key);
 if(valid(rule))return {...rule,source:'保存した店名の分類',review:mixed||!!state.classificationVersion,ambiguous:mixed};
 const known=prior.map(e=>e.splits[0]).filter(valid);
 if(known.length){
  const paths=new Set(known.map(p=>JSON.stringify([p.category,p.middle||'',p.person||''])));
  const candidates=Array.from(new Map(known.map(p=>[JSON.stringify([p.category,p.middle||'',p.person||'']),p])).values()).slice(0,8);
  const {category,middle,person}=known[0];
  return {...(state.classificationVersion?{category,middle,person:paths.size===1?person:'',candidates}:{category}),source:'以前の分類',review:mixed||paths.size>1||!!state.classificationVersion,ambiguous:mixed||paths.size>1};
 }
 const rules=[[/ENEOS|エネオス|出光/,state.classificationVersion?'車・交通':'交通・ガソリン'],[/APPLE|アップル|UQ|KDDI|ドコモ/,'通信・サブスク'],[/ベネッセ|進研ゼミ/,state.classificationVersion?'教育':'子ども']];
 const match=rules.find(([re,category])=>re.test(key)&&Object.hasOwn(state.categories.tree,category));
 return match?{category:match[1],source:'店名から推測',review:!!state.classificationVersion}:{category:'',source:'分類が必要'};
}
