export const categories=['大人','シニア（65歳以上）','中学生・高校生','小学生','幼児（小学生未満）'];
export const yen=n=>new Intl.NumberFormat('ja-JP').format(n)+'円';
export function calculate(courses,counts){if(counts.length!==5||!counts.every(n=>Number.isSafeInteger(n)&&n>=0&&n<=1000000))throw Error('人数は0以上の整数で入力してください');const rows=courses.map(c=>({...c,total:c.prices.reduce((sum,p,i)=>sum+p*counts[i],0)}));if(rows.some(c=>!Number.isSafeInteger(c.total)))throw Error('人数・料金を確認してください');const min=rows.length?Math.min(...rows.map(c=>c.total)):0;return {people:counts.reduce((a,b)=>a+b,0),minimum:min,courses:rows.map(c=>({...c,difference:c.total-min}))};}


export const orderKey=(product,variant)=>product.id+':'+variant.id;
export function calculateOrder(products,quantities){
 const lines=[];for(const p of products)if(!p.hidden)for(const v of p.variants){const key=orderKey(p,v),qty=quantities[key]||0;if(!Number.isSafeInteger(qty)||qty<0||qty>1000000||!Number.isSafeInteger(v.price)||v.price<0)throw Error('個数・料金を確認してください');if(qty)lines.push({key,product:p,variant:v,quantity:qty,subtotal:qty*v.price});}
 const total=lines.reduce((s,l)=>s+l.subtotal,0);if(!Number.isSafeInteger(total))throw Error('個数が大きすぎます');return {lines,total,quantity:lines.reduce((s,l)=>s+l.quantity,0)};
}
