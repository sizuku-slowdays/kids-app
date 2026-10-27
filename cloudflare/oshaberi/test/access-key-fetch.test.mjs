import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {hash} from '../src/security.js';

test('real Workers runtime fetches trusted Access keys and refuses redirects and HTTP errors',async()=>{
 const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const jwk=await crypto.subtle.exportKey('jwk',pair.publicKey);jwk.kid='synthetic-test-key';
 const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
 for(const status of [200,302,503]){
  const issuer='https://keys-'+status+'.cloudflareaccess.com',now=Math.floor(Date.now()/1000);let outbound=0,assets=0;
  const message=b64({alg:'RS256',kid:jwk.kid})+'.'+b64({iss:issuer,aud:['synthetic-aud'],email:'owner@example.invalid',iat:now-1,exp:now+300});
  const jwt=message+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,Buffer.from(message))).toString('base64url');
  const mf=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:fileURLToPath(new URL('../.build/index.js',import.meta.url)),compatibilityDate:'2026-10-01',compatibilityFlags:['nodejs_compat'],
   bindings:{RELEASE_ENABLED:'1',PRIVATE_TEST_MODE:'1',REGISTRATION_ENABLED:'0',INVITATIONS_ENABLED:'0',PRIVATE_TEST_ORIGIN:'https://owner.test',ACCESS_ISSUER:issuer,ACCESS_AUD:'synthetic-aud',TEST_EXPIRES_AT:String(now+600),TEST_OWNER_EMAIL_SHA256:await hash('owner@example.invalid')},
   outboundService:req=>{outbound++;assert.equal(req.url,issuer+'/cdn-cgi/access/certs');return new Response(status===200?JSON.stringify({keys:[jwk]}):'',{status,headers:{'Content-Type':'application/json',...(status===302?{Location:'https://untrusted.example/keys'}:{})}});},
   serviceBindings:{ASSETS:()=>{assets++;return new Response('private asset');}}
  }));
  try{
   const response=await mf.dispatchFetch('https://owner.test/',{headers:{'Cf-Access-Jwt-Assertion':jwt}});
   assert.equal(response.status,status===200?200:403,await response.clone().text());
   assert.equal(outbound,1,'one fixed-issuer fetch; redirects are never followed');
   assert.equal(assets,status===200?1:0,'failed key fetch cannot access assets');
  }finally{await mf.dispose();}
 }
});
