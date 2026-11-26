// Build configuration for the existing oshaberi Worker. Runtime variables stay in Cloudflare.
import {writeFile} from 'node:fs/promises';

function productionConfig(databaseId) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(databaseId || '') ||
      databaseId === '00000000-0000-0000-0000-000000000000') {
    throw new Error('Pass the existing oshaberi D1 database UUID as --database-id.');
  }
  return {
    name: 'oshaberi',
    main: 'src/index.js',
    compatibility_date: '2026-10-01',
    compatibility_flags: ['nodejs_compat'],
    keep_vars: true,
    workers_dev: true,
    preview_urls: false,
    assets: {directory: 'public', binding: 'ASSETS', run_worker_first: true},
    d1_databases: [{binding: 'CHAT_DB', database_name: 'oshaberi', database_id: databaseId}],
    r2_buckets: [{binding: 'CHAT_FILES', bucket_name: 'oshaberi'}],
    observability: {enabled: true},
  };
}

const [flag, databaseId, ...extra] = process.argv.slice(2);
if (flag !== '--database-id' || extra.length) throw new Error('Usage: --database-id UUID');
const config = productionConfig(databaseId);
await writeFile(new URL('../.production-cloud.jsonc', import.meta.url), JSON.stringify(config, null, 2) + '\n');
