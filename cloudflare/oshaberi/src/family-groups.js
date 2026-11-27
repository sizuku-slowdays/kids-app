import {ensure,uid,body,DAY,STANDARD_STAMPS,quota} from './security.js';
const json=v=>Response.json(v,{headers:{'Cache-Control':'no-store'}});
const all=async q=>(await q.all()).results;
const eligible=`SELECT account_id FROM (
 SELECT g.id AS account_id FROM family_groups f JOIN family_guardians fg ON fg.family_id=f.family_id AND fg.guardian_id=f.creator_id JOIN accounts g ON g.id=fg.guardian_id AND g.active=1 AND g.role='guardian' WHERE f.id=?
 UNION SELECT c.id FROM family_groups f JOIN guardian_children gc ON gc.family_id=f.family_id AND gc.guardian_id=f.creator_id JOIN accounts c ON c.id=gc.child_id AND c.active=1 AND c.role='child' WHERE f.id=?
)`;
export async function groupsReady(db){return !!await db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='family_group_messages'").first();}
export async function familyGroups(req,db,a,childAvailable){
 const u=new URL(req.url),p=u.pathname,method=req.method;
 if(!p.startsWith('/api/family-groups'))return null;
 if(!await groupsReady(db)){if(p==='/api/family-groups'&&method==='GET')return json({groups:[],ready:false});ensure(false,'家族トークの準備中です',503);}
 if(a.role==='child')await childAvailable(db,a.id);
 if(p==='/api/family-groups'&&method==='POST'){
  ensure(a.role==='guardian','おうちの人が作ってください',403);
  const {member_ids}=await body(req);
  ensure(Array.isArray(member_ids)&&member_ids.length>=1&&member_ids.length<=12&&member_ids.every(x=>typeof x==='string')&&new Set(member_ids).size===member_ids.length,'参加する子どもを選んでください');
  const children=await all(db.prepare('SELECT gc.child_id,gc.family_id FROM guardian_children gc JOIN accounts c ON c.id=gc.child_id AND c.active=1 WHERE gc.guardian_id=?').bind(a.id));
  const picked=member_ids.map(id=>children.find(c=>c.child_id===id));ensure(picked.every(c=>c&&c.family_id===picked[0].family_id),'同じ家庭の子どもを選んでください',403);
  const family=picked[0].family_id, id=uid();
  for(let i=0;i<member_ids.length;i++)for(let j=i+1;j<member_ids.length;j++){
   const [l,r]=[member_ids[i],member_ids[j]];
   ensure(!await db.prepare('SELECT 1 FROM blocks WHERE (child_id=? AND peer_id=?) OR (child_id=? AND peer_id=?)').bind(l,r,r,l).first(),'ブロック中の子どもは同じトークに追加できません',403);
  }
  // A repeated create is idempotent; membership of an established conversation is never silently expanded.
  const existing=await db.prepare('SELECT id FROM family_groups WHERE creator_id=? AND family_id=?').bind(a.id,family).first();
  if(existing)return json({id:existing.id});
  const ops=[db.prepare('INSERT INTO family_groups VALUES(?,?,?,?)').bind(id,family,a.id,Date.now()),...[a.id,...member_ids].map(member=>db.prepare('INSERT INTO family_group_members VALUES(?,?)').bind(id,member))];
  try{await db.batch(ops);}catch(e){const prior=await db.prepare('SELECT id FROM family_groups WHERE creator_id=? AND family_id=?').bind(a.id,family).first();if(prior)return json({id:prior.id});throw e;}
  return json({id});
 }
 if(p==='/api/family-groups'&&method==='GET'){
  const groups=await all(db.prepare('SELECT f.id FROM family_groups f JOIN family_group_members m ON m.group_id=f.id WHERE m.account_id=?').bind(a.id));
  const result=[];
  for(const g of groups){
   const members=await all(db.prepare('SELECT a.id,a.alias FROM family_group_members m JOIN accounts a ON a.id=m.account_id WHERE m.group_id=? AND a.id IN('+eligible+') ORDER BY a.role DESC,a.created_at').bind(g.id,g.id,g.id));
   if(members.some(m=>m.id===a.id))result.push({...g,members});
  }
  return json({groups:result,ready:true});
 }
 const m=p.match(/^\/api\/family-groups\/([^/]+)\/messages$/);if(!m)return null;
 const id=m[1];
 if(a.role==='child')ensure(!await db.prepare(`SELECT 1 FROM blocks b JOIN family_group_members m ON m.group_id=? AND ((b.child_id=? AND b.peer_id=m.account_id) OR (b.peer_id=? AND b.child_id=m.account_id))`).bind(id,a.id,a.id).first(),'この家族トークは一時停止中です',403);
 ensure(await db.prepare('SELECT 1 FROM family_group_members WHERE group_id=? AND account_id=? AND account_id IN('+eligible+')').bind(id,a.id,id,id).first(),'この家族トークは利用できません',403);
 if(method==='GET'){
  const after=Number(u.searchParams.get('after')||0),before=Number(u.searchParams.get('before')||Number.MAX_SAFE_INTEGER);
  ensure(Number.isSafeInteger(after)&&after>=0&&Number.isSafeInteger(before)&&before>0,'表示位置を確認してください');
  const rows=await all(db.prepare('SELECT m.seq,m.author_id,a.alias AS author_alias,m.kind,m.text,m.created_at FROM family_group_messages m JOIN accounts a ON a.id=m.author_id WHERE m.group_id=? AND m.seq>? AND m.seq<? AND m.created_at>? ORDER BY m.seq '+(after?'ASC':'DESC')+' LIMIT 100').bind(id,after,before,Date.now()-180*DAY));
  const recalled=await all(db.prepare("SELECT seq FROM family_group_messages WHERE group_id=? AND text='' AND created_at>?").bind(id,Date.now()-180*DAY));
  return json({messages:after?rows:rows.reverse(),recalled:recalled.map(r=>r.seq)});
 }
 if(method==='DELETE'){
  ensure(a.role==='guardian','送信取消はおうちの人だけができます',403);
  const {seq}=await body(req);
  ensure(Number.isSafeInteger(seq)&&seq>0,'メッセージを確認してください');
  const result=await db.prepare("UPDATE family_group_messages SET text='' WHERE group_id=? AND seq=? AND created_at>? AND EXISTS(SELECT 1 FROM family_groups WHERE id=? AND creator_id=?)").bind(id,seq,Date.now()-180*DAY,id,a.id).run();
  ensure(result.meta.changes===1,'メッセージを確認してください',404);
  return json({ok:true});
 }
 if(method==='POST'){
  const b=await body(req),text=b.kind==='standard'?b.stamp:b.text;
  ensure((b.kind==='text'&&typeof text==='string'&&text.trim()&&text.length<=2000)||(b.kind==='standard'&&Object.hasOwn(STANDARD_STAMPS,text)),'メッセージまたはスタンプを確認してください');
  ensure(typeof b.nonce==='string'&&/^[a-zA-Z0-9_-]{16,80}$/.test(b.nonce),'送信番号を確認してください');
  const old=await db.prepare('SELECT * FROM family_group_messages WHERE author_id=? AND nonce=?').bind(a.id,b.nonce).first();
  if(old){ensure(old.group_id===id&&(old.text===''||(old.kind===b.kind&&old.text===text)),'送信番号が重複しています',409);return json({seq:old.seq});}
  await quota(db,'message-minute:'+a.id,12,60000);await quota(db,'message-day:'+a.id,240,DAY);
  await db.prepare(`INSERT OR IGNORE INTO family_group_messages(group_id,author_id,nonce,kind,text,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM family_group_members WHERE group_id=? AND account_id=? AND account_id IN(${eligible})) AND EXISTS(SELECT 1 FROM accounts a WHERE a.id=? AND a.active=1 AND (a.role='guardian' OR EXISTS(SELECT 1 FROM child_settings s WHERE s.child_id=a.id AND s.paused=0)))`).bind(id,a.id,b.nonce,b.kind,text,Date.now(),id,a.id,id,id,a.id).run();
  const saved=await db.prepare('SELECT * FROM family_group_messages WHERE author_id=? AND nonce=?').bind(a.id,b.nonce).first();
  ensure(saved&&saved.group_id===id&&saved.kind===b.kind&&saved.text===text,'送信できませんでした',409);
  return json({seq:saved.seq});
 }
 return null;
}
