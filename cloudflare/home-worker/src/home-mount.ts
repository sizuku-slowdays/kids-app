// Serve the existing HOME handler at cetus.fun/wagaya/, without a redirect or iframe.
// Legacy HTML apps below /wagaya/ continue to reach the GitHub Pages origin.
const prefix = "/wagaya";
const internal = /^\/(?:api(?:\/|$)|media(?:\/|$)|apps(?:\/|$)|login(?:[?#]|$)|setup(?:[?#]|$)|register(?:[?#]|$)|(?:app\.js|style\.css|manifest\.webmanifest|home-icon-192\.png|home-icon-512\.png|icon\.svg)(?:[?#]|$)|(?:[?#]|$))/;
function mountedPath(value: string) {
  return internal.test(value) ? prefix + value : value;
}
function jsonLinks(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(jsonLinks);
  if (value && typeof value === "object") return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key,
      ["path", "image_path"].includes(key) && typeof item === "string" ? mountedPath(item) : jsonLinks(item),
    ]),
  );
  return value;
}
const worker = `self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(Promise.all([
  caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('wagaya-shell-')).map(key=>caches.delete(key)))),
  self.clients.claim()
])));
// Authenticated HOME and private images always use the network; never cache user data.
`;
const pwa = `if('serviceWorker' in navigator)navigator.serviceWorker.register('/wagaya/sw.js',{scope:'/wagaya/',updateViaCache:'none'}).catch(()=>{});`;
export async function mountedHome(request: Request, dispatch: (request: Request) => Promise<Response>): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.hostname !== "cetus.fun" || !url.pathname.startsWith(prefix + "/")) return null;
  const path = url.pathname.slice(prefix.length);
  if (path === "/sw.js" || path === "/mount-pwa.js") return new Response(request.method === "HEAD" ? null : path === "/sw.js" ? worker : pwa, {
    headers: {"Content-Type":"application/javascript; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"},
  });
  if (!internal.test(path) && path !== "/index.html" && path !== "/manifest.json") return fetch(request);
  const normalized = new URL(url);
  normalized.pathname = path === "/index.html" ? "/" : path === "/manifest.json" ? "/manifest.webmanifest" : path;
  const response = await dispatch(new Request(normalized, request));
  const headers = new Headers(response.headers);
  headers.set("X-Home-Mount", "wagaya-v1");
  headers.set("Cache-Control", "private, no-store");
  const location = headers.get("Location");
  if (location) headers.set("Location", mountedPath(location));
  if (request.method === "HEAD" || !response.body) return new Response(null, {status:response.status,headers});
  const type = headers.get("Content-Type") || "";
  let text: string;
  if (type.includes("application/json")) {
    text = JSON.stringify(jsonLinks(await response.json()));
  } else if (/html|javascript|manifest\+json/.test(type)) {
    text = await response.text();
    // Only known HOME root paths in quoted literals/attributes are mounted.
    // External URLs and relative imports, legacy /wagaya links, user data and regexes stay intact.
    text = text.replace(/(["'`])(\/(?:api|media|apps)(?:\/[^"'`\s<>]*)?|\/(?:login|setup|register|app\.js|style\.css|manifest\.webmanifest|home-icon-192\.png|home-icon-512\.png|icon\.svg)(?:[?#][^"'`\s<>]*)?|\/(?:[?#][^"'`\s<>]*)?)(?=["'`])/g,
      (_match, quote: string, value: string) => quote + mountedPath(value));
    if (type.includes("html")) text = text.replace("</head>", '<script src="/wagaya/mount-pwa.js" defer></script></head>');
    if (type.includes("manifest+json")) {
      const manifest = JSON.parse(text);
      if (normalized.pathname === "/manifest.webmanifest") Object.assign(manifest, {id:"/wagaya/",start_url:"/wagaya/",scope:"/wagaya/"});
      text = JSON.stringify(manifest);
    }
  } else return new Response(response.body, {status:response.status,headers});
  headers.delete("Content-Length");
  headers.delete("Content-Encoding");
  headers.delete("ETag");
  return new Response(text, {status:response.status,headers});
}
