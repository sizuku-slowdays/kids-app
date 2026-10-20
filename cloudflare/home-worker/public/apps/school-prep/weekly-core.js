// Pure helpers shared by the Worker and browser. No AI/network calls.
export function mondayOf(day){const d=new Date(day+'T12:00:00Z');if(Number.isNaN(d.getTime()))throw Error('日付を確認してください');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10);}
export function weekDays(monday){return Array.from({length:5},(_,i)=>new Date(Date.parse(monday+'T12:00:00Z')+i*86400000).toISOString().slice(0,10));}
export function templateText(labels){return labels.map(s=>s.replace(/[：:]\s*$/,'')+'：').join('\n');}
export function homeworkLines(text,labels=[]){const names=new Set(labels.map(s=>s.replace(/[：:]\s*$/,'').trim()));return text.split(/\r?\n/).map(s=>s.trim()).filter(s=>s&&!(/^[^：:]+[：:]\s*$/.test(s)&&names.has(s.replace(/[：:]\s*$/,'').trim())));}
export function reconcileTasks(old,homework,action,newId){
 const previous=old.filter(t=>t.kind==='homework'),bags=old.filter(t=>t.kind!=='homework');
 if(action==='append'){
  const existing=new Map();for(const t of previous)existing.set(t.text,(existing.get(t.text)||0)+1);
  const added=[];for(const text of homework){const n=existing.get(text)||0;if(n)existing.set(text,n-1);else added.push({id:newId(),kind:'homework',text});}
  return [...old,...added];
 }
 const pool=previous.slice();return [...homework.map(text=>{const index=pool.findIndex(t=>t.text===text);return index<0?{id:newId(),kind:'homework',text}:pool.splice(index,1)[0];}),...bags];
}
// Explicit weekday/date headings only. Unknown/contradictory dates stay unclassified.
export function parseWeekText(input,monday){
 const dates=weekDays(monday),buckets=Array.from({length:5},()=>[]),unclassified=[],warnings=[];let current=null;
 for(const raw of input.replace(/\r/g,'').split('\n')){
  let line=raw.trim();if(!line)continue;
  line=line.replace(/^\s*(?:#{1,6}\s*|[-*•]\s+)/,'');
  if(/^\|/.test(line)){
   const cells=line.replace(/^\||\|$/g,'').split('|').map(s=>s.trim());
   if(cells.every(s=>/^:?-+:?$/.test(s))||/^(曜日|日付)$/.test(cells[0]))continue;
   line=cells[0]+'：'+cells.slice(1).filter(Boolean).join('\n');
  }
  line=line.replace(/\*\*/g,'');
  line=line.replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?=\s|[：:]|$)/i,word=>({mo:'月曜',tu:'火曜',we:'水曜',th:'木曜',fr:'金曜',sa:'土曜',su:'日曜'})[word.slice(0,2).toLowerCase()]);
  // Common OCR form: 月曜日（19日）, 火曜(10/20), 水曜日（2026/10/21）.
  // Resolve omitted month/year from the selected week, then use the same date check.
  const suffix=line.match(/^([月火水木金土日])(?:曜日|曜)?\s*[（(]\s*(?:(?:(\d{4})[\/\-])?(\d{1,2})[\/\-])?(\d{1,2})日?\s*[）)]\s*[：:]?\s*([\s\S]*)$/);
  if(suffix){
   const target=dates['月火水木金土日'.indexOf(suffix[1])]||dates[0];
   line=`${suffix[2]||target.slice(0,4)}/${suffix[3]||target.slice(5,7)}/${suffix[4]}(${suffix[1]})：${suffix[5]}`;
  }
  const match=line.match(/^(?:(\d{4}[\/\-])?(\d{1,2})[\/\-](\d{1,2})\s*)?(?:[（(]([月火水木金土日])(?:曜日|曜)?[）)]|([月火水木金土日])(?:曜日|曜)(?=\s|[：:]|$)|([月火水木金土日])(?=\s*[：:]|$))\s*[：:]?\s*([\s\S]*)$/);
  // Bare single-character weekday headings are accepted only on their own line.
  const bare=/^[月火水木金土日]$/.test(line)?line:null;
  if(match||bare){
   const letter=bare||match[4]||match[5]||match[6],index='月火水木金土日'.indexOf(letter);current=null;
   let valid=index>=0&&index<5;
   if(valid&&match?.[2]){
    const target=dates[index],year=match[1]?match[1].slice(0,4):target.slice(0,4);
    valid=target===`${year}-${match[2].padStart(2,'0')}-${match[3].padStart(2,'0')}`;
   }
   if(!valid){unclassified.push(raw);warnings.push('対象週以外の日付・土日・日付と曜日の不一致は未分類です');continue;}
   current=index;const rest=bare?'':match[7];if(rest)buckets[index].push(rest);continue;
  }
  // Date-only headings are never guessed, even inside an earlier weekday block.
  if(/^(?:(?:\d{4}[\/\-])?\d{1,2}[\/\-]\d{1,2}|(?:\d{4}年)?\d{1,2}月\d{1,2}日|[月火水木金土日](?:曜日|曜))/.test(line)){current=null;unclassified.push(raw);continue;}
  if(current===null)unclassified.push(raw);else buckets[current].push(line);
 }
 return {days:dates.map((day,i)=>({day,text:buckets[i].join('\n')})),unclassified:unclassified.join('\n'),warnings:[...new Set(warnings)]};
}
