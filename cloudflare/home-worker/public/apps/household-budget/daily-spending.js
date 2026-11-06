export function dailySpending(entries,date){
 const result={date,spent:0,count:0,refund:0};
 for(const entry of entries){
  if(entry.void||entry.date!==date)continue;
  if(entry.type==='expense'||entry.type==='advance'){
   result.spent+=entry.amount;
   result.count++;
  }else if(entry.type==='refund'){
   result.refund+=entry.amount;
  }
 }
 return result;
}
