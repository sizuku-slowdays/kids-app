# Existing HOME URL

`https://cetus.fun/wagaya/` is served directly by `home-worker` through the zone route `cetus.fun/wagaya/*`. It is not an iframe or a redirect to workers.dev.

`src/home-mount.ts` dispatches known HOME paths to the existing handler on the original request origin. It mounts HTML/JavaScript references, app metadata paths, protected reward image paths, relative redirect headers and the manifest at `/wagaya/`. It does not change stored data, IDs, balances, passwords or ownership checks. Origin checks remain exact and session cookies remain Secure/HttpOnly/SameSite with no shared Domain attribute.

The workers.dev entry continues to use root paths. A workers.dev cookie cannot be used on cetus.fun; existing users log in with their existing ID/password once on cetus.fun. No re-registration or database migration is required.

Legacy `/wagaya/old-home.html`, album, timetable, learning and static assets reach the existing GitHub Pages origin using the route's origin fetch. Unknown HOME API/app/media paths stay in the protected handler and never fall through to Pages. The old HOME footer points to `/wagaya/old-home.html`.

The mounted manifest keeps `/wagaya/` as its ID/start URL/scope for installed shortcuts. The replacement `/wagaya/sw.js` deletes only the old `wagaya-shell-*` caches and claims clients; it never caches private pages, API responses or images.

Validation: `npm run types`, `npm run check`, `npm test`. The mount integration test checks unauthenticated redirects/API denials, original-origin bootstrap and CSRF rejection, session/login/logout behavior, mounted HTML/JS/app metadata, manifest identity and private media denial. Existing financial and authorization tests remain unchanged.
