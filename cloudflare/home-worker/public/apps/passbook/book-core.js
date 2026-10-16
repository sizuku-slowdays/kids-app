export const dayJST=iso=>new Date(iso).toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'});
export function period(mode,month,from,to){
 if(mode==='all')return {from:null,to:null};
 const valid=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
 if(mode==='month'){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('年月を選んでください');
  const [y,m]=month.split('-').map(Number),last=new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);return {from:month+'-01',to:last};
 }
 if(mode!=='range'||!valid(from)||!valid(to)||from>to)throw Error('開始日と終了日を確認してください');return {from,to};
}
export function bookTitle(a){return a.code==='cash'?'ママ銀行':a.code==='wallet'?'おさいふ帳':a.unit_name+'帳';}
export function headings(a){return a.kind==='points'?['取引日','お取引内容','獲得','使用','残高']:a.code==='wallet'?['取引日','お取引内容','入ったお金','使ったお金','残高']:['取引日','お取引内容','お預り','お支払い','残高'];}
// Conservative half-width em estimate keeps long names/reasons intact on A5 panels.
export function splitMemo(text,width=12){
 const result=[];for(const paragraph of String(text).split('\n')){let line='',length=0;for(const c of paragraph){const size=/[\x20-\x7e]/.test(c)?0.58:1;if(length+size>width&&line){result.push(line);line='';length=0;}line+=c;length+=size;}result.push(line);}return result;
}
export function paginate(records,opening,{capacity=26,maxLines=5}={}){
 const pages=[];let page={opening,closing:opening,rows:[]},used=0;
 function flush(){pages.push(page);page={opening:page.closing,closing:page.closing,rows:[]};used=0;}
 for(const record of records){const lines=splitMemo(record.source_app==='gift'?String(record.memo||'').replace(/^\s*🎁\s*/, ''):record.memo||'');for(let offset=0;offset<lines.length;offset+=maxLines){const chunk=lines.slice(offset,offset+maxLines),last=offset+maxLines>=lines.length,cost=chunk.length+0.8+(offset>0?1:0)+(Math.abs(record.balance)>=100000000000?1:0);
  if(used+cost>capacity&&page.rows.length)flush();
  page.rows.push({...record,memo_lines:chunk,continued:offset>0,final_fragment:last});used+=cost;if(last)page.closing=record.balance;
 }}
 if(page.rows.length||!pages.length)flush();return pages;
}
