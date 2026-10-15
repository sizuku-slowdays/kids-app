type Group={id:string;name:string;role:string};
type Child={id:string;user_id:string;display_name:string};
type RecordRow={id:string;household_id:string;child_id:string;title:string;point:number;memo:string;created_at:string;created_day:string;event_id:string;deleted_at:string|null};
function requireGood(ok:unknown,message:string,status=400):asserts ok{if(!ok)throw Object.assign(Error(message),{status});}
const day=(time=Date.now())=>new Date(time+9*3600000).toISOString().slice(0,10);
const reply=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'private, no-store'}});
export async function goodDeedsRoute(request:Request,env:Env,user:string,readBody:(r:Request)=>Promise<Record<string,unknown>>){
 try{
 const url=new URL(request.url),path=url.pathname.slice('/api/good-deeds'.length),method=request.method;
 requireGood(!url.searchParams.has('owner')&&!url.searchParams.has('user_id'),'本人はHOMEのログインから確認します');
 const groups=(await env.DB.prepare("SELECT g.id,g.name,m.role FROM groups g JOIN memberships m ON m.group_id=g.id JOIN group_apps ga ON ga.group_id=g.id AND ga.app_id='good-deeds' WHERE g.kind='household' AND m.user_id=? ORDER BY g.created_at,g.id").bind(user).all<Group>()).results;
 const h=url.searchParams.get('household')||groups[0]?.id,group=groups.find(g=>g.id===h);requireGood(group,'この家庭にはアクセスできません',403);
 const admin=['owner','admin'].includes(group.role);
 const children=(await env.DB.prepare("SELECT c.id,c.user_id,u.display_name FROM children c JOIN users u ON u.id=c.user_id JOIN memberships m ON m.user_id=c.user_id AND m.group_id=c.household_id WHERE c.household_id=? AND u.active=1 AND (?=1 OR c.user_id=?) ORDER BY c.rowid").bind(h,admin?1:0,user).all<Child>()).results;
 requireGood(admin||children.length,'子どものHOMEアカウントでログインしてください',403);
 const target=url.searchParams.get('child')||children[0]?.id,child=children.find(c=>c.id===target);
 if(target)requireGood(child,'この子どもの記録にはアクセスできません',403);
 if(path===''&&method==='GET'){
  // First use starts a new zero-point ledger exactly once. Existing legacy totals are never copied.
  if(children.length)await env.DB.batch(children.map(c=>env.DB.prepare('INSERT OR IGNORE INTO good_deed_starts VALUES (?,?,?,?,?)').bind(c.id,h,crypto.randomUUID(),new Date().toISOString(),user)));
  const selectedMonth=url.searchParams.get('month')||day().slice(0,7);requireGood(/^20\d\d-(0[1-9]|1[0-2])$/.test(selectedMonth),'年月を確認してください');
  const ids=JSON.stringify(children.map(c=>c.id));const starts=(await env.DB.prepare('SELECT child_id,started_at FROM good_deed_starts WHERE household_id=? AND child_id IN (SELECT value FROM json_each(?))').bind(h,ids).all()).results;
  const totals=(await env.DB.prepare('SELECT child_id,COALESCE(SUM(point),0) total,COUNT(*) count FROM good_deed_records WHERE household_id=? AND child_id IN (SELECT value FROM json_each(?)) AND deleted_at IS NULL GROUP BY child_id').bind(h,ids).all()).results;
  if(!child)return reply({admin,groups,household_id:h,children:[],selected:null,records:[]});
  const before=url.searchParams.get('before'),trash=url.searchParams.get('trash')==='1';requireGood(!trash||admin,'旧記録の管理は保護者だけが行えます',403);
  if(before)requireGood(await env.DB.prepare('SELECT 1 FROM good_deed_records WHERE id=? AND child_id=? AND household_id=?').bind(before,child.id,h).first(),'履歴の位置を確認してください',403);
  const result=await env.DB.batch([
   env.DB.prepare('SELECT id,title,point,memo,created_at,created_day,deleted_at FROM good_deed_records WHERE household_id=? AND child_id=? AND ((?=1 AND deleted_at IS NOT NULL) OR (?=0 AND deleted_at IS NULL)) AND (? IS NULL OR (created_at,id)<(SELECT created_at,id FROM good_deed_records WHERE id=? AND child_id=?)) ORDER BY created_at DESC,id DESC LIMIT 51').bind(h,child.id,trash?1:0,trash?1:0,before,before,child.id),
   env.DB.prepare('SELECT COALESCE(SUM(point),0) total,COUNT(*) count FROM good_deed_records WHERE household_id=? AND child_id=? AND deleted_at IS NULL AND created_day=?').bind(h,child.id,day()),
   env.DB.prepare('SELECT COALESCE(SUM(point),0) total,COUNT(*) count FROM good_deed_records WHERE household_id=? AND child_id=? AND deleted_at IS NULL AND substr(created_day,1,7)=?').bind(h,child.id,selectedMonth)
  ]);
  const records=result[0].results.slice(0,50) as unknown as RecordRow[];return reply({admin,groups,household_id:h,children:children.map(c=>({...c,...(totals.find(t=>t.child_id===c.id)||{total:0,count:0}),started_at:starts.find(s=>s.child_id===c.id)?.started_at})),selected:child.id,records,next_before:result[0].results.length>50?records.at(-1)?.id:null,today:result[1].results[0],month:result[2].results[0],selected_month:selectedMonth,day:day()});
 }
 requireGood(child,'子どもを選んでください',404);
 if(path==='/start'&&method==='POST'){
  const r=await env.DB.prepare('INSERT OR IGNORE INTO good_deed_starts VALUES (?,?,?,?,?)').bind(child.id,h,crypto.randomUUID(),new Date().toISOString(),user).run();
  return reply({ok:true,already_started:!r.meta.changes});
 }
 if(path==='/records'&&method==='POST'){
  const d=await readBody(request);requireGood(!('owner'in d)&&!('user_id'in d)&&(!('child_id'in d)||d.child_id===child.id),'本人はHOMEのログインから確認します');
  requireGood(typeof d.title==='string'&&d.title.trim().length>0&&d.title.trim().length<=100,'なにをしたかを100文字以内で入力してください');
  requireGood(Number.isSafeInteger(d.point)&&Number(d.point)>0&&Number(d.point)<=100000000,'ポイントは1〜100,000,000の整数です');
  requireGood(d.memo===undefined||typeof d.memo==='string'&&d.memo.length<=300,'メモは300文字以内で入力してください');
  requireGood(typeof d.event_id==='string'&&/^[\w:-]{8,100}$/.test(d.event_id),'登録IDを確認してください');
  const memo=typeof d.memo==='string'?d.memo:'';
  const existing=await env.DB.prepare('SELECT * FROM good_deed_records WHERE child_id=? AND event_id=?').bind(child.id,d.event_id).first<RecordRow>();
  if(existing){requireGood(existing.title===d.title.trim()&&existing.point===d.point&&existing.memo===memo,'同じ登録IDの内容が異なります',409);return reply({ok:true,id:existing.id,already_recorded:true});}
  const id=crypto.randomUUID(),created=new Date();try{await env.DB.prepare('INSERT INTO good_deed_records(id,household_id,child_id,title,point,memo,created_at,created_day,actor,event_id) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(child_id,event_id) DO NOTHING').bind(id,h,child.id,d.title.trim(),d.point,memo,created.toISOString(),day(created.getTime()),user,d.event_id).run();}catch(e){const saved=await env.DB.prepare('SELECT * FROM good_deed_records WHERE child_id=? AND event_id=?').bind(child.id,d.event_id).first<RecordRow>();if(!saved||saved.title!==d.title.trim()||saved.point!==d.point||saved.memo!==memo)throw e;}const saved=await env.DB.prepare('SELECT id FROM good_deed_records WHERE child_id=? AND event_id=?').bind(child.id,d.event_id).first<{id:string}>();return reply({ok:true,id:saved?.id});
 }
 const record=path.match(/^\/records\/([\w-]+)(\/restore)?$/);
 if(record&&((method==='DELETE'&&!record[2])||(method==='POST'&&record[2]))){
  const row=await env.DB.prepare('SELECT id,deleted_at FROM good_deed_records WHERE id=? AND household_id=? AND child_id=?').bind(record[1],h,child.id).first<{id:string;deleted_at:string|null}>();requireGood(row,'この記録にはアクセスできません',403);
  if(record[2]){requireGood(admin,'復元は保護者だけが行えます',403);await env.DB.batch([env.DB.prepare("INSERT INTO good_deed_changes(household_id,child_id,record_id,kind,actor,created_at) SELECT ?,?,?,'restore',?,? WHERE EXISTS(SELECT 1 FROM good_deed_records WHERE id=? AND deleted_at IS NOT NULL)").bind(h,child.id,row.id,user,new Date().toISOString(),row.id),env.DB.prepare('UPDATE good_deed_records SET deleted_at=NULL,deleted_by=NULL WHERE id=? AND deleted_at IS NOT NULL').bind(row.id)]);}
  else await env.DB.prepare('UPDATE good_deed_records SET deleted_at=?,deleted_by=? WHERE id=? AND deleted_at IS NULL').bind(new Date().toISOString(),user,row.id).run();return reply({ok:true});
 }
 return reply({error:'見つかりません'},404);
 }catch(e){const err=e as Error&{status?:number};return reply({error:/good deed limit/.test(err.message)?'合計ポイントの上限は100,000,000です':err.status?err.message:'いいことポイントを読みこめませんでした'},/good deed limit/.test(err.message)?409:err.status||500);}
}
