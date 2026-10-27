// Runs in Cloudflare Builds. Writes configuration only; no API calls or DB writes.
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export function ownerCloudConfig(args,now=Date.now()){
 if(args.length!==10)throw Error('Expected --database-id UUID --origin URL --issuer URL --aud TAG --expires ISO_DATE');
 const options={};
 for(let i=0;i<args.length;i+=2){const key=args[i];if(!['--database-id','--origin','--issuer','--aud','--expires'].includes(key)||Object.hasOwn(options,key))throw Error('Unknown or duplicate option');options[key]=args[i+1];}
 const db=options['--database-id'],origin=options['--origin'],issuer=options['--issuer'],aud=options['--aud'],expires=Date.parse(options['--expires']);
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(db)||db==='00000000-0000-0000-0000-000000000000')throw Error('A dedicated database UUID is required');
 if(!/^https:\/\/oshaberi\.[a-z0-9-]+\.workers\.dev$/.test(origin))throw Error('Only the dedicated oshaberi workers.dev origin is allowed');
 if(!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer)||!/^[a-f0-9]{64}$/.test(aud))throw Error('Invalid Access issuer or audience');
 if(!Number.isFinite(expires)||expires<=now||expires>now+8*86400000)throw Error('Explicit test expiry must be in the next eight days');
 return {
  name:'oshaberi',main:'src/index.js',compatibility_date:'2026-10-01',compatibility_flags:['nodejs_compat'],workers_dev:true,preview_urls:false,
  assets:{directory:'public',binding:'ASSETS',run_worker_first:true},
  vars:{RELEASE_ENABLED:'1',REGISTRATION_ENABLED:'0',INVITATIONS_ENABLED:'0',PRIVATE_TEST_MODE:'1',PRIVATE_TEST_ORIGIN:origin,ACCESS_ISSUER:issuer,ACCESS_AUD:aud,TEST_EXPIRES_AT:String(Math.floor(expires/1000))},
  d1_databases:[{binding:'CHAT_DB',database_name:'oshaberi',database_id:db,migrations_dir:'migrations'}],
  r2_buckets:[{binding:'CHAT_FILES',bucket_name:'oshaberi'}],observability:{enabled:true}
 };
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const config=ownerCloudConfig(process.argv.slice(2));
 await writeFile(resolve(fileURLToPath(new URL('..',import.meta.url)),'.owner-cloud.jsonc'),JSON.stringify(config,null,2)+'\n');
 console.log('OWNER CONFIG READY: dedicated oshaberi only; external registration/invitations disabled. No API calls, schema imports or deployment performed.');
}
