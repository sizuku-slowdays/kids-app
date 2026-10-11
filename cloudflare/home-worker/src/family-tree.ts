import {householdPeople,peopleCheck as check,peopleReply as reply} from './household-people';
type TreeEnv={DB:D1Database;PRIVATE_FILES:R2Bucket};
type Person={id:string;household_id:string;home_user_id:string|null;name:string;furigana:string;former_name:string;gender:string;birth_date:string;death_date:string;memo:string;photo_id:string|null;deleted_at:string|null;created_by:string;updated_at:string};
type Relation={id:string;household_id:string;from_person:string;to_person:string;kind:string;status:string;start_date:string;end_date:string;memo:string;deleted_at:string|null;deleted_with_person:string|null;updated_at:string};
const relationKinds=['biological_parent','adoptive_parent','guardian','marriage','partnership','sibling'];
const parentKinds=['biological_parent','adoptive_parent'];
const text=(v:unknown,max:number)=>{check(typeof v==='string'&&v.length<=max,'入力の長さを確認してください');return v.trim();};
const optional=(v:unknown,max:number)=>v===undefined?'':text(v,max);
function date(v:unknown){const s=optional(v,10);if(!s)return '';check(/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(s),'日付は年・年月・年月日で入力してください');const parts=s.split('-').map(Number),[y,m,d]=parts;const days=[31,(y%4===0&&(y%100!==0||y%400===0))?29:28,31,30,31,30,31,31,30,31,30,31];check(y>=1&&y<=9999&&(parts.length<2||(m>=1&&m<=12))&&(parts.length<3||(d>=1&&d<=days[m-1])),'日付を確認してください');return s;}
const id=(v:unknown)=>{const s=text(v,80);check(/^[a-zA-Z0-9_-]+$/.test(s),'番号を確認してください');return s;};
function pngJpegWebp(bytes:Uint8Array){if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';if(bytes.length>8&&[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b))return 'image/png';if(String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return 'image/webp';return null;}
function b64(bytes:Uint8Array){let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.slice(i,i+8192));return btoa(s);}
function unb64(s:unknown){check(typeof s==='string'&&s.length<=2800000,'写真の容量を確認してください');try{return Uint8Array.from(atob(s),c=>c.charCodeAt(0));}catch{throw Object.assign(new Error('写真の内容を確認してください'),{status:400});}}
function hasCycle(relations:Pick<Relation,'from_person'|'to_person'|'kind'|'deleted_at'>[]){const graph=new Map<string,string[]>();for(const r of relations)if(!r.deleted_at&&parentKinds.includes(r.kind))graph.set(r.from_person,[...(graph.get(r.from_person)||[]),r.to_person]);const done=new Set<string>(),active=new Set<string>();function visit(k:string):boolean{if(active.has(k))return true;if(done.has(k))return false;active.add(k);for(const c of graph.get(k)||[])if(visit(c))return true;active.delete(k);done.add(k);return false;}return [...graph.keys()].some(visit);}
async function state(env:TreeEnv,household:string){await env.DB.prepare('INSERT OR IGNORE INTO family_tree_state VALUES(?,0)').bind(household).run();return Number((await env.DB.prepare('SELECT revision FROM family_tree_state WHERE household_id=?').bind(household).first<{revision:number}>())?.revision);}
async function commit(env:TreeEnv,household:string,actor:string,revision:unknown,statements:D1PreparedStatement[]){
 check(Number.isSafeInteger(revision)&&Number(revision)>=0,'更新番号を確認してください');
 const guard=env.DB.prepare('INSERT INTO family_tree_changes(id,household_id,actor_id,base_revision,approved,created_at) VALUES(?,?,?,?,(SELECT revision=? FROM family_tree_state WHERE household_id=?),?)').bind(crypto.randomUUID(),household,actor,revision,revision,household,new Date().toISOString());
 try{await env.DB.batch([guard,...statements,env.DB.prepare('UPDATE family_tree_state SET revision=revision+1 WHERE household_id=?').bind(household)]);}catch(e){if(String(e).includes('approved')||String(e).includes('CHECK constraint'))throw Object.assign(new Error('別の端末で変更されました。読み直してください'),{status:409});throw e;}
}
function cleanPerson(data:Record<string,unknown>,household:string,actor:string,now:string):Person{
 const gender=data.gender===undefined?'unknown':String(data.gender);check(['female','male','other','unknown'].includes(gender),'人物の区分を確認してください');
 return {id:data.id?id(data.id):crypto.randomUUID(),household_id:household,home_user_id:data.home_user_id?id(data.home_user_id):null,name:optional(data.name,100),furigana:optional(data.furigana,100),former_name:optional(data.former_name,100),gender,birth_date:date(data.birth_date),death_date:date(data.death_date),memo:optional(data.memo,10000),photo_id:data.photo_id?id(data.photo_id):null,deleted_at:null,created_by:actor,updated_at:now};
}
function personStatement(env:TreeEnv,p:Person){return env.DB.prepare('INSERT INTO family_tree_people(id,household_id,home_user_id,name,furigana,former_name,gender,birth_date,death_date,memo,photo_id,deleted_at,created_by,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET home_user_id=excluded.home_user_id,name=excluded.name,furigana=excluded.furigana,former_name=excluded.former_name,gender=excluded.gender,birth_date=excluded.birth_date,death_date=excluded.death_date,memo=excluded.memo,photo_id=excluded.photo_id,deleted_at=excluded.deleted_at,updated_at=excluded.updated_at').bind(p.id,p.household_id,p.home_user_id,p.name,p.furigana,p.former_name,p.gender,p.birth_date,p.death_date,p.memo,p.photo_id,p.deleted_at,p.created_by,p.updated_at);}
function relationStatement(env:TreeEnv,r:Relation){return env.DB.prepare('INSERT INTO family_tree_relations VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET from_person=excluded.from_person,to_person=excluded.to_person,kind=excluded.kind,status=excluded.status,start_date=excluded.start_date,end_date=excluded.end_date,memo=excluded.memo,deleted_at=excluded.deleted_at,deleted_with_person=excluded.deleted_with_person,updated_at=excluded.updated_at').bind(r.id,r.household_id,r.from_person,r.to_person,r.kind,r.status,r.start_date,r.end_date,r.memo,r.deleted_at,r.deleted_with_person,r.updated_at);}
export async function familyTreeRoute(request:Request,env:TreeEnv,userId:string,readBody:(r:Request)=>Promise<Record<string,unknown>>){
 try{
 const url=new URL(request.url),path=url.pathname.slice('/api/family-tree'.length),method=request.method;
 const groups=(await env.DB.prepare("SELECT g.id,g.name FROM groups g JOIN memberships m ON m.group_id=g.id JOIN group_apps ga ON ga.group_id=g.id AND ga.app_id='family-tree' WHERE g.kind='household' AND m.user_id=? ORDER BY g.created_at").bind(userId).all<{id:string;name:string}>()).results;
 if(path==='/households'&&method==='GET')return reply(groups);
 const household=url.searchParams.get('household')||(groups.length===1?groups[0].id:null);check(household&&groups.some(g=>g.id===household),'家庭を選んでください',403);
 const ctx=await householdPeople(env,userId,household),adult=ctx.adult,revision=await state(env,household);
 if(path.startsWith('/photos/')&&method==='GET'){
 const photo=await env.DB.prepare('SELECT * FROM family_tree_photos WHERE id=? AND household_id=?').bind(path.slice(8),household).first<{object_key:string;mime_type:string}>();check(photo,'写真が見つかりません',404);
 const used=await env.DB.prepare('SELECT 1 FROM family_tree_people WHERE photo_id=? AND household_id=? AND deleted_at IS NULL').bind(path.slice(8),household).first();check(used||adult,'写真が見つかりません',404);
 const obj=await env.PRIVATE_FILES.get(photo.object_key);check(obj,'写真が見つかりません',404);return new Response(obj.body,{headers:{'Content-Type':photo.mime_type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }
 const people=(await env.DB.prepare('SELECT * FROM family_tree_people WHERE household_id=? ORDER BY updated_at,id').bind(household).all<Person>()).results;
 const relations=(await env.DB.prepare('SELECT * FROM family_tree_relations WHERE household_id=? ORDER BY id').bind(household).all<Relation>()).results;
 if(path===''&&method==='GET')return reply({household,revision,adult,configure:ctx.configure,users:ctx.rows,userId,people:people.filter(p=>!p.deleted_at),relations:relations.filter(r=>!r.deleted_at&&people.some(p=>p.id===r.from_person&&!p.deleted_at)&&people.some(p=>p.id===r.to_person&&!p.deleted_at)),basis:people.find(p=>p.home_user_id===userId&&!p.deleted_at)?.id||null});
 check(adult,'大人として設定された利用者だけが編集できます',403);
 if(path==='/trash'&&method==='GET')return reply({revision,people:people.filter(p=>p.deleted_at),relations:relations.filter(r=>r.deleted_at)});
 if(path==='/photos'&&method==='POST'){
 check(request.headers.get('Content-Length')===null||Number(request.headers.get('Content-Length'))<=2100000,'写真は2MBまでです',413);
 const reader=request.body?.getReader();check(reader,'写真を選んでください');let size=0;const parts:Uint8Array[]=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2100000){await reader.cancel();check(false,'写真は2MBまでです',413);}parts.push(value);}const multipart=new Uint8Array(size);let offset=0;for(const part of parts){multipart.set(part,offset);offset+=part.length;}const form=await new Request(request.url,{method:'POST',headers:request.headers,body:multipart}).formData(),file=form.get('file');check(file instanceof File&&file.size>0&&file.size<=2000000,'写真は2MBまでです',413);const bytes=new Uint8Array(await file.arrayBuffer()),mime=pngJpegWebp(bytes);check(mime&&file.type===mime,'JPEG・PNG・WebPの写真を選んでください',415);
 const photoId=crypto.randomUUID(),key=`family-tree/${household}/${photoId}`;await env.PRIVATE_FILES.put(key,bytes,{httpMetadata:{contentType:mime}});
 try{await commit(env,household,userId,Number(form.get('revision')),[env.DB.prepare('INSERT INTO family_tree_photos VALUES(?,?,?,?,?,?,?)').bind(photoId,household,key,mime,bytes.length,userId,new Date().toISOString())]);}catch(e){await env.PRIVATE_FILES.delete(key);throw e;}
 return reply({id:photoId,revision:revision+1},201);
 }
 if(path==='/backup'&&method==='GET'){
 const photos=[];let total=0;
 const records=(await env.DB.prepare('SELECT * FROM family_tree_photos WHERE household_id=? AND id IN (SELECT photo_id FROM family_tree_people WHERE household_id=?)').bind(household,household).all<{id:string;object_key:string;mime_type:string;byte_size:number}>()).results;
 for(const p of records){total+=p.byte_size;check(total<=20000000,'写真付きバックアップは合計20MBまでです',413);const object=await env.PRIVATE_FILES.get(p.object_key);check(object,'写真が見つかりません。バックアップを中止しました',409);photos.push({id:p.id,mime_type:p.mime_type,base64:b64(new Uint8Array(await object.arrayBuffer()))});}
 const latest=await state(env,household);check(latest===revision,'バックアップ中に変更されました。もう一度お試しください',409);
 return reply({format:'wagaya-family-tree-v1',household_id:household,revision,exported_at:new Date().toISOString(),people,relations,photos});
 }
 const data=await readBody(request),now=new Date().toISOString();
 if((path==='/people'&&method==='POST')||(path.startsWith('/people/')&&method==='PUT')){
 const prior=path.startsWith('/people/')?people.find(p=>p.id===path.slice(8)):null;if(method==='PUT')check(prior&&!prior.deleted_at,'人物が見つかりません',404);
 const p=cleanPerson({...data,id:prior?.id||data.id},household,userId,now);const existing=await env.DB.prepare('SELECT household_id FROM family_tree_people WHERE id=?').bind(p.id).first<{household_id:string}>();check(!existing||existing.household_id===household,'番号を確認してください',409);if(method==='POST')check(!existing,'この人物番号は登録済みです',409);
 if(p.home_user_id)check(ctx.rows.some(u=>u.id===p.home_user_id),'この家庭のHOME利用者を選んでください');
 if(p.photo_id)check(await env.DB.prepare('SELECT 1 FROM family_tree_photos WHERE id=? AND household_id=?').bind(p.photo_id,household).first(),'この家庭の写真を選んでください');
 if(prior)p.created_by=prior.created_by;
 await commit(env,household,userId,data.revision,[personStatement(env,p)]);return reply({ok:true,id:p.id,revision:revision+1},method==='POST'?201:200);
 }
 if(path.startsWith('/people/')&&method==='DELETE'){
 const p=people.find(p=>p.id===path.slice(8));check(p&&!p.deleted_at,'人物が見つかりません',404);
 await commit(env,household,userId,data.revision,[env.DB.prepare('UPDATE family_tree_people SET deleted_at=?,updated_at=? WHERE id=? AND household_id=?').bind(now,now,p.id,household),env.DB.prepare('UPDATE family_tree_relations SET deleted_at=?,deleted_with_person=?,updated_at=? WHERE household_id=? AND deleted_at IS NULL AND (from_person=? OR to_person=?)').bind(now,p.id,now,household,p.id,p.id)]);return reply({ok:true,revision:revision+1});
 }
 if(path==='/relations'&&method==='POST'||path.startsWith('/relations/')&&method==='PUT'){
 const prior=method==='PUT'?relations.find(r=>r.id===path.slice(11)):null;if(method==='PUT')check(prior&&!prior.deleted_at,'関係が見つかりません',404);
 const rid=prior?.id||crypto.randomUUID(),from=id(data.from_person),to=id(data.to_person),kind=text(data.kind,30),status=optional(data.status,15)||'current';check(from!==to&&people.some(p=>p.id===from&&!p.deleted_at)&&people.some(p=>p.id===to&&!p.deleted_at),'登録済みの別々の人物を選んでください');check(relationKinds.includes(kind)&&['current','divorced','ended','unknown'].includes(status),'関係を確認してください');
 const r:Relation={id:rid,household_id:household,from_person:from,to_person:to,kind,status,start_date:date(data.start_date),end_date:date(data.end_date),memo:optional(data.memo,10000),deleted_at:null,deleted_with_person:null,updated_at:now};
 check(!hasCycle([...relations.filter(x=>x.id!==rid),r]),'親子関係が循環するため保存できません');await commit(env,household,userId,data.revision,[relationStatement(env,r)]);return reply({ok:true,id:rid,revision:revision+1},201);
 }
 if(path.startsWith('/relations/')&&method==='DELETE'){
 const r=relations.find(x=>x.id===path.slice(11));check(r&&!r.deleted_at,'関係が見つかりません',404);await commit(env,household,userId,data.revision,[env.DB.prepare('UPDATE family_tree_relations SET deleted_at=?,deleted_with_person=NULL,updated_at=? WHERE id=? AND household_id=?').bind(now,now,r.id,household)]);return reply({ok:true,revision:revision+1});
 }
 if(path==='/restore-item'&&method==='POST'){
 const item=id(data.id);
 if(data.kind==='person'){const p=people.find(p=>p.id===item&&p.deleted_at);check(p,'人物が見つかりません',404);const revived=relations.filter(r=>r.deleted_with_person===item&&people.some(p=>p.id===r.from_person&&(!p.deleted_at||p.id===item))&&people.some(p=>p.id===r.to_person&&(!p.deleted_at||p.id===item))).map(r=>({...r,deleted_at:null,deleted_with_person:null}));check(!hasCycle([...relations.filter(r=>!revived.some(x=>x.id===r.id)),...revived]),'復元すると親子関係が循環します');await commit(env,household,userId,data.revision,[env.DB.prepare('UPDATE family_tree_people SET deleted_at=NULL,updated_at=? WHERE id=? AND household_id=?').bind(now,item,household),...revived.map(r=>relationStatement(env,r))]);}
 else{const r=relations.find(r=>r.id===item&&r.deleted_at);check(r&&people.some(p=>p.id===r.from_person&&!p.deleted_at)&&people.some(p=>p.id===r.to_person&&!p.deleted_at),'人物を先に復元してください');const revived={...r,deleted_at:null,deleted_with_person:null,updated_at:now};check(!hasCycle([...relations.filter(x=>x.id!==item),revived]),'復元すると親子関係が循環します');await commit(env,household,userId,data.revision,[relationStatement(env,revived)]);}
 return reply({ok:true,revision:revision+1});
 }
 if(path==='/restore'&&method==='POST'){
 check(data.confirm_replace===true,'現在の家系図を置き換える確認が必要です');const backup=data.backup as Record<string,unknown>;check(backup&&backup.format==='wagaya-family-tree-v1'&&backup.household_id===household,'同じ家庭のバックアップを選んでください');check(Array.isArray(backup.people)&&backup.people.length<=1000&&Array.isArray(backup.relations)&&backup.relations.length<=5000&&Array.isArray(backup.photos),'バックアップ形式を確認してください');
 const ps=backup.people.map(raw=>{check(raw&&typeof raw==='object','人物を確認してください');const p=cleanPerson(raw,household,userId,now);p.deleted_at=raw.deleted_at?text(raw.deleted_at,40):null;return p;});check(new Set(ps.map(p=>p.id)).size===ps.length,'人物番号が重複しています');check(new Set(ps.filter(p=>p.home_user_id).map(p=>p.home_user_id)).size===ps.filter(p=>p.home_user_id).length,'HOME本人が重複しています');
 for(const p of ps){const other=await env.DB.prepare('SELECT household_id FROM family_tree_people WHERE id=?').bind(p.id).first<{household_id:string}>();check(!other||other.household_id===household,'他の家庭の人物番号は利用できません');if(p.home_user_id)check(ctx.rows.some(u=>u.id===p.home_user_id),'HOME本人の所属が変わっています。リンクを確認してください');}
 const rs=backup.relations.map(raw=>{check(raw&&typeof raw==='object','関係を確認してください');const r:Relation={id:id(raw.id),household_id:household,from_person:id(raw.from_person),to_person:id(raw.to_person),kind:text(raw.kind,30),status:optional(raw.status,15)||'current',start_date:date(raw.start_date),end_date:date(raw.end_date),memo:optional(raw.memo,10000),deleted_at:raw.deleted_at?text(raw.deleted_at,40):null,deleted_with_person:raw.deleted_with_person?id(raw.deleted_with_person):null,updated_at:now};check(r.from_person!==r.to_person&&ps.some(p=>p.id===r.from_person)&&ps.some(p=>p.id===r.to_person)&&relationKinds.includes(r.kind)&&['current','divorced','ended','unknown'].includes(r.status),'関係を確認してください');return r;});check(new Set(rs.map(r=>r.id)).size===rs.length&&!hasCycle(rs),'関係が重複または循環しています');for(const r of rs){const other=await env.DB.prepare('SELECT household_id FROM family_tree_relations WHERE id=?').bind(r.id).first<{household_id:string}>();check(!other||other.household_id===household,'他の家庭の関係番号は利用できません');}
 const phs=backup.photos.map(raw=>{check(raw&&typeof raw==='object','写真を確認してください');const bytes=unb64(raw.base64),mime=pngJpegWebp(bytes);check(bytes.length<=2000000&&mime===raw.mime_type,'写真の形式を確認してください');return {id:id(raw.id),bytes,mime:mime!,key:`family-tree/${household}/restores/${crypto.randomUUID()}`};});check(new Set(phs.map(p=>p.id)).size===phs.length&&phs.reduce((a,p)=>a+p.bytes.length,0)<=20000000,'写真の容量を確認してください');for(const p of ps)if(p.photo_id)check(phs.some(f=>f.id===p.photo_id),'写真が不足しています');for(const p of phs){const other=await env.DB.prepare('SELECT household_id FROM family_tree_photos WHERE id=?').bind(p.id).first<{household_id:string}>();check(!other||other.household_id===household,'他の家庭の写真番号は利用できません');}
 const statements=[env.DB.prepare('UPDATE family_tree_people SET home_user_id=NULL,deleted_at=?,updated_at=? WHERE household_id=?').bind(now,now,household),env.DB.prepare('UPDATE family_tree_relations SET deleted_at=?,updated_at=? WHERE household_id=?').bind(now,now,household)];
 try{for(const p of phs){await env.PRIVATE_FILES.put(p.key,p.bytes,{httpMetadata:{contentType:p.mime}});statements.push(env.DB.prepare('INSERT INTO family_tree_photos VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET object_key=excluded.object_key,mime_type=excluded.mime_type,byte_size=excluded.byte_size').bind(p.id,household,p.key,p.mime,p.bytes.length,userId,now));}statements.push(...ps.map(p=>personStatement(env,p)),...rs.map(r=>relationStatement(env,r)));check(statements.length<=900,'一度に復元できる件数を超えています');await commit(env,household,userId,data.revision,statements);}catch(e){await Promise.all(phs.map(p=>env.PRIVATE_FILES.delete(p.key)));throw e;}
 return reply({ok:true,revision:revision+1,people:ps.length,relations:rs.length});
 }
 return reply({error:'見つかりません'},404);
 }catch(e){return reply({error:e instanceof Error?e.message:'処理できませんでした'},Number((e as {status?:number}).status)||500);}
}
