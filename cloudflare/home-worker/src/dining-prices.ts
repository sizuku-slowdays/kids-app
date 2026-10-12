import {westernStore} from './dining-western';
type Course = {id:string;name:string;prices:number[]};
type Product={id:string;name:string;category:string;period:string;time_note:string;note:string;hidden:boolean;source_page?:number;variants:{id:string;label:string;price:number}[]};
type Store = {id:string;name:string;note:string;courses:Course[];type?:string;categories?:string[];products?:Product[];[key:string]:unknown};
const initial:Store[]=[{id:'west-hashimoto',name:'焼肉ウエスト 橋本店',note:'2026年9月版 店舗チラシの税込料金。食べ放題にはサラダ＆デザートバー付き。',courses:[
 {id:'lunch',name:'ランチ',prices:[3828,3498,3608,1914,0]},
 {id:'marutoku',name:'まる得',prices:[4708,4268,4378,2354,0]},
 {id:'special',name:'特選',prices:[5808,5368,5478,2904,0]},
 {id:'wagyu',name:'黒毛和牛',prices:[6908,6468,6578,3454,0]}
]}];
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
function cleanStores(value:unknown):Store[]{
 if(!Array.isArray(value)||value.length>100)throw Error('店舗は100件以内で登録してください');
 const ids=new Set<string>();return value.map(s=>{
  if(!s||typeof s!=='object'||typeof s.id!=='string'||!/^[-a-zA-Z0-9_]{1,100}$/.test(s.id)||ids.has(s.id))throw Error('店舗の情報を確認してください');ids.add(s.id);
  if(typeof s.name!=='string'||!s.name.trim()||s.name.length>100||typeof s.note!=='string'||s.note.length>1000)throw Error('店舗名・メモを確認してください');
  if(!Array.isArray(s.courses)||s.courses.length>30)throw Error('コースは店舗ごとに30件以内で登録してください');
  const courseIds=new Set<string>();const courses=s.courses.map((c:Course)=>{
   if(!c||typeof c.id!=='string'||!/^[-a-zA-Z0-9_]{1,100}$/.test(c.id)||courseIds.has(c.id)||typeof c.name!=='string'||!c.name.trim()||c.name.length>80)throw Error('コース名・情報を確認してください');courseIds.add(c.id);
   if(!Array.isArray(c.prices)||c.prices.length!==5||!c.prices.every(p=>Number.isSafeInteger(p)&&p>=0&&p<=10000000))throw Error('料金は5区分とも0〜10,000,000円の整数で入力してください');
   return {id:c.id,name:c.name.trim(),prices:c.prices};
  });
  const type=s.type||'buffet';if(!['buffet','order'].includes(type))throw Error('計算方式を確認してください');
  const categories=s.categories||[],products=s.products||[];
  if(!Array.isArray(categories)||categories.length>100||!categories.every(c=>typeof c==='string'&&c.trim()&&c.length<=80)||new Set(categories).size!==categories.length)throw Error('カテゴリ名を確認してください');
  if(!Array.isArray(products)||products.length>1000)throw Error('商品は店舗ごとに1000件以内で登録してください');
  const pids=new Set<string>(),vids=new Set<string>();const cleaned=products.map((p:Product)=>{
   if(!p||typeof p.id!=='string'||!/^[-a-zA-Z0-9_]{1,100}$/.test(p.id)||pids.has(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>200)throw Error('商品名・IDを確認してください');pids.add(p.id);
   if(!categories.includes(p.category)||!['regular','lunch','all','takeout'].includes(p.period)||typeof p.time_note!=='string'||p.time_note.length>300||typeof p.note!=='string'||p.note.length>1000||typeof p.hidden!=='boolean')throw Error('商品のカテゴリ・時間帯・表示を確認してください');
   if(!Array.isArray(p.variants)||!p.variants.length||p.variants.length>50)throw Error('価格選択肢を登録してください');
   const variants=p.variants.map(v=>{if(typeof v.id!=='string'||!/^[-a-zA-Z0-9_]{1,100}$/.test(v.id)||vids.has(v.id)||typeof v.label!=='string'||!v.label.trim()||v.label.length>100||!Number.isSafeInteger(v.price)||v.price<0||v.price>10000000)throw Error('サイズ・料金を確認してください');vids.add(v.id);return {...v,label:v.label.trim()};});
   return {...p,name:p.name.trim(),variants};
  });
  return {...s,name:s.name.trim(),note:s.note,courses,...(s.type!==undefined?{type}:{}),...(s.categories!==undefined?{categories}:{}),...(s.products!==undefined?{products:cleaned}:{})};
 });
}
export async function diningRoute(request:Request,env:Env,userId:string,readBody:(r:Request)=>Promise<any>){
 const url=new URL(request.url);if(url.pathname!=='/api/dining-prices')return json({error:'見つかりません'},404);
 const groups=(await env.DB.prepare("SELECT g.id,g.name,m.role,COALESCE(a.age_kind,'unknown') age_kind FROM groups g JOIN memberships m ON m.group_id=g.id LEFT JOIN home_member_attributes a ON a.group_id=g.id AND a.user_id=m.user_id JOIN group_apps ga ON ga.group_id=g.id AND ga.app_id='dining-prices' WHERE m.user_id=? AND g.kind='household' ORDER BY g.created_at,g.id").bind(userId).all<{id:string;name:string;role:string;age_kind:string}>()).results;
 const group=groups.find(g=>g.id===(url.searchParams.get('household')||groups[0]?.id));if(!group)return json({error:'この家庭の料金は利用できません'},403);
 const editable=group.age_kind!=='child'&&(group.age_kind==='adult'||['owner','admin'].includes(group.role));
 if(!['GET','PUT'].includes(request.method))return json({error:'この操作はできません'},405);
 if(request.method==='PUT'&&!editable)return json({error:'店舗・料金の編集は家庭の大人が行えます'},403);
 let row=await env.DB.prepare('SELECT * FROM dining_price_states WHERE household_id=?').bind(group.id).first<{stores_json:string;revision:number}>();
 if(!row){await env.DB.prepare('INSERT OR IGNORE INTO dining_price_states VALUES(?,?,1,?,?)').bind(group.id,JSON.stringify([...initial,westernStore]),userId,new Date().toISOString()).run();row=await env.DB.prepare('SELECT * FROM dining_price_states WHERE household_id=?').bind(group.id).first<{stores_json:string;revision:number}>();}
 if(!row)return json({error:'料金を読み込めませんでした'},503);
 row=await importWestern(env,group.id,userId,row);
 if(request.method==='PUT'){
  let data;try{data=await readBody(request);}catch(e){throw e;}
  if(!Number.isSafeInteger(data.revision))return json({error:'画面を読み直してください'},400);
  let stores;try{stores=cleanStores(data.stores);if(new TextEncoder().encode(JSON.stringify(stores)).length>1500000)throw Error('メニューの保存容量が大きすぎます');}catch(e){return json({error:(e as Error).message},400);}
  const saved=await env.DB.prepare('UPDATE dining_price_states SET stores_json=?,revision=revision+1,updated_by=?,updated_at=? WHERE household_id=? AND revision=?').bind(JSON.stringify(stores),userId,new Date().toISOString(),group.id,data.revision).run();
  if(!saved.meta.changes)return json({error:'別の端末で料金が変更されました。編集内容を控えてから読み直してください'},409);
  row={stores_json:JSON.stringify(stores),revision:data.revision+1};
 }
 return json({groups:groups.map(g=>({id:g.id,name:g.name})),household_id:group.id,editable,revision:row.revision,stores:JSON.parse(row.stores_json)});
}


async function importWestern(env:Env,household:string,userId:string,row:{stores_json:string;revision:number}){
 const source=westernStore.source_version,id=westernStore.id;
 for(let retry=0;retry<3;retry++){
  if(await env.DB.prepare('SELECT 1 FROM dining_price_imports WHERE household_id=? AND source_id=?').bind(household,source).first())return row;
  const stores=JSON.parse(row.stores_json) as Store[];
  if(stores.some(s=>s.id===id)){await env.DB.prepare('INSERT OR IGNORE INTO dining_price_imports VALUES(?,?,?)').bind(household,source,new Date().toISOString()).run();return row;}
  const now=new Date().toISOString();
  await env.DB.batch([
   env.DB.prepare('INSERT INTO dining_price_backups SELECT ?,household_id,revision,stores_json,? FROM dining_price_states WHERE household_id=? AND revision=? AND NOT EXISTS(SELECT 1 FROM dining_price_imports WHERE household_id=? AND source_id=?)').bind(crypto.randomUUID(),now,household,row.revision,household,source),
   env.DB.prepare('UPDATE dining_price_states SET stores_json=?,revision=revision+1,updated_by=?,updated_at=? WHERE household_id=? AND revision=? AND NOT EXISTS(SELECT 1 FROM dining_price_imports WHERE household_id=? AND source_id=?)').bind(JSON.stringify([...stores,westernStore]),userId,now,household,row.revision,household,source),
   env.DB.prepare("INSERT OR IGNORE INTO dining_price_imports SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM dining_price_states s,json_each(s.stores_json) j WHERE s.household_id=? AND json_extract(j.value,'$.id')=?)").bind(household,source,now,household,id)
  ]);
  const current=await env.DB.prepare('SELECT stores_json,revision FROM dining_price_states WHERE household_id=?').bind(household).first<{stores_json:string;revision:number}>();if(!current)throw Error('料金を読み込めませんでした');row=current;
 }
 return row;
}
