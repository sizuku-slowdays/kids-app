// Corrections append a linked opposite entry. Original records are never overwritten.
const sources="'manual','chores','chores-repeat','chores-retry'";
export async function entryHistory(db:D1Database,account:string,h:string,adult:boolean,admin:boolean,before:string|null){
 const ledger=adult?'passbook_adult_entries':'passbook_entries';
 const link=adult?"q.source_app='entry-reversal' AND q.source_event=e.id":"(q.reversal_of=e.id OR (q.source_app='entry-reversal' AND q.source_event=e.id))";
 return (await db.prepare(`SELECT e.id,e.delta,e.memo,e.occurred_at,e.created_at,e.source_app,
 (SELECT q.id FROM ${ledger} q WHERE q.account_id=e.account_id AND ${link} LIMIT 1) reversal_id,
 CASE WHEN ?=1 AND e.delta>0 AND e.delta<=10000000 AND e.source_app IN (${sources}) ${adult?'':'AND e.reversal_of IS NULL'} AND NOT EXISTS(SELECT 1 FROM ${ledger} q WHERE q.account_id=e.account_id AND ${link}) THEN 1 ELSE 0 END can_reverse
 FROM ${ledger} e WHERE e.account_id=? AND e.household_id=? AND (? IS NULL OR (e.occurred_at,e.rowid)<(SELECT occurred_at,rowid FROM ${ledger} WHERE id=? AND account_id=?)) ORDER BY e.occurred_at DESC,e.rowid DESC LIMIT 50`).bind(admin?1:0,account,h,before,before,account).all()).results;
}
export async function reverseEntry(db:D1Database,h:string,actor:string,account:string,entry:string,reason:string){
 const adult=Boolean(await db.prepare('SELECT 1 FROM passbook_adult_accounts WHERE id=? AND household_id=?').bind(account,h).first());
 const ledger=adult?'passbook_adult_entries':'passbook_entries';
 const already=()=>db.prepare(`SELECT id FROM ${ledger} WHERE household_id=? AND account_id=? AND source_app='entry-reversal' AND source_event=?`).bind(h,account,entry).first();
 if(await already())return {ok:true,already_reversed:true};
 const original=await db.prepare(`SELECT id FROM ${ledger} WHERE id=? AND account_id=? AND household_id=? AND delta BETWEEN 1 AND 10000000 AND source_app IN (${sources}) ${adult?'':'AND reversal_of IS NULL AND NOT EXISTS(SELECT 1 FROM passbook_entries q WHERE q.reversal_of=passbook_entries.id)'}`).bind(entry,account,h).first();
 if(!original&&await already())return {ok:true,already_reversed:true};
 if(!original)throw Object.assign(Error('この履歴は取り消せないか、すでに取り消されています。履歴を確認してください'),{status:409});
 const now=Math.floor(Date.now()/1000);
 // One statement atomically checks available balance and appends the exact opposite amount.
 // Existing UNIQUE(account_id,source_app,source_event) and child reversal_of UNIQUE prevent double debit.
 const result=await db.prepare(`INSERT INTO ${ledger}(id,account_id,household_id,delta,memo,occurred_at,created_at,created_by,source_app,source_event${adult?'':',reversal_of'})
 SELECT ?,e.account_id,e.household_id,-e.delta,'取消：'||substr(e.memo,1,300)||' ／ '||?, ?,?,?, 'entry-reversal',e.id${adult?'':',e.id'} FROM ${ledger} e
 WHERE e.id=? AND e.account_id=? AND e.household_id=? AND e.delta BETWEEN 1 AND 10000000 AND e.source_app IN (${sources})
 ${adult?'':'AND e.reversal_of IS NULL AND NOT EXISTS(SELECT 1 FROM passbook_entries q WHERE q.reversal_of=e.id)'}
 AND EXISTS(SELECT 1 FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.group_id=e.household_id AND m.user_id=? AND m.role IN ('owner','admin') AND u.active=1)
 AND e.delta<=COALESCE((SELECT SUM(delta) FROM ${ledger} WHERE account_id=e.account_id),0)-COALESCE((SELECT SUM(cost) FROM passbook_requests WHERE account_id=e.account_id AND status='pending'),0)
 ON CONFLICT(account_id,source_app,source_event) DO NOTHING`).bind(crypto.randomUUID(),reason,new Date(now*1000).toISOString(),now,actor,entry,account,h,actor).run();
 if(!result.meta.changes&&!await already())throw Object.assign(Error('交換の確認待ち分を除いた残高が足りないため、取り消せません。残高と申請を確認してください'),{status:409});
 return {ok:true};
}
