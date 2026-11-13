export const budgetCategories = {
 '食費': ['食材','おやつ','外食'], '日用品': [], '衣服': [], '美容': ['美容院','美容用品'],
 '医療・健康': ['病院','薬'], '教育': ['学校','教材','習い事'], '娯楽': ['ゲーム','レジャー','宝くじ'],
 '車・交通': ['ガソリン','ローン','交通費'], '通信・サブスク': ['携帯','インターネット','月額サービス'],
 '税金・保険': ['税金','保険料'], '貯金・積立': ['NISA','ゲーム貯金','旅行積立','その他'], 'その他': ['未整理'],
};
export const budgetPeople = ['自分','長女','次女','祖父','祖母','犬','家族共通','その他'];
export const spendingKinds = ['計画的','予定外','突発的'];
export const savingsKinds = ['目的別積立','カード投資積立'];
const mappings = {
 'おやつ':['食費','おやつ'], '外食':['食費','外食'], 'ゲーム・娯楽':['娯楽'], '交通・ガソリン':['車・交通'],
 '医療費':['医療・健康'], '祖母・医療費':['医療・健康','','祖母'], '祖母・利用分':['その他','未整理','祖母'],
 '犬':['その他','未整理','犬'], '学校':['教育','学校'], '習い事':['教育','習い事'], '宝くじ':['娯楽','宝くじ'],
 '税金':['税金・保険','税金'], '貯金':['貯金・積立'], '車':['車・交通'], '車・ローン':['車・交通'],
};
const incomeCategories = ['その他','手当','振込','資金移動'];
export function classificationSettings(s) {
 const old = s.categories.tree;
 const tree = Object.fromEntries(Object.entries(budgetCategories).map(([name,middle])=>[
  name,{...Object.fromEntries(middle.map(m=>[m,[]])),...(Object.hasOwn(old,name)?old[name]:{})},
 ]));
 return {tree,hidden:[],income:[...incomeCategories]};
}
function mapPart(part) {
 const [category,middle='',person=''] = Object.hasOwn(mappings,part.category)?mappings[part.category]:
  Object.hasOwn(budgetCategories,part.category)?[part.category,part.middle||'']:['その他','未整理'];
 return {...part,originalClassification:part.originalClassification||{
  category:part.category,middle:part.middle||'',small:part.small||'',person:part.person||'',
 },category,middle,person:part.person||person};
}
export function migrateClassification(s,merchants={}) {
 if(s.classificationVersion===1)return {entries:0,unorganized:0,rules:0,plans:0,merchantRules:0};
 const counts={entries:0,unorganized:0,rules:0,plans:0,merchantRules:0};
 s.previousCategories=structuredClone(s.categories);
 s.categories=classificationSettings(s);
 for(const e of s.entries){
  if(['income','recovery'].includes(e.type))for(const part of e.splits){
   if(!s.categories.income.includes(part.category))s.categories.income.push(part.category);
  }
 }
 for(const entry of s.entries){
  if(entry.void||!['expense','advance','refund'].includes(entry.type))continue;
  if(!entry.merchant&&merchants[entry.id])entry.merchant=merchants[entry.id];
  entry.splits=entry.splits.map(mapPart);
  counts.entries++;
  if(entry.splits.some(p=>p.middle==='未整理'))counts.unorganized++;
 }
 for(const [rows,key] of [[s.rules,'rules'],[s.plans,'plans']]){
  for(const row of rows){
   if(key==='rules'?!row.enabled:row.status!=='planned')continue;
   const part=mapPart(row);
   if(row.category==='税金'&&/保険/.test(row.name||''))part.middle='保険料';
   Object.assign(row,{category:part.category,middle:part.middle,originalClassification:part.originalClassification});
   counts[key]++;
  }
 }
 for(const [key,value] of Object.entries(s.merchantCategories||{})){
  if(!value||value.disabled)continue;
  const old=typeof value==='string'?{category:value}:value;
  const {category,middle}=mapPart(old);
  s.merchantCategories[key]={category,middle,person:old.person||'',previousCategory:old.category,disabled:middle==='未整理'};
  counts.merchantRules++;
 }
 const preference=mapPart(s.preferences);
 Object.assign(s.preferences,{category:preference.category,middle:preference.middle,small:''});
 s.classificationVersion=1;
 return counts;
}
export function budgetClassificationPreview(s){
 const draft=structuredClone(s);
 const counts=migrateClassification(draft);
 return {...counts,alreadyApplied:s.classificationVersion===1,
  categories:classificationSettings(s).tree,
  mappings:Object.keys((s.previousCategories||s.categories).tree).map(category=>{
   const part=mapPart({category});
   return {from:category,category:part.category,middle:part.middle,person:part.person,
    income:s.entries.some(e=>!e.void&&['income','recovery'].includes(e.type)&&e.splits.some(p=>p.category===category))};
  }),
  unresolved:draft.entries.filter(e=>!e.void&&e.splits.some(p=>p.middle==='未整理')).map(e=>({
   id:e.id,date:e.date,label:e.purchase||e.merchant||e.memo,amount:e.amount,
   categories:e.splits.filter(p=>p.middle==='未整理').map(p=>p.originalClassification?.category||p.category),
  })),
 };
}
export function outstandingAdvance(s,entry) {
 const legacy=s.entries.filter(e=>!e.void&&e.type==='recovery'&&e.linkedAdvanceId===entry.id).reduce((sum,e)=>sum+e.amount,0);
 const allocated=(s.advanceSettlements||[]).flatMap(x=>x.items).filter(x=>x.id===entry.id);
 return Math.max(0,entry.amount-legacy-allocated.reduce((sum,x)=>sum+x.received+x.waived,0));
}
