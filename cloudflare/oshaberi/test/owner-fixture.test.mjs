import {fileURLToPath} from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {passwordHash} from '../src/security.js';
test('offline four-account fixture keeps approvals and safety settings closed; re-import cannot reset accounts',async()=>{
 const root=await mkdtemp(join(tmpdir(),'oshaberi-fixture-')),folder=join(root,'private');
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("fixture")}}',d1Databases:{CHAT_DB:'synthetic-only'}}));
 try{
 execFileSync(process.execPath,[fileURLToPath(new URL('../scripts/prepare-owner-test.mjs',import.meta.url)),folder]);
 const secrets=JSON.parse(await readFile(join(folder,'owner-test-credentials.PRIVATE.json'),'utf8'));
 const db=await mf.getD1Database('CHAT_DB'),schema=await readFile(new URL('../migrations/0001_chat.sql',import.meta.url),'utf8');
 for(const s of schema.replace(/^--.*$/gm,'').match(/\s*CREATE TRIGGER[\s\S]*?\nEND;|[^;]+;/g)||[])await db.prepare(s).run();
 const seed=await readFile(join(folder,'owner-test-seed.PRIVATE.sql'),'utf8'),statements=seed.split(';').map(s=>s.trim()).filter(Boolean);
 await db.batch(statements.map(s=>db.prepare(s)));
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM accounts').first()).n,4);
 for(const item of secrets.accounts){const a=await db.prepare('SELECT * FROM accounts WHERE login=?').bind(item.login).first();assert.equal(await passwordHash(item.password,a.salt),a.password_hash);}
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM child_settings WHERE photos_enabled=0 AND schedule_json=?').bind('[[],[],[],[],[],[],[]]').first()).n,2);
 const f=await db.prepare('SELECT * FROM friendships').first();assert.equal(f.state,'pending');assert.equal(f.left_approved+f.right_approved,0);
 await assert.rejects(db.batch(statements.map(s=>db.prepare(s))));
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM accounts').first()).n,4);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM invitations').first()).n,0);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM messages').first()).n,0);
 }finally{await mf.dispose();await rm(root,{recursive:true,force:true});}
});
