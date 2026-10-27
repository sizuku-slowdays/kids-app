import test from 'node:test';
import assert from 'node:assert/strict';
import {ownerCloudConfig} from '../scripts/configure-cloud-owner.mjs';
test('cloud owner configuration remains isolated, time-bound and protected on every route',()=>{
 const now=Date.parse('2026-10-26T12:00:00Z');
 const args=['--database-id','11111111-2222-3333-4444-555555555555','--origin','https://oshaberi.example.workers.dev','--issuer','https://owner-test.cloudflareaccess.com','--aud','a'.repeat(64),'--expires','2026-11-02T12:00:00Z'];
 const c=ownerCloudConfig(args,now);
 assert.equal(c.name,'oshaberi');assert.equal(c.vars.PRIVATE_TEST_MODE,'1');assert.equal(c.vars.REGISTRATION_ENABLED,'0');assert.equal(c.vars.INVITATIONS_ENABLED,'0');assert.equal(c.assets.run_worker_first,true);assert.equal(c.preview_urls,false);
 assert.deepEqual(c.d1_databases.map(d=>d.database_name),['oshaberi']);assert.deepEqual(c.r2_buckets.map(b=>b.bucket_name),['oshaberi']);
 for(const key of ['routes','services','triggers','secrets'])assert.equal(c[key],undefined);
 for(const [index,value] of [[1,'00000000-0000-0000-0000-000000000000'],[3,'https://home-worker.example.workers.dev'],[5,'https://untrusted.example'],[7,'short'],[9,'2026-10-01T12:00:00Z'],[9,'2026-12-01T12:00:00Z']]){const bad=[...args];bad[index]=value;assert.throws(()=>ownerCloudConfig(bad,now));}
 assert.throws(()=>ownerCloudConfig([...args,'--aud','b'.repeat(64)],now));
});
