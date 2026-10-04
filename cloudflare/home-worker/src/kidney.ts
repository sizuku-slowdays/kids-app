type Context = {DB:D1Database};
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
function check(ok:unknown,message:string,status=400):asserts ok {if(!ok)throw Object.assign(new Error(message),{status});}
const keys=['salt','protein','potassium','phosphorus','energy'];
const text=(v:unknown,max=100)=>{check(typeof v==='string'&&v.trim().length>0&&v.length<=max,'入力内容を確認してください');return v.trim();};
function day(v:unknown){const s=text(v,10);check(/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(new Date(s+'T00:00:00Z').getTime())&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s,'日付を確認してください');return s;}
function items(v:unknown){
 check(Array.isArray(v)&&v.length>0&&v.length<=100,'食品を選んでください');
 return v.map(i=>{check(i&&typeof i==='object','食品を確認してください');check(typeof i.qty==='number'&&Number.isFinite(i.qty)&&i.qty>0&&i.qty<=100,'量を確認してください');
 const values:Record<string,number>={};check(i.values&&typeof i.values==='object','栄養量を確認してください');
 for(const key of keys){const n=i.values[key];check(typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=100000,'栄養量を確認してください');values[key]=n;}
 return {id:text(i.id),name:text(i.name),portion:text(i.portion),qty:i.qty,values};});
}
export async function kidneyRoute(request:Request,env:Context,userId:string,readBody:(r:Request)=>Promise<Record<string,unknown>>){
 try{
 const url=new URL(request.url),path=url.pathname.slice('/api/kidney'.length),method=request.method;
 const groups=(await env.DB.prepare("SELECT g.id,g.name,m.role FROM groups g JOIN memberships m ON m.group_id=g.id JOIN group_apps ga ON ga.group_id=g.id AND ga.app_id='kidney' WHERE g.kind='household' AND m.user_id=? ORDER BY g.created_at,g.id").bind(userId).all<{id:string;name:string;role:string}>()).results;
 if(path==='/households'&&method==='GET')return reply(groups);
 const household=url.searchParams.get('household')||(groups.length===1?groups[0].id:null);
 const group=groups.find(g=>g.id===household);check(group,'家庭を選んでください',403);
 const admin=['owner','admin'].includes(group.role);
 if(path==='/settings'&&method==='PUT'){
 check(admin,'目標量の設定は家族の管理者にお願いしてください',403);
 const data=await readBody(request),settings=data.settings as Record<string,{max:number;visible:boolean}>;check(settings&&typeof settings==='object','設定を確認してください');
 const clean:Record<string,{max:number;visible:boolean}>={};
 for(const key of keys){const n=settings[key];check(n&&typeof n.max==='number'&&Number.isFinite(n.max)&&n.max>0&&n.max<=100000&&typeof n.visible==='boolean','目標量を確認してください');clean[key]={max:n.max,visible:n.visible};}
 check(Object.values(clean).some(n=>n.visible),'1つ以上表示してください');
 check(Number.isSafeInteger(data.revision)&&Number(data.revision)>=0,'更新番号を確認してください');
 const cleanJson=JSON.stringify(clean),now=new Date().toISOString();
 const result=Number(data.revision)===0
   ?await env.DB.prepare('INSERT OR IGNORE INTO kidney_settings(household_id,settings_json,revision,updated_by,updated_at) VALUES(?,?,1,?,?)').bind(household,cleanJson,userId,now).run()
   :await env.DB.prepare('UPDATE kidney_settings SET settings_json=?,revision=revision+1,updated_by=?,updated_at=? WHERE household_id=? AND revision=?').bind(cleanJson,userId,now,household,data.revision).run();
 const changed=result.meta.changes;
 check(changed,'別の端末で設定が変わりました。読み直してください',409);return reply({ok:true});
 }
 if(path==='/meals'&&method==='POST'){
 const data=await readBody(request),id=text(data.id,80);check(/^[a-zA-Z0-9_-]+$/.test(id),'記録番号を確認してください');
 const content=items(data.items),date=day(data.day),meal=text(data.meal,10);check(['朝','昼','夜','間食'].includes(meal),'食事の種類を選んでください');
 const existing=await env.DB.prepare('SELECT household_id,created_by,items_json,day,meal FROM kidney_meals WHERE id=?').bind(id).first<{household_id:string;created_by:string;items_json:string;day:string;meal:string}>();
 if(existing){check(existing.household_id===household&&existing.created_by===userId&&existing.items_json===JSON.stringify(content)&&existing.day===date&&existing.meal===meal,'同じ記録番号が使用されています',409);return reply({ok:true,id});}
 const now=new Date().toISOString();await env.DB.prepare('INSERT INTO kidney_meals(id,household_id,day,meal,items_json,created_by,updated_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,household,date,meal,JSON.stringify(content),userId,userId,now,now).run();return reply({ok:true,id},201);
 }
 if(path.startsWith('/meals/')&&['PUT','DELETE'].includes(method)){
 const id=path.slice('/meals/'.length),record=await env.DB.prepare('SELECT created_by,revision FROM kidney_meals WHERE id=? AND household_id=?').bind(id,household).first<{created_by:string;revision:number}>();
 check(record,'記録が見つかりません',404);check(admin||record.created_by===userId,'この記録の変更は登録した人か家族の管理者にお願いしてください',403);
 const data=await readBody(request);check(data.revision===record.revision,'別の端末で記録が変わりました。読み直してください',409);
 const result=method==='DELETE'?await env.DB.prepare('DELETE FROM kidney_meals WHERE id=? AND household_id=? AND revision=?').bind(id,household,data.revision).run():await env.DB.prepare('UPDATE kidney_meals SET items_json=?,updated_by=?,updated_at=?,revision=revision+1 WHERE id=? AND household_id=? AND revision=?').bind(JSON.stringify(items(data.items)),userId,new Date().toISOString(),id,household,data.revision).run();
 check(result.meta.changes,'記録が変わりました。読み直してください',409);return reply({ok:true});
 }
 if(path===''&&method==='GET'){
 const date=day(url.searchParams.get('day'));
 const settings=await env.DB.prepare('SELECT settings_json,revision FROM kidney_settings WHERE household_id=?').bind(household).first<{settings_json:string;revision:number}>();
 const records=(await env.DB.prepare('SELECT k.*,u.display_name actor FROM kidney_meals k JOIN users u ON u.id=k.created_by WHERE k.household_id=? AND k.day=? ORDER BY k.created_at,k.id').bind(household,date).all<{items_json:string;created_by:string;[key:string]:unknown}>()).results.map(({items_json,...r})=>({...r,items:JSON.parse(items_json),editable:admin||r.created_by===userId}));
 return reply({household:group,admin,userId,settings:settings?JSON.parse(settings.settings_json):null,revision:settings?.revision||0,records,date});
 }
 return reply({error:'見つかりません'},404);
 }catch(error){return reply({error:error instanceof Error?error.message:'保存できませんでした'},Number((error as {status?:number}).status)||500);}
}
