type BodyEnv=Env & {CALENDAR_SERVICE?:Fetcher};
export async function bodyIdentity(env:BodyEnv,user:{id:string;display_name:string},request:Request){
 const groups=(await env.DB.prepare("SELECT g.id,g.name,m.role FROM groups g JOIN memberships m ON m.group_id=g.id JOIN group_apps a ON a.group_id=g.id AND a.app_id='body-calendar' WHERE g.kind='household' AND m.user_id=? ORDER BY g.id").bind(user.id).all<{id:string;name:string;role:string}>()).results;
 const h=new URL(request.url).searchParams.get('group')||groups[0]?.id,g=groups.find(x=>x.id===h);
 if(!g)return Response.json({error:'この家庭では利用できません'},{status:403});
 const members=(await env.DB.prepare("SELECT u.id,u.display_name,CASE WHEN EXISTS(SELECT 1 FROM children c WHERE c.user_id=u.id) OR EXISTS(SELECT 1 FROM home_member_attributes a WHERE a.user_id=u.id AND a.age_kind='child') THEN 1 ELSE 0 END child FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.group_id=? AND u.active=1 ORDER BY u.created_at,u.id").bind(h).all<{id:string;display_name:string;child:number}>()).results;
 const self=members.find(x=>x.id===user.id),guardian=['owner','admin'].includes(g.role)&&self?.child===0;
 return Response.json({protocol:'body-home-v1',user:{id:user.id,display_name:user.display_name},groups,household_id:h,guardian,members:members.filter(x=>x.id===user.id||guardian&&x.child===1)},{headers:{'Cache-Control':'private, no-store'}});
}
export async function bodyProxy(env:BodyEnv,request:Request,userId:string){
 const expected=request.headers.get('X-Body-User');
 if(expected&&expected!==userId)return Response.json({error:'HOMEの利用者が変わりました。開き直してください',identity_changed:true},{status:409});
 if(!env.CALENDAR_SERVICE)return Response.json({error:'カレンダーWorkerの接続を確認してください'},{status:503});
 const url=new URL(request.url),path=url.pathname.slice('/api/body-calendar'.length)||'/status';
 if(!/^\/(?:status|profiles|records(?:\/\d+)?|predict|requests(?:\/\d+\/read)?|inventory|favorites(?:\/\d+)?)$/.test(path))return Response.json({error:'見つかりません'},{status:404});
 const headers=new Headers();for(const name of ['cookie','origin','content-type']){const v=request.headers.get(name);if(v)headers.set(name,v);}
 let payload:Uint8Array|undefined;
 if(!['GET','HEAD'].includes(request.method)){
  if(request.headers.get('Content-Type')?.split(';')[0]!=='application/json')return Response.json({error:'JSON形式で送信してください'},{status:415});
  const reader=request.body?.getReader();if(!reader)return Response.json({error:'入力がありません'},{status:400});
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>16384){await reader.cancel();return Response.json({error:'入力が大きすぎます'},{status:413});}chunks.push(value);}
  payload=new Uint8Array(size);let offset=0;for(const c of chunks){payload.set(c,offset);offset+=c.length;}
  try{const parsed=JSON.parse(new TextDecoder().decode(payload));if(!parsed||typeof parsed!=='object')throw Error();}catch{return Response.json({error:'入力を読み込めません'},{status:400});}
 }
 const r=await env.CALENDAR_SERVICE.fetch(new Request('https://body-calendar.internal/home-karada'+path+url.search,{method:request.method,headers,body:payload}));
 if(r.status===404&&path==='/status')return Response.json({error:'先にからだカレンダー対応のcalendar-workerを反映してください'},{status:503});
 return new Response(r.body,{status:r.status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
