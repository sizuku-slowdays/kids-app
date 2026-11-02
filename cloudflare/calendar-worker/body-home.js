// Embedded into calendar-worker.js by scripts/build-body-calendar-source.py. No public identity headers.
const BK_PROTOCOL='body-home-v1';
function bkCheck(value,message,status=400){if(!value)throw Object.assign(Error(message),{status});}
function bkText(value,max=1000){bkCheck(typeof value==='string'&&value.length<=max,'入力内容を確認してください');return value.trim();}
function bkDate(value){bkCheck(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value,'正しい日付を選んでください');return value;}
async function bkHash(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(b=>b.toString(16).padStart(2,'0')).join('');}
async function bkIdentity(request,env){
 bkCheck(new URL(request.url).hostname==='body-calendar.internal'&&env.HOME_AUTH,'HOMEから開いてください',403);
 if(!['GET','HEAD'].includes(request.method))bkCheck(['https://cetus.fun','https://home-worker.sslowdayss.workers.dev'].includes(request.headers.get('Origin')),'HOMEから操作してください',403);
 const u=new URL('https://body-auth.internal/api/body-calendar/identity');const group=new URL(request.url).searchParams.get('group');if(group)u.searchParams.set('group',group);
 const r=await env.HOME_AUTH.fetch(new Request(u,{headers:{Cookie:request.headers.get('Cookie')||''}}));bkCheck(r.ok,'HOMEにログインし、家庭の利用設定を確認してください',r.status===401?401:403);
 const i=await r.json();bkCheck(i.protocol===BK_PROTOCOL&&i.members.some(m=>m.id===i.user.id),'HOMEの本人情報を確認できません',403);return i;
}
async function bkProfile(env,i,target){
 const member=i.members.find(m=>m.id===target);bkCheck(member,'この人の記録は利用できません',403);
 bkCheck(target===i.user.id||i.guardian&&member.child===1,'この人の記録は利用できません',403);
 const link=await env.DB.prepare('SELECT * FROM home_karada_links WHERE household_id=? AND home_user_id=?').bind(i.household_id,target).first();bkCheck(link,'本人の連携・利用開始を設定してください',409);return {...link,member};
}
function bkAudit(env,i,action,target){return env.DB.prepare('INSERT INTO home_karada_changes VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),i.household_id,i.user.id,action,String(target),new Date().toISOString());}
async function bkOrigin(env){return (await env.DB.prepare('SELECT household_id FROM home_calendar_config WHERE id=1').first())?.household_id||null;}
async function bkStatus(env,i){
 const all=(await env.DB.prepare('SELECT home_user_id,period_user_id FROM home_karada_links WHERE household_id=?').bind(i.household_id).all()).results;
 const legacy=i.guardian&&await bkOrigin(env)===i.household_id?(await env.DB.prepare(`SELECT id,display_name,role,CASE WHEN role<>'mama' AND password_hash='CHANGE_ME' AND NOT EXISTS(SELECT 1 FROM period_records r WHERE r.user_id=period_users.id) AND NOT EXISTS(SELECT 1 FROM period_requests r WHERE r.user_id=period_users.id) AND NOT EXISTS(SELECT 1 FROM period_favorites f WHERE f.user_id=period_users.id) THEN 1 ELSE 0 END can_link_without_password FROM period_users WHERE NOT EXISTS(SELECT 1 FROM home_karada_links l WHERE l.period_user_id=period_users.id) ORDER BY id`).all()).results:[];
 return {protocol:BK_PROTOCOL,...i,members:i.members.map(m=>({...m,linked:all.some(l=>l.home_user_id===m.id)})),legacy_profiles:legacy};
}
async function bkCreate(env,i,data){
 const target=String(data.home_user_id||''),member=i.members.find(m=>m.id===target);bkCheck(member&&(target===i.user.id||i.guardian&&member.child===1),'この人の設定はできません',403);
 const prior=await env.DB.prepare('SELECT * FROM home_karada_links WHERE home_user_id=?').bind(target).first();if(prior){bkCheck(prior.household_id===i.household_id,'この本人は別の家庭で連携済みです',409);return json({ok:true,already_linked:true});}
 const now=new Date().toISOString();
 if(data.create===true){
  const username='home_'+crypto.randomUUID(),password=await bkHash(crypto.randomUUID()+crypto.randomUUID());
  // Explicit fields: no assumptions about legacy timestamp defaults. Validate role against real backup before rollout.
  await env.DB.batch([
   env.DB.prepare('INSERT INTO period_users(username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?)').bind(username,member.display_name,password,member.child?'child':'mama',now),
   env.DB.prepare('INSERT INTO home_karada_links SELECT ?,?,id,?,? FROM period_users WHERE username=?').bind(target,i.household_id,i.user.id,now,username),bkAudit(env,i,'profile.create',target)
  ]);return json({ok:true});
 }
 bkCheck(i.guardian&&await bkOrigin(env)===i.household_id,'既存アカウントの引き継ぎは元の家庭の管理者が行ってください',403);
 const bucket=Math.floor(Date.now()/600000);await env.DB.prepare('INSERT INTO home_karada_link_attempts VALUES(?,?,1) ON CONFLICT(actor,bucket) DO UPDATE SET count=count+1').bind(i.user.id,bucket).run();bkCheck((await env.DB.prepare('SELECT count FROM home_karada_link_attempts WHERE actor=? AND bucket=?').bind(i.user.id,bucket).first()).count<=10,'確認回数が多いため10分ほど待ってください',429);
 const old=await env.DB.prepare('SELECT * FROM period_users WHERE id=?').bind(Number(data.period_user_id)).first();bkCheck(old,'既存アカウントを選んでください',403);
 const emptyInitial=member.child===1&&old.role!=='mama'&&old.password_hash==='CHANGE_ME'&&!await env.DB.prepare('SELECT 1 FROM period_records WHERE user_id=? UNION ALL SELECT 1 FROM period_requests WHERE user_id=? UNION ALL SELECT 1 FROM period_favorites WHERE user_id=? LIMIT 1').bind(old.id,old.id,old.id).first();
 if(emptyInitial)bkCheck(data.confirm_unconfigured===true,'初期設定前・記録なしの本人を連携する確認が必要です',400);
 else {bkCheck(typeof data.password==='string'&&data.password.length<=128,'既存アカウントのパスワードを入力してください');bkCheck(old.password_hash===await bkHash(data.password),'既存アカウントとパスワードを確認してください',403);}
 bkCheck((old.role==='mama')===(!member.child),'保護者用・子ども用の対応を確認してください',409);
 try{await env.DB.batch([env.DB.prepare('INSERT INTO home_karada_links VALUES(?,?,?,?,?)').bind(target,i.household_id,old.id,i.user.id,now),bkAudit(env,i,'profile.link',target)]);}catch{throw Object.assign(Error('この本人は連携済みか、別の操作と重なりました。読み直してください'),{status:409});}
 return json({ok:true});
}
async function bkAdd(env,i,p,kind,data){
 const event=bkText(data.event_id,100);bkCheck(event.length>=8,'画面を開き直してください');
 let normalized;
 if(kind==='records'){
  const start=bkDate(data.start_date),end=data.end_date?bkDate(data.end_date):null;bkCheck(!end||end>=start,'終了日は開始日以降を選んでください');
  for(const [key,values]of [['flow_level',['light','normal','heavy']],['pain_level',['none','mild','bad']],['mood',['normal','irritated','sleepy','tired','sad']]])bkCheck(data[key]==null||values.includes(data[key]),'体調の選択内容を確認してください');
  normalized={user:p.period_user_id,start_date:start,end_date:end,flow_level:data.flow_level||null,pain_level:data.pain_level||null,mood:data.mood||null,memo:bkText(data.memo||'',2000)};
 }else{
  normalized={user:p.period_user_id};for(const k of ['day_pad','night_pad','heavy_pad','liner','painkiller']){const n=data[k]??0;bkCheck(Number.isInteger(n)&&n>=0&&n<=(k==='painkiller'?30:99),'枚数・錠数を確認してください');normalized[k]=n;}
  bkCheck(['sometime','soon','today'].includes(data.urgency),'急ぎ具合を選んでください');normalized.urgency=data.urgency;normalized.memo=bkText(data.memo||'',2000);
 }
 const hash=await bkHash(JSON.stringify(normalized)),now=new Date().toISOString(),table=kind==='records'?'period_records':'period_requests';
 const old=await env.DB.prepare('SELECT * FROM home_karada_operations WHERE household_id=? AND actor=? AND event_id=?').bind(i.household_id,i.user.id,event).first();
 if(old){bkCheck(old.kind===kind&&old.body_hash===hash,'同じ登録番号の内容が異なります。履歴を確認してください',409);return json({ok:true,id:old.result_id,already_saved:true});}
 const fields=Object.keys(normalized).filter(k=>k!=='user'),values=fields.map(k=>normalized[k]);
 const op=env.DB.prepare(`INSERT INTO home_karada_operations SELECT ?,?,?,?, ?,COALESCE((SELECT MAX(n) FROM (SELECT MAX(id) n FROM ${table} UNION ALL SELECT MAX(result_id) n FROM home_karada_operations WHERE kind='${kind}')),0)+1,? WHERE 1 ON CONFLICT(household_id,actor,event_id) DO NOTHING`).bind(i.household_id,i.user.id,event,kind,hash,now);
 const timestamps=kind==='records'?',created_at,updated_at':',created_at,is_read';
 const insert=env.DB.prepare(`INSERT INTO ${table}(id,user_id,${fields.join(',')}${timestamps}) SELECT result_id,?,${fields.map(()=>'?').join(',')},?${kind==='records'?',?':',0'} FROM home_karada_operations o WHERE household_id=? AND actor=? AND event_id=? AND kind=? AND body_hash=? AND NOT EXISTS(SELECT 1 FROM ${table} t WHERE t.id=o.result_id)`).bind(p.period_user_id,...values,now,...(kind==='records'?[now]:[]),i.household_id,i.user.id,event,kind,hash);
 await env.DB.batch([op,insert]);const saved=await env.DB.prepare('SELECT * FROM home_karada_operations WHERE household_id=? AND actor=? AND event_id=?').bind(i.household_id,i.user.id,event).first();bkCheck(saved.kind===kind&&saved.body_hash===hash,'同じ登録番号の内容が異なります',409);return json({ok:true,id:saved.result_id},201);
}
async function bkInventory(env,i){
 if(await bkOrigin(env)===i.household_id)return (await env.DB.prepare('SELECT * FROM period_inventory ORDER BY id').all()).results;
 return (await env.DB.prepare('SELECT * FROM home_karada_inventory WHERE household_id=? ORDER BY item_key').bind(i.household_id).all()).results;
}
async function homeBodyRoute(request,env){
 const url=new URL(request.url),path=url.pathname.slice('/home-karada'.length),method=request.method,i=await bkIdentity(request,env);
 const installed=await env.DB.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='home_karada_links'").first();bkCheck(installed,'先にからだカレンダーの追加テーブルを反映してください',503);
 if(path==='/status'&&method==='GET')return json(await bkStatus(env,i));
 const data=['GET','HEAD'].includes(method)?{}:await request.json();
 if(path==='/profiles'&&method==='POST')return bkCreate(env,i,data);
 if(path==='/inventory'){
  if(method==='GET')return json(await bkInventory(env,i));bkCheck(i.guardian&&method==='PUT','管理者だけが変更できます',403);bkCheck(Array.isArray(data)&&data.length<=30,'在庫の内容を確認してください');
  const legacy=await bkOrigin(env)===i.household_id,now=new Date().toISOString(),stmts=[];
  for(const row of data){bkCheck(Number.isInteger(row.quantity)&&row.quantity>=0&&row.quantity<=100000,'在庫数を確認してください');const key=bkText(row.item_key,80);if(legacy)stmts.push(env.DB.prepare('UPDATE period_inventory SET quantity=?,updated_at=? WHERE item_key=?').bind(row.quantity,now,key));else stmts.push(env.DB.prepare('INSERT INTO home_karada_inventory VALUES(?,?,?,?,3,?) ON CONFLICT(household_id,item_key) DO UPDATE SET quantity=excluded.quantity,updated_at=excluded.updated_at').bind(i.household_id,key,bkText(row.item_name||key,80),row.quantity,now));}
  await env.DB.batch([...stmts,bkAudit(env,i,'inventory.update',i.household_id)]);return json({ok:true});
 }
 if(path==='/requests'&&method==='GET'){
  const rows=(await env.DB.prepare('SELECT r.*,l.home_user_id FROM period_requests r JOIN home_karada_links l ON l.period_user_id=r.user_id WHERE l.household_id=? ORDER BY r.id DESC LIMIT 100').bind(i.household_id).all()).results;
  return json(rows.filter(r=>r.home_user_id===i.user.id||i.guardian&&i.members.some(m=>m.id===r.home_user_id&&m.child===1)).map(r=>({...r,display_name:i.members.find(m=>m.id===r.home_user_id)?.display_name||''})));
 }
 const read=path.match(/^\/requests\/(\d+)\/read$/);if(read&&method==='PUT'){
  bkCheck(i.guardian,'保護者だけが確認できます',403);const row=await env.DB.prepare('SELECT l.home_user_id FROM period_requests r JOIN home_karada_links l ON l.period_user_id=r.user_id WHERE r.id=? AND l.household_id=?').bind(Number(read[1]),i.household_id).first();bkCheck(row&&i.members.some(m=>m.id===row.home_user_id),'このお願いは確認できません',403);await env.DB.batch([env.DB.prepare('UPDATE period_requests SET is_read=1 WHERE id=?').bind(Number(read[1])),bkAudit(env,i,'request.read',read[1])]);return json({ok:true});
 }
 const target=url.searchParams.get('user')||i.user.id,p=await bkProfile(env,i,target);
 if(path==='/records'&&method==='GET')return json((await env.DB.prepare('SELECT * FROM period_records WHERE user_id=? ORDER BY start_date DESC,id DESC LIMIT 500').bind(p.period_user_id).all()).results);
 if((path==='/records'||path==='/requests')&&method==='POST'){bkCheck(path==='/records'||target===i.user.id,'お願いは本人として送ってください',403);return bkAdd(env,i,p,path.slice(1),data);}
 const record=path.match(/^\/records\/(\d+)$/);if(record&&['PUT','DELETE'].includes(method)){
  const old=await env.DB.prepare('SELECT * FROM period_records WHERE id=? AND user_id=?').bind(Number(record[1]),p.period_user_id).first();bkCheck(old,'記録が見つかりません',404);
  if(method==='DELETE'){await env.DB.batch([env.DB.prepare('INSERT INTO home_karada_record_trash VALUES(?,?,?,?,?,?)').bind(old.id,i.household_id,p.period_user_id,JSON.stringify(old),i.user.id,new Date().toISOString()),env.DB.prepare('DELETE FROM period_records WHERE id=? AND user_id=?').bind(old.id,p.period_user_id),bkAudit(env,i,'record.delete',old.id)]);return json({ok:true});}
  const start=bkDate(data.start_date),end=data.end_date?bkDate(data.end_date):null;bkCheck(!end||end>=start,'終了日は開始日以降を選んでください');for(const [k,v]of [['flow_level',['light','normal','heavy']],['pain_level',['none','mild','bad']],['mood',['normal','irritated','sleepy','tired','sad']]])bkCheck(data[k]==null||v.includes(data[k]),'体調を選び直してください');
  await env.DB.batch([env.DB.prepare('UPDATE period_records SET start_date=?,end_date=?,flow_level=?,pain_level=?,mood=?,memo=?,updated_at=? WHERE id=? AND user_id=?').bind(start,end,data.flow_level||null,data.pain_level||null,data.mood||null,bkText(data.memo||'',2000),new Date().toISOString(),old.id,p.period_user_id),bkAudit(env,i,'record.update',old.id)]);return json({ok:true});
 }
 if(path==='/predict'&&method==='GET'){
  const rows=(await env.DB.prepare('SELECT start_date,end_date FROM period_records WHERE user_id=? AND end_date IS NOT NULL ORDER BY start_date DESC LIMIT 12').bind(p.period_user_id).all()).results;if(!rows.length)return json({hasData:false});const cycles=rows.slice(0,-1).map((r,n)=>(Date.parse(r.start_date)-Date.parse(rows[n+1].start_date))/86400000),durations=rows.map(r=>(Date.parse(r.end_date)-Date.parse(r.start_date))/86400000+1),avg=values=>Math.round(values.reduce((a,b)=>a+b,0)/values.length),cycle=cycles.length?avg(cycles):28,duration=avg(durations),next=new Date(Date.parse(rows[0].start_date)+cycle*86400000).toISOString().slice(0,10);return json({hasData:true,avgCycle:cycle,avgDuration:duration,nextStart:next,lastStart:rows[0].start_date});
 }
 if(path==='/favorites'&&method==='GET')return json((await env.DB.prepare('SELECT * FROM period_favorites WHERE user_id=? ORDER BY id DESC').bind(p.period_user_id).all()).results);
 if(path==='/favorites'&&method==='POST'){await env.DB.batch([env.DB.prepare('INSERT INTO period_favorites(user_id,memo,created_at) VALUES(?,?,?)').bind(p.period_user_id,bkText(data.memo,2000),new Date().toISOString()),bkAudit(env,i,'favorite.create',target)]);return json({ok:true});}
 const fav=path.match(/^\/favorites\/(\d+)$/);if(fav&&method==='DELETE'){await env.DB.batch([env.DB.prepare('DELETE FROM period_favorites WHERE id=? AND user_id=?').bind(Number(fav[1]),p.period_user_id),bkAudit(env,i,'favorite.delete',target)]);return json({ok:true});}
 return err('見つかりません',404);
}
