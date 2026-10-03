import { passbookRoute } from "./passbook";
import { muscleRoute } from "./muscle-bank";
import {
  digest,
  randomToken,
  passwordHash,
  equal,
  validPassword,
  ITERATIONS,
} from "./security";

type HomeEnv = Env & { BOOTSTRAP_SECRET?: string };

type User = {
  id: string;
  login_name: string;
  display_name: string;
  platform_role: string;
  password_hash: string;
  password_salt: string;
  password_iterations: number;
};
type Session = { id: string; user_id: string; expires_at: number };
const SESSION_SECONDS = 180 * 86400;
const cookieName = "__Host-home_session";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};
function json(
  value: unknown,
  status = 200,
  extra: Record<string, string> = {},
) {
  return Response.json(value, { status, headers: { ...headers, ...extra } });
}
class Failure extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
function requireValue(
  condition: unknown,
  status: number,
  message: string,
): asserts condition {
  if (!condition) throw new Failure(status, message);
}
function name(value: unknown, max = 60) {
  requireValue(
    typeof value === "string" &&
      value.trim().length > 0 &&
      value.trim().length <= max,
    400,
    "入力内容を確認してください",
  );
  return value.trim();
}
function loginName(value: unknown) {
  const result = name(value, 40).toLowerCase();
  requireValue(
    /^[a-z0-9][a-z0-9_-]{2,39}$/.test(result),
    400,
    "ログインIDは英数字・_・-で3〜40文字です",
  );
  return result;
}
async function body(request: Request): Promise<Record<string, unknown>> {
  requireValue(
    request.headers.get("Content-Type")?.split(";")[0] === "application/json",
    415,
    "JSON形式で送信してください",
  );
  requireValue(
    Number(request.headers.get("Content-Length") || 0) <= 16384,
    413,
    "入力が大きすぎます",
  );
  const reader = request.body?.getReader();
  requireValue(reader, 400, "入力がありません");
  let length = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 16384) {
      await reader.cancel();
      throw new Failure(413, "入力が大きすぎます");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  let value;
  try {
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Failure(400, "入力を読み込めません");
  }
  requireValue(
    value && typeof value === "object" && !Array.isArray(value),
    400,
    "入力内容を確認してください",
  );
  return value;
}
async function throttle(env: HomeEnv, request: Request, scope: string) {
  const now = Math.floor(Date.now() / 1000);
  const window = Math.floor(now / 900);
  const bucket = await digest(
    `${scope}:${request.headers.get("CF-Connecting-IP") || "local"}:${window}`,
  );
  const result = await env.DB.prepare(
    "INSERT INTO auth_attempts(bucket,attempts,expires_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=attempts+1 RETURNING attempts",
  )
    .bind(bucket, now + 1800)
    .first<{ attempts: number }>();
  requireValue(
    result && result.attempts <= 12,
    429,
    "試行回数が多いため、15分ほど待ってください",
  );
}
async function session(env: HomeEnv, request: Request) {
  const value = request.headers
    .get("Cookie")
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(cookieName + "="))
    ?.slice(cookieName.length + 1);
  if (!value || !/^[a-f0-9]{64}$/.test(value)) return null;
  return env.DB.prepare(
    "SELECT s.id,s.user_id,s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND u.active=1",
  )
    .bind(await digest(value), Math.floor(Date.now() / 1000))
    .first<Session>();
}
async function currentUser(env: HomeEnv, s: Session) {
  return env.DB.prepare("SELECT * FROM users WHERE id=? AND active=1")
    .bind(s.user_id)
    .first<User>();
}
async function issueSession(env: HomeEnv, userId: string, device: string) {
  const token = randomToken(),
    now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    "INSERT INTO sessions(id,token_hash,user_id,device_name,created_at,last_seen_at,expires_at) VALUES (?,?,?,?,?,?,?)",
  )
    .bind(
      crypto.randomUUID(),
      await digest(token),
      userId,
      device,
      now,
      now,
      now + SESSION_SECONDS,
    )
    .run();
  return `${cookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_SECONDS}`;
}
async function appAllowed(env: HomeEnv, userId: string, appId: string) {
  return Boolean(
    await env.DB.prepare(
      "SELECT 1 FROM apps a WHERE a.id=? AND a.enabled=1 AND ((a.access_mode='personal' AND EXISTS(SELECT 1 FROM personal_app_access pa WHERE pa.app_id=a.id AND pa.user_id=?)) OR (a.access_mode='group' AND EXISTS(SELECT 1 FROM group_apps ga JOIN memberships m ON m.group_id=ga.group_id WHERE ga.app_id=a.id AND m.user_id=?))) LIMIT 1",
    )
      .bind(appId, userId, userId)
      .first(),
  );
}
export async function canRead(
  env: HomeEnv,
  userId: string,
  resourceId: string,
) {
  const resource = await env.DB.prepare("SELECT * FROM resources WHERE id=?")
    .bind(resourceId)
    .first<{
      app_id: string;
      owner_user_id: string | null;
      owner_group_id: string | null;
    }>();
  if (!resource || !(await appAllowed(env, userId, resource.app_id)))
    return false;
  if (resource.owner_user_id === userId) return true;
  if (
    resource.owner_group_id &&
    (await env.DB.prepare(
      "SELECT 1 FROM memberships WHERE group_id=? AND user_id=?",
    )
      .bind(resource.owner_group_id, userId)
      .first())
  )
    return true;
  return Boolean(
    await env.DB.prepare(
      "SELECT 1 FROM resource_grants g WHERE g.resource_id=? AND g.revoked_at IS NULL AND g.accepted_at IS NOT NULL AND (g.target_user_id=? OR EXISTS(SELECT 1 FROM memberships m WHERE m.group_id=g.target_group_id AND m.user_id=?)) LIMIT 1",
    )
      .bind(resourceId, userId, userId)
      .first(),
  );
}
async function route(request: Request, env: HomeEnv, mark: (stage: string) => void = () => {}) {
  const url = new URL(request.url),
    path = url.pathname,
    method = request.method;
  const now = Math.floor(Date.now() / 1000);
  // Every mutation requires the exact current origin. No cross-origin cookie API.
  if (!["GET", "HEAD"].includes(method))
    requireValue(
      request.headers.get("Origin") === url.origin,
      403,
      "このHOMEから操作してください",
    );
  if (path === "/api/bootstrap" && method === "POST") {
    mark("bootstrap_throttle");
    await throttle(env, request, "bootstrap");
    mark("bootstrap_validate");
    const data = await body(request);
    requireValue(
      env.BOOTSTRAP_SECRET &&
        typeof data.secret === "string" &&
        equal(data.secret, env.BOOTSTRAP_SECRET),
      403,
      "初期設定コードを確認してください",
    );
    requireValue(
      !(await env.DB.prepare(
        "SELECT 1 FROM users WHERE id='bootstrap-admin'",
      ).first()),
      409,
      "初期設定は完了しています",
    );
    const login = loginName(data.login_name),
      display = name(data.display_name),
      household = name(data.household_name);
    requireValue(
      validPassword(data.password),
      400,
      "パスワードは10〜128文字です",
    );
    mark("bootstrap_password");
    const salt = randomToken(),
      hash = passwordHash(data.password, salt),
      groupId = crypto.randomUUID();
    mark("bootstrap_database");
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO users(id,login_name,display_name,password_salt,password_hash,password_iterations,platform_role,created_at) VALUES ('bootstrap-admin',?,?,?,?,?,'operator',?)",
      ).bind(login, display, salt, hash, ITERATIONS, now),
      env.DB.prepare(
        "INSERT INTO groups(id,name,kind,created_by,created_at) VALUES (?,?,'household','bootstrap-admin',?)",
      ).bind(groupId, household, now),
      env.DB.prepare(
        "INSERT INTO memberships VALUES (?,'bootstrap-admin','owner')",
      ).bind(groupId),
      env.DB.prepare(
        "INSERT INTO group_apps SELECT ?,id FROM apps WHERE enabled=1 AND access_mode='group'",
      ).bind(groupId),
      env.DB.prepare("INSERT OR IGNORE INTO personal_app_access(user_id,app_id) SELECT 'bootstrap-admin',id FROM apps WHERE id='muscle-bank' AND access_mode='personal'"),
    ]);
    mark("bootstrap_session");
    return json({ ok: true }, 201, {
      "Set-Cookie": await issueSession(
        env,
        "bootstrap-admin",
        name(data.device_name || "最初の端末"),
      ),
    });
  }
  if (path === "/api/register" && method === "POST") {
    await throttle(env, request, "register");
    const data = await body(request);
    const inviteHash = await digest(name(data.invitation, 128));
    const invite = await env.DB.prepare(
      "SELECT id,group_id,child_id FROM invitations WHERE token_hash=? AND consumed_by IS NULL AND revoked_at IS NULL AND expires_at>?",
    )
      .bind(inviteHash, now)
      .first<{ id: string; group_id: string; child_id: string | null }>();
    requireValue(invite, 403, "招待コードが無効か期限切れです");
    const login = loginName(data.login_name),
      display = name(data.display_name);
    requireValue(
      validPassword(data.password),
      400,
      "パスワードは10〜128文字です",
    );
    const id = crypto.randomUUID(),
      salt = randomToken(),
      hash = passwordHash(data.password, salt);
    // Unique users.invitation_id plus a conditional INSERT makes redemption one-use even concurrently.
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO users(id,login_name,display_name,password_salt,password_hash,password_iterations,invitation_id,created_at) SELECT ?,?,?,?,?,?,?,? FROM invitations WHERE id=? AND consumed_by IS NULL AND revoked_at IS NULL AND expires_at>?",
      ).bind(
        id,
        login,
        display,
        salt,
        hash,
        ITERATIONS,
        invite.id,
        now,
        invite.id,
        now,
      ),
      env.DB.prepare(
        "INSERT INTO memberships(group_id,user_id,role) SELECT ?,id,'member' FROM users WHERE id=?",
      ).bind(invite.group_id, id),
      env.DB.prepare(
        "UPDATE invitations SET consumed_by=? WHERE id=? AND EXISTS(SELECT 1 FROM users WHERE id=?)",
      ).bind(id, invite.id, id),
      env.DB.prepare(
        "UPDATE children SET user_id=? WHERE id=? AND user_id IS NULL AND EXISTS(SELECT 1 FROM users WHERE id=?)",
      ).bind(id, invite.child_id, id),
    ]);
    requireValue(
      await env.DB.prepare("SELECT 1 FROM users WHERE id=?").bind(id).first(),
      409,
      "招待コードは使用済みです",
    );
    return json({ ok: true }, 201, {
      "Set-Cookie": await issueSession(
        env,
        id,
        name(data.device_name || "この端末"),
      ),
    });
  }
  if (path === "/api/login" && method === "POST") {
    await throttle(env, request, "login");
    const data = await body(request),
      login = loginName(data.login_name);
    // Also limit each login ID across IPs, so a password cannot be brute-forced through rotating addresses.
    const bucket = await digest(`account:${login}:${Math.floor(now / 900)}`);
    const counter = await env.DB.prepare(
      "INSERT INTO auth_attempts VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=attempts+1 RETURNING attempts",
    )
      .bind(bucket, now + 1800)
      .first<{ attempts: number }>();
    requireValue(
      counter && counter.attempts <= 20,
      429,
      "試行回数が多いため、15分ほど待ってください",
    );
    requireValue(
      typeof data.password === "string" && data.password.length <= 128,
      401,
      "ログインIDかパスワードを確認してください",
    );
    const user = await env.DB.prepare(
      "SELECT * FROM users WHERE login_name=? AND active=1",
    )
      .bind(login)
      .first<User>();
    const calculated = passwordHash(
      data.password,
      user?.password_salt || "dummy-salt-for-missing-account",
      user?.password_iterations || ITERATIONS,
    );
    requireValue(
      user && equal(calculated, user.password_hash),
      401,
      "ログインIDかパスワードを確認してください",
    );
    return json({ ok: true }, 200, {
      "Set-Cookie": await issueSession(
        env,
        user.id,
        name(data.device_name || "この端末"),
      ),
    });
  }
  const s = await session(env, request);
  if (path.startsWith("/api/") || path.startsWith("/media/"))
    requireValue(s, 401, "ログインしてください");
  if (s) {
    const user = await currentUser(env, s);
    requireValue(user, 401, "ログインしてください");
    if (path === "/api/passbook" || path.startsWith("/api/passbook/")) {
      requireValue(await appAllowed(env, user.id, "passbook"), 403, "このアプリは利用できません");
      return passbookRoute(request, env, user.id, body);
    }
    if (path === "/api/muscle-bank" || path.startsWith("/api/muscle-bank/")) {
      requireValue(await appAllowed(env, user.id, "muscle-bank"), 403, "このアプリは利用できません");
      return muscleRoute(request, env, user.id);
    }
    if (path === "/api/me" && method === "GET") {
      await env.DB.prepare("UPDATE sessions SET last_seen_at=? WHERE id=?")
        .bind(now, s.id)
        .run();
      const groups = await env.DB.prepare(
        "SELECT g.id,g.name,g.kind,m.role FROM groups g JOIN memberships m ON m.group_id=g.id WHERE m.user_id=?",
      )
        .bind(user.id)
        .all();
      return json({
        user: {
          id: user.id,
          display_name: user.display_name,
          login_name: user.login_name,
          platform_role: user.platform_role,
        },
        groups: groups.results,
      });
    }
    if (path === "/api/logout" && method === "POST") {
      await env.DB.prepare("UPDATE sessions SET revoked_at=? WHERE id=?")
        .bind(now, s.id)
        .run();
      return json({ ok: true }, 200, {
        "Set-Cookie": `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
      });
    }
    if (path === "/api/home" && method === "GET") {
      const result = await env.DB.prepare(
        "SELECT a.id,a.name,a.icon,a.path,a.status,COALESCE(ua.visible,1) visible,COALESCE(ua.position,a.position) position FROM apps a LEFT JOIN user_apps ua ON ua.app_id=a.id AND ua.user_id=? WHERE a.enabled=1 AND ((a.access_mode='personal' AND EXISTS(SELECT 1 FROM personal_app_access pa WHERE pa.app_id=a.id AND pa.user_id=?)) OR (a.access_mode='group' AND EXISTS(SELECT 1 FROM group_apps ga JOIN memberships m ON m.group_id=ga.group_id WHERE ga.app_id=a.id AND m.user_id=?))) ORDER BY position,a.id",
      )
        .bind(user.id, user.id, user.id)
        .all();
      return json(result.results);
    }
    if (path.startsWith("/api/home/") && method === "PUT") {
      const appId = path.slice("/api/home/".length);
      requireValue(
        await appAllowed(env, user.id, appId),
        403,
        "このアプリは利用できません",
      );
      const data = await body(request);
      requireValue(
        typeof data.visible === "boolean",
        400,
        "表示設定を確認してください",
      );
      await env.DB.prepare(
        "INSERT INTO user_apps(user_id,app_id,visible,position) VALUES (?,?,?,COALESCE((SELECT position FROM apps WHERE id=?),0)) ON CONFLICT(user_id,app_id) DO UPDATE SET visible=excluded.visible",
      )
        .bind(user.id, appId, data.visible ? 1 : 0, appId)
        .run();
      return json({ ok: true });
    }
    if (path === "/api/invitations" && method === "POST") {
      requireValue(
        user.platform_role === "operator",
        403,
        "招待は運営者が発行します",
      );
      const data = await body(request),
        groupId = name(data.group_id);
      requireValue(
        await env.DB.prepare(
          "SELECT 1 FROM memberships WHERE user_id=? AND group_id=? AND role IN ('owner','admin')",
        )
          .bind(user.id, groupId)
          .first(),
        403,
        "このグループに招待できません",
      );
      const childId = data.child_id ? name(data.child_id) : null;
      if (childId)
        requireValue(
          await env.DB.prepare(
            "SELECT 1 FROM children WHERE id=? AND household_id=? AND user_id IS NULL",
          )
            .bind(childId, groupId)
            .first(),
          400,
          "子どもの登録を確認してください",
        );
      const token = randomToken(),
        id = crypto.randomUUID();
      await env.DB.prepare(
        "INSERT INTO invitations(id,token_hash,issued_by,group_id,expires_at,created_at,child_id) VALUES (?,?,?,?,?,?,?)",
      )
        .bind(
          id,
          await digest(token),
          user.id,
          groupId,
          now + 7 * 86400,
          now,
          childId,
        )
        .run();
      return json({ id, invitation: token, expires_at: now + 7 * 86400 }, 201);
    }
    if (path.startsWith("/api/invitations/") && method === "DELETE") {
      requireValue(user.platform_role === "operator", 403, "操作できません");
      await env.DB.prepare(
        "UPDATE invitations SET revoked_at=? WHERE id=? AND issued_by=?",
      )
        .bind(now, path.slice("/api/invitations/".length), user.id)
        .run();
      return json({ ok: true });
    }
    if (path === "/api/sessions" && method === "GET") {
      const result = await env.DB.prepare(
        "SELECT id,device_name,created_at,last_seen_at,expires_at FROM sessions WHERE user_id=? AND revoked_at IS NULL AND expires_at>? ORDER BY created_at DESC",
      )
        .bind(user.id, now)
        .all();
      return json({ current: s.id, sessions: result.results });
    }
    if (path === "/api/children" && method === "GET") {
      const result = await env.DB.prepare(
        "SELECT c.id,c.household_id,c.display_name,c.user_id FROM children c JOIN memberships m ON m.group_id=c.household_id WHERE m.user_id=? AND m.role IN ('owner','admin')",
      )
        .bind(user.id)
        .all();
      return json(result.results);
    }
    if (path === "/api/children/accounts" && method === "GET") {
      const result = await env.DB.prepare("SELECT u.id,u.login_name,u.display_name,m.group_id household_id FROM users u JOIN memberships m ON m.user_id=u.id WHERE u.active=1 AND m.role='member' AND EXISTS(SELECT 1 FROM memberships a WHERE a.group_id=m.group_id AND a.user_id=? AND a.role IN ('owner','admin')) AND NOT EXISTS(SELECT 1 FROM children c WHERE c.user_id=u.id) ORDER BY u.login_name").bind(user.id).all();
      return json(result.results);
    }
    if (path.startsWith("/api/children/") && path.endsWith("/account") && method === "PUT") {
      const childId = path.slice("/api/children/".length, -"/account".length);
      const data = await body(request), target = name(data.user_id);
      const child = await env.DB.prepare("SELECT c.household_id,c.user_id FROM children c JOIN memberships m ON m.group_id=c.household_id WHERE c.id=? AND m.user_id=? AND m.role IN ('owner','admin')").bind(childId,user.id).first<{household_id:string;user_id:string|null}>();
      requireValue(child,403,"この子どもの連携は変更できません");
      requireValue(!child.user_id,409,"すでにアカウントが連携されています");
      const results = await env.DB.batch([
        env.DB.prepare("UPDATE children SET user_id=? WHERE id=? AND user_id IS NULL AND EXISTS(SELECT 1 FROM users u JOIN memberships m ON m.user_id=u.id WHERE u.id=? AND u.active=1 AND m.group_id=children.household_id AND m.role='member') AND NOT EXISTS(SELECT 1 FROM children c WHERE c.user_id=?)").bind(target,childId,target,target),
        env.DB.prepare("UPDATE invitations SET revoked_at=? WHERE child_id=? AND consumed_by IS NULL AND revoked_at IS NULL AND EXISTS(SELECT 1 FROM children WHERE id=? AND user_id=?)").bind(now,childId,childId,target),
      ]);
      requireValue(results[0].meta.changes>0,409,"同じ家庭の未連携アカウントを選んでください");
      return json({ok:true});
    }
    if (path === "/api/children" && method === "POST") {
      const data = await body(request),
        groupId = name(data.household_id),
        display = name(data.display_name);
      requireValue(
        await env.DB.prepare(
          "SELECT 1 FROM memberships m JOIN groups g ON g.id=m.group_id WHERE m.user_id=? AND m.group_id=? AND g.kind='household' AND m.role IN ('owner','admin')",
        )
          .bind(user.id, groupId)
          .first(),
        403,
        "この家庭には登録できません",
      );
      const id = crypto.randomUUID();
      await env.DB.prepare(
        "INSERT INTO children(id,household_id,display_name) VALUES (?,?,?)",
      )
        .bind(id, groupId, display)
        .run();
      return json({ id }, 201);
    }
    if (path.startsWith("/api/sessions/") && method === "DELETE") {
      const target = path.slice("/api/sessions/".length);
      await env.DB.prepare(
        "UPDATE sessions SET revoked_at=? WHERE id=? AND user_id=?",
      )
        .bind(now, target, user.id)
        .run();
      return json({ ok: true });
    }
    if (path.startsWith("/media/") && ["GET", "HEAD"].includes(method)) {
      const file = await env.DB.prepare(
        "SELECT * FROM private_files WHERE id=?",
      )
        .bind(path.slice("/media/".length))
        .first<{
          resource_id: string;
          object_key: string;
          content_type: string;
        }>();
      requireValue(
        file && (await canRead(env, user.id, file.resource_id)),
        404,
        "ファイルが見つかりません",
      );
      requireValue(
        [
          "image/png",
          "image/jpeg",
          "image/webp",
          "image/gif",
          "video/mp4",
          "video/webm",
        ].includes(file.content_type),
        415,
        "このファイル形式は配信できません",
      );
      const object = await env.PRIVATE_FILES.get(file.object_key);
      requireValue(object, 404, "ファイルが見つかりません");
      return new Response(method === "HEAD" ? null : object.body, {
        headers: {
          ...headers,
          "Content-Type": file.content_type,
          "Content-Disposition": "inline",
        },
      });
    }
  }
  if (path.startsWith("/api/") || path.startsWith("/media/"))
    throw new Failure(404, "見つかりません");
  if (path === "/apps/passbook" || path.startsWith("/apps/passbook/")) {
    if (!s) return new Response(null, {status:303,headers:{...headers,"X-Passbook-Version":"20261003-v1",Location:"/login"}});
    requireValue(await appAllowed(env,s.user_id,"passbook"),403,"このアプリは利用できません");
    requireValue(["GET","HEAD"].includes(method),405,"この操作はできません");
    const file=path.replace(/^\/apps\/passbook\/?/,"")||"index.html";
    requireValue(["index.html","app.js","style.css"].includes(file),404,"見つかりません");
    const assetUrl=new URL(url);assetUrl.pathname="/apps/passbook/"+file;
    const response=await env.ASSETS.fetch(new Request(assetUrl,{method}));
    const protectedHeaders=new Headers(response.headers);
    protectedHeaders.set("X-Passbook-Version","20261003-v1");
    for(const [key,value] of Object.entries(headers))protectedHeaders.set(key,value);
    return new Response(method==="HEAD"?null:response.body,{status:response.status,headers:protectedHeaders});
  }
  // Muscle app assets remain behind the same personal session and grant as its data API.
  if (path === "/apps/muscle-bank" || path.startsWith("/apps/muscle-bank/")) {
    if (!s) return new Response(null, {status:303, headers:{...headers, "X-Muscle-Bank-Version":"20261002-home-v1", Location:"/login"}});
    requireValue(await appAllowed(env, s.user_id, "muscle-bank"), 403, "このアプリは利用できません");
    requireValue(["GET", "HEAD"].includes(method), 405, "この操作はできません");
    if (path === "/apps/muscle-bank") return new Response(null, {status:303,headers:{...headers,Location:"/apps/muscle-bank/"}});
    const allowed = new Set(["index.html","app.js","style.css","model.js","storage.js","config.js","icon.svg","manifest.webmanifest"]);
    const file = path.replace(/^\/apps\/muscle-bank\/?/, "") || "index.html";
    requireValue(allowed.has(file), 404, "見つかりません");
    const assetUrl = new URL(url); assetUrl.pathname = "/apps/muscle-bank/" + file;
    const response = await env.ASSETS.fetch(new Request(assetUrl, {method}));
    const protectedHeaders = new Headers(response.headers);
    protectedHeaders.set("X-Muscle-Bank-Version", "20261002-home-v1");
    for (const [key,value] of Object.entries(headers)) protectedHeaders.set(key,value);
    protectedHeaders.set("Content-Security-Policy", headers["Content-Security-Policy"].replace("img-src 'self'", "img-src 'self' data: blob:"));
    return new Response(method === "HEAD" ? null : response.body, {status:response.status,headers:protectedHeaders});
  }
  // Only this explicit asset allowlist is public. Protected app paths do not fall through to static files.
  const publicPaths = [
    "/login",
    "/setup",
    "/register",
    "/app.js",
    "/style.css",
    "/manifest.webmanifest",
    "/icon.svg",
    "/home-icon-192.png",
    "/home-icon-512.png",
  ];
  if (!publicPaths.includes(path)) {
    if (!s)
      return new Response(null, {
        status: 303,
        headers: { ...headers, Location: "/login" },
      });
    if (path !== "/")
      throw new Failure(404, "このアプリはまだ移行されていません");
  }
  requireValue(["GET", "HEAD"].includes(method), 405, "この操作はできません");
  const assetUrl = new URL(url);
  if (["/", "/login", "/setup", "/register"].includes(path))
    assetUrl.pathname = "/index.html";
  const response = await env.ASSETS.fetch(new Request(assetUrl, { method }));
  const resultHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(headers))
    resultHeaders.set(key, value);
  return new Response(response.body, {
    status: response.status,
    headers: resultHeaders,
  });
}
export default {
  async fetch(request: Request, env: HomeEnv): Promise<Response> {
    let stage = "request";
    try {
      return await route(request, env, (value) => { stage = value; });
    } catch (error) {
      if (error instanceof Failure)
        return json({ error: error.message }, error.status);
      // Never log request bodies, cookies, invitation tokens or names.
      console.error(
        JSON.stringify({
          event: "home_request_failed",
          stage,
          reason: error instanceof Error
            ? /no such table/i.test(error.message) ? "database_missing_table"
            : /no such column/i.test(error.message) ? "database_missing_column"
            : /D1_|SQLITE/i.test(error.message) ? "database_error"
            : /iteration/i.test(error.message) ? "crypto_iteration_error"
            : /not implemented|not supported|unsupported/i.test(error.message) ? "unsupported_operation"
            : /undefined|null/i.test(error.message) ? "missing_value"
            : "unexpected_error"
            : "unexpected_error",
          path: new URL(request.url).pathname,
        }),
      );
      if (
        error instanceof Error &&
        /UNIQUE constraint failed/.test(error.message)
      )
        return json({ error: "登録済みのIDか、使用済みの招待です" }, 409);
      return json(
        { error: "処理できませんでした。しばらくしてから再試行してください" },
        500,
      );
    }
  },
  async scheduled(_event: ScheduledController, env: HomeEnv) {
    const now = Math.floor(Date.now() / 1000);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM auth_attempts WHERE expires_at<?").bind(now),
      env.DB.prepare(
        "DELETE FROM sessions WHERE expires_at<? OR revoked_at<?",
      ).bind(now, now - 30 * 86400),
    ]);
  },
} satisfies ExportedHandler<HomeEnv>;

