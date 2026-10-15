import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source = await readFile(new URL('../cloudflare/iikoto-api/retired-worker.js', import.meta.url), 'utf8');
const {default: worker} = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const env = new Proxy({}, {get() {throw new Error('No production storage access allowed');}});
test('all legacy read/write paths stop without reading private records or changing DB', async () => {
  for (const path of ['/api/iikoto?owner=saru', '/api/iikoto?owner=unicorn', '/api/iikoto/1']) {
    for (const method of ['GET', 'POST', 'DELETE']) {
      const response = await worker.fetch(new Request('https://legacy.example' + path, {method}), env);
      assert.equal(response.status, 410);
      const body = await response.json();
      assert.equal(body.error, 'legacy_api_retired');
      assert.equal('records' in body, false);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
    }
  }
});
test('preflight works and unknown paths remain 404', async () => {
  assert.equal((await worker.fetch(new Request('https://legacy.example/api/iikoto', {method:'OPTIONS'}), env)).status,204);
  assert.equal((await worker.fetch(new Request('https://legacy.example/other'), env)).status,404);
});
