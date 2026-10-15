// Deploy to the legacy iikoto-api only after the HOME replacement is verified.
// Deliberately never read or write DB: old records remain archived in mama-bank-db.
export default {
  async fetch(request) {
    const path = new URL(request.url).pathname;
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    const legacy = path === '/api/iikoto' || /^\/api\/iikoto\/\d+$/.test(path);
    if (legacy && request.method === 'OPTIONS') return new Response(null, {status: 204, headers});
    return new Response(JSON.stringify(legacy ? {
      error: 'legacy_api_retired',
      message: '我が家HOMEの「いいことポイント」を開いてください。旧記録は保管されています。',
      home_url: 'https://cetus.fun/wagaya/apps/good-deeds/',
    } : {error: 'Not Found'}), {status: legacy ? 410 : 404, headers});
  },
};
