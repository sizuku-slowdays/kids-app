import test from 'node:test';
import assert from 'node:assert/strict';
import {privateTestGate as gate} from '../src/private-test.js';
import {hash} from '../src/security.js';
import {readFile} from 'node:fs/promises';
const b64=v=>Buffer.from(typeof v==='string'?v:JSON.stringify(v)).toString('base64url');
test('owner private test validates signature, issuer, audience, owner, host and expiry before any route',async t=>{
 const diagnostic=[];t.mock.method(console,'warn',value=>diagnostic.push(value));
 const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const jwk=await crypto.subtle.exportKey('jwk',pair.publicKey);jwk.kid='test-key';
 const env={PRIVATE_TEST_MODE:'1',REGISTRATION_ENABLED:'0',INVITATIONS_ENABLED:'0',PRIVATE_TEST_ORIGIN:'https://owner.test',ACCESS_ISSUER:'https://test.cloudflareaccess.com',ACCESS_AUD:'aud-test',TEST_EXPIRES_AT:'2000',TEST_OWNER_EMAIL_SHA256:await hash('owner@example.invalid'),ACCESS_JWKS_JSON:JSON.stringify({keys:[jwk]})};
 const claims={iss:env.ACCESS_ISSUER,aud:['aud-test'],email:'owner@example.invalid',iat:900,exp:1100};
 async function jwt(p=claims,h={alg:'RS256',kid:jwk.kid}){const message=b64(h)+'.'+b64(p);return message+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,Buffer.from(message))).toString('base64url');}
 const privateTestGate=(req,env,now)=>gate(req,env,now,async()=>JSON.parse(env.ACCESS_JWKS_JSON||'{}'));
 const valid=await jwt(),req=(raw=valid,host='https://owner.test',path='/')=>new Request(host+path,{headers:{'Cf-Access-Jwt-Assertion':raw}});
 for(const path of ['/','/api/me','/media/test','/app.js','/sw.js'])await privateTestGate(req(valid,undefined,path),env,1000);
 for(const p of [{...claims,email:'stranger@example.invalid'},{...claims,exp:999},{...claims,iss:'https://other.cloudflareaccess.com'},{...claims,aud:['other']},{...claims,nbf:1001},{...claims,iat:1200}])await assert.rejects(privateTestGate(req(await jwt(p)),env,1000));
 for(const raw of ['',valid.slice(0,-5),b64({alg:'none'})+'.'+b64(claims)+'.bad'])await assert.rejects(privateTestGate(req(raw),env,1000));
 await assert.rejects(privateTestGate(req(valid,'https://bypass.test'),env,1000));
 for(const extra of [{INVITATIONS_ENABLED:'1'},{REGISTRATION_ENABLED:'1'},{ACCESS_JWKS_JSON:'{}'},{TEST_EXPIRES_AT:'999'},{TEST_OWNER_EMAIL_SHA256:''}])await assert.rejects(privateTestGate(req(),{...env,...extra},1000));
 await assert.rejects(privateTestGate(req(await jwt({...claims,email:'stranger@example.invalid'})),env,1000),/確認コード：OWNER/);
 await assert.rejects(privateTestGate(req(await jwt({...claims,aud:['other']})),env,1000),/確認コード：AUDIENCE/);
 assert.ok(diagnostic.every(v=>Object.keys(v).sort().join(',')==='event,reason'&&v.event==='oshaberi_owner_gate_failed'&&/^[A-Z_]+$/.test(v.reason)));
 assert.doesNotMatch(JSON.stringify(diagnostic),/example\.invalid|test-key|aud-test/);
 await privateTestGate(req(''),{},1000);
 const source=await readFile(new URL('../src/index.js',import.meta.url),'utf8');assert.ok(source.indexOf('await privateTestGate(req,env)')<source.indexOf('return env.ASSETS.fetch(req)'));
 const c=JSON.parse((await readFile(new URL('../wrangler.private-test.jsonc',import.meta.url),'utf8')).replace(/^\s*\/\/.*$/gm,''));assert.equal(c.workers_dev,false);assert.equal(c.preview_urls,false);assert.equal(c.vars.RELEASE_ENABLED,'0');assert.equal(c.vars.PRIVATE_TEST_MODE,'1');assert.equal(c.vars.TEST_EXPIRES_AT,'0');assert.equal(c.services,undefined);assert.equal(c.routes,undefined);
});
