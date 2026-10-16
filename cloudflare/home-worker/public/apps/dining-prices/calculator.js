export const categories=['大人','シニア（65歳以上）','中学生・高校生','小学生','幼児（小学生未満）'];
export const yen=n=>new Intl.NumberFormat('ja-JP').format(n)+'円';
export function calculate(courses,counts){if(!Array.isArray(counts)||!counts.every(n=>Number.isSafeInteger(n)&&n>=0&&n<=1000000))throw Error('人数は0以上の整数で入力してください');const rows=courses.map(c=>{if(c.prices.length!==counts.length)throw Error('年齢区分を確認してください');const pending=c.prices.some((p,i)=>p===null&&counts[i]>0);const total=pending?null:c.prices.reduce((sum,p,i)=>sum+(p??0)*counts[i],0);if(total!==null&&!Number.isSafeInteger(total))throw Error('人数・料金を確認してください');return {...c,total};});const known=rows.filter(c=>c.total!==null),min=known.length?Math.min(...known.map(c=>c.total)):null;return {people:counts.reduce((a,b)=>a+b,0),minimum:min,courses:rows.map(c=>({...c,difference:c.total===null?null:c.total-min}))};}
export const participantCategories=['大人','シニア（65歳以上）','中学生・高校生','小学生高学年（4〜6年）','小学生低学年（1〜3年）','幼児（4歳〜未就学児）','3歳以下'];
export const storeCategories=s=>s.age_scheme==='split-school'?participantCategories:categories;
export function countsForStore(store,counts){if(counts.length!==7)throw Error('参加人数を確認してください');return store.age_scheme==='split-school'?[...counts]:[counts[0],counts[1],counts[2],counts[3]+counts[4],counts[5]+counts[6]];}
export function drinkTotal(store,counts,mode='none',alcoholCount=0){
 if(mode==='none'||!store.drink_options)return 0;
 if(!['soft','no-beer','beer'].includes(mode)||!Number.isSafeInteger(alcoholCount)||alcoholCount<0||alcoholCount>counts[0]+counts[1])throw Error('お酒を飲む20歳以上の人数を確認してください');
 const soft=store.drink_options.find(o=>o.id==='soft');let total=0;
 const byStore=countsForStore(store,counts);for(let i=0;i<byStore.length;i++){const rate=soft.prices[i];if(rate===null&&byStore[i])return null;total+=(rate??0)*byStore[i];}
 if(mode!=='soft'){const selected=store.drink_options.find(o=>o.id===mode);if(!selected)throw Error('飲み放題を確認してください');
 // Allocate explicitly selected adults to the adult then senior bucket, both priced independently.
 const split=[Math.min(alcoholCount,counts[0]),Math.max(0,alcoholCount-counts[0])];for(let i=0;i<2;i++){if(split[i]&&(selected.prices[i]===null||soft.prices[i]===null))return null;total+=split[i]*((selected.prices[i]??0)-(soft.prices[i]??0));}}
 if(!Number.isSafeInteger(total)||total<0)throw Error('飲み放題の料金を確認してください');return total;
}



export const orderKey=(product,variant)=>product.id+':'+variant.id;
export function calculateOrder(products,quantities){
 const lines=[];for(const p of products)if(!p.hidden)for(const v of p.variants){const key=orderKey(p,v),qty=quantities[key]||0;if(!Number.isSafeInteger(qty)||qty<0||qty>1000000||!Number.isSafeInteger(v.price)||v.price<0)throw Error('個数・料金を確認してください');if(qty)lines.push({key,product:p,variant:v,quantity:qty,subtotal:qty*v.price});}
 const total=lines.reduce((s,l)=>s+l.subtotal,0);if(!Number.isSafeInteger(total))throw Error('個数が大きすぎます');return {lines,total,quantity:lines.reduce((s,l)=>s+l.quantity,0)};
}
