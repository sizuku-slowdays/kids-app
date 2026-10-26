// Offline only. Creates synthetic accounts for ONE operator, never calls Cloudflare.
import {mkdir,writeFile,access} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {passwordHash,hash,token,uid} from '../src/security.js';
const dir=process.argv[2];if(!dir||process.argv.length!==3)throw Error('Usage: node scripts/prepare-owner-test.mjs <new-private-folder>');
const folder=resolve(dir);try{await access(folder);throw Error('Output folder already exists; choose a new private folder');}catch(e){if(e.code!=='ENOENT')throw e;}
await mkdir(folder,{recursive:true,mode:0o700});
const q=s=>"'"+String(s).replaceAll("'","''")+"'",now=Date.now(),families=[uid(),uid()],people=[],secrets=[];
for(let i=0;i<4;i++){const guardian=i%2===0,letter=i<2?'A':'B',login='test_'+(guardian?'parent_':'child_')+letter.toLowerCase(),id=uid(),salt=token(),password=token(),recovery=guardian?token():null;people.push({id,login,alias:(guardian?'保護者':'こども')+letter+'（テスト）',role:guardian?'guardian':'child',salt,pw:await passwordHash(password,salt),recovery:recovery?await hash(recovery):null});secrets.push({login,password,...(recovery?{recovery_code:recovery}:{})});}
const sql=["PRAGMA foreign_keys=ON;","CREATE TABLE oshaberi_owner_fixture_guard(value INTEGER NOT NULL CHECK(value=1));","INSERT INTO oshaberi_owner_fixture_guard SELECT CASE WHEN (SELECT COUNT(*) FROM accounts)=0 AND (SELECT COUNT(*) FROM families)=0 AND (SELECT COUNT(*) FROM messages)=0 AND (SELECT COUNT(*) FROM invitations)=0 THEN 1 ELSE 0 END;"];
for(const f of families)sql.push(`INSERT INTO families VALUES(${q(f)},${now});`);
for(const p of people)sql.push(`INSERT INTO accounts VALUES(${[p.id,p.login,p.alias,p.role,p.salt,p.pw].map(q).join(',')},${p.recovery?q(p.recovery):'NULL'},1,${now},NULL);`);
for(let i=0;i<2;i++){const parent=people[i*2],child=people[i*2+1];sql.push(`INSERT INTO family_guardians VALUES(${q(families[i])},${q(parent.id)});`,`INSERT INTO guardian_children VALUES(${q(parent.id)},${q(child.id)},${q(families[i])});`,`INSERT INTO child_settings(child_id) VALUES(${q(child.id)});`,`INSERT INTO consent_events VALUES(${q(uid())},${q(parent.id)},${q(child.id)},'owner-only-simulation-v1',${now});`);}
const children=[people[1].id,people[3].id].sort();sql.push(`INSERT INTO friendships VALUES(${q(uid())},${q(children[0])},${q(children[1])},0,0,'pending',${now});`);
await writeFile(join(folder,'owner-test-seed.PRIVATE.sql'),sql.join('\n')+'\n',{mode:0o600,flag:'wx'});
await writeFile(join(folder,'owner-test-credentials.PRIVATE.json'),JSON.stringify({warning:'Synthetic local credentials. Do not upload to GitHub/chat. Only import into a NEW empty oshaberi-owner-test DB after approval.',accounts:secrets},null,2),{mode:0o600,flag:'wx'});
console.log('READY: synthetic seed and four private logins saved. No network, deployment, migration or invitation performed. Both guardian approvals, hours and photo settings still required.');
