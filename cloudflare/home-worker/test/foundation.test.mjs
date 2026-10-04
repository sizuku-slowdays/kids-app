import { initialState } from "../public/apps/muscle-bank/model.js";
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";

test("invitation, personal sessions, home settings and private file boundaries", async () => {
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      name: "home-worker",
      modules: true,
      scriptPath: new URL("../.wrangler/test-build/index.js", import.meta.url)
        .pathname,
      compatibilityDate: "2026-10-01",
      compatibilityFlags: ["nodejs_compat"],
      d1Databases: { DB: "home-test" },
      r2Buckets: ["PRIVATE_FILES"],
      bindings: { BOOTSTRAP_SECRET: "test-bootstrap-secret" },
      serviceBindings: { ASSETS: () => new Response("public-shell") },
    }),
  );
  try {
    const db = await mf.getD1Database("DB");
    // D1 exec accepts one statement per line; migrations with triggers are applied through prepare/run.
    const initial = await readFile(
      new URL("../migrations/0001_foundation.sql", import.meta.url),
      "utf8",
    );
    for (const statement of initial.split(";").filter((s) => s.trim()))
      await db.prepare(statement).run();
    const triggers = await readFile(
      new URL("../migrations/0002_integrity.sql", import.meta.url),
      "utf8",
    );
    for (const statement of triggers.split("\nEND;").filter((s) => s.trim()))
      await db.prepare(statement + "\nEND;").run();
    const muscleMigration = await readFile(new URL("../migrations/0003_muscle_bank.sql", import.meta.url), "utf8");
    for (const statement of muscleMigration.replace(/^--.*$/gm, "").split(";").filter(s => s.trim())) await db.prepare(statement).run();
    const kidneyMigration=await readFile(new URL('../migrations/0008_kidney.sql',import.meta.url),'utf8');
    for(const statement of kidneyMigration.replace(/^--.*$/gm,'').split(';').filter(s=>s.trim()))await db.prepare(statement).run();
    const bucket = await mf.getR2Bucket("PRIVATE_FILES");
    async function call(
      path,
      {
        method = "GET",
        body,
        cookie,
        origin = "https://home.test",
        ip = "192.0.2.1",
        extraHeaders = {},
      } = {},
    ) {
      const res = await mf.dispatchFetch("https://home.test" + path, {
        method,
        headers: {
          ...extraHeaders,
          Origin: origin,
          "CF-Connecting-IP": ip,
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        redirect: "manual",
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
      return {
        status: res.status,
        data,
        headers: res.headers,
        cookie: res.headers.get("Set-Cookie")?.split(";")[0],
      };
    }
    assert.equal((await call("/")).status, 303);
    assert.equal((await call("/api/me")).status, 401);
    assert.equal((await call("/media/private-image")).status, 401);
    assert.equal((await call("/index.html")).status, 303);
    const admin = await call("/api/bootstrap", {
      method: "POST",
      body: {
        secret: "test-bootstrap-secret",
        login_name: "mama",
        display_name: "非公開の親",
        household_name: "家庭A",
        password: "admin-password-123",
        device_name: "親のiPhone",
      },
    });
    assert.equal(admin.status, 201);
    assert.match(
      admin.headers.get("Set-Cookie"),
      /HttpOnly; Secure; SameSite=Lax/,
    );
    const profile = await call("/api/me", { cookie: admin.cookie });
    assert.equal(profile.data.user.display_name, "非公開の親");
    const groupA = profile.data.groups[0].id;
    assert.equal(
      (
        await call("/api/bootstrap", {
          method: "POST",
          body: { secret: "test-bootstrap-secret" },
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await call("/api/invitations", {
          method: "POST",
          cookie: admin.cookie,
          origin: "https://evil.test",
          body: { group_id: groupA },
        })
      ).status,
      403,
    );
    const child = await call("/api/children", {
      method: "POST",
      cookie: admin.cookie,
      body: { household_id: groupA, display_name: "非公開の子" },
    });
    assert.equal(child.status, 201);
    async function invite(group, childId) {
      return call("/api/invitations", {
        method: "POST",
        cookie: admin.cookie,
        body: { group_id: group, child_id: childId },
      });
    }
    const code = await invite(groupA, child.data.id);
    assert.equal(code.status, 201);
    const registration = {
      invitation: code.data.invitation,
      login_name: "child_a",
      display_name: "子A",
      password: "child-password-123",
      device_name: "子のiPhone",
    };
    const registered = await call("/api/register", {
      method: "POST",
      body: registration,
    });
    assert.equal(registered.status, 201);
    assert.equal(
      (
        await call("/api/register", {
          method: "POST",
          body: { ...registration, login_name: "repeat" },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await call("/api/invitations", {
          method: "POST",
          cookie: registered.cookie,
          body: { group_id: groupA },
        })
      ).status,
      403,
    );
    const children = await call("/api/children", { cookie: admin.cookie });
    assert.ok(children.data[0].user_id);
    // A generic invitation may have created an account without linking a child profile.
    await db.prepare("INSERT INTO users(id,login_name,display_name,password_salt,password_hash,password_iterations,created_at) SELECT 'existing-child','existing_child','登録済みの子',password_salt,password_hash,password_iterations,created_at FROM users WHERE login_name='child_a'").run();
    await db.prepare("INSERT INTO memberships VALUES (?,'existing-child','member')").bind(groupA).run();
    const unlinked = await call('/api/children',{method:'POST',cookie:admin.cookie,body:{household_id:groupA,display_name:'既存プロフィール'}});
    const staleInvite = await invite(groupA,unlinked.data.id);
    const linkPath = '/api/children/'+unlinked.data.id+'/account';
    assert.equal((await call('/api/children/accounts')).status,401);
    assert.equal((await call('/api/children/accounts',{cookie:registered.cookie})).data.length,0);
    assert.equal((await call('/api/children/accounts',{cookie:admin.cookie})).data[0].login_name,'existing_child');
    assert.equal((await call(linkPath,{method:'PUT',cookie:registered.cookie,body:{user_id:'existing-child'}})).status,403);
    assert.equal((await call(linkPath,{method:'PUT',cookie:admin.cookie,origin:'https://evil.test',body:{user_id:'existing-child'}})).status,403);
    assert.equal((await call(linkPath,{method:'PUT',cookie:admin.cookie,body:{user_id:profile.data.user.id}})).status,409);
    assert.equal((await call(linkPath,{method:'PUT',cookie:admin.cookie,body:{user_id:children.data[0].user_id}})).status,409);
    assert.equal((await call(linkPath,{method:'PUT',cookie:admin.cookie,body:{user_id:'existing-child'}})).status,200);
    assert.equal((await db.prepare('SELECT user_id FROM children WHERE id=?').bind(unlinked.data.id).first()).user_id,'existing-child');
    assert.equal((await call('/api/children/accounts',{cookie:admin.cookie})).data.length,0);
    assert.equal((await call(linkPath,{method:'PUT',cookie:admin.cookie,body:{user_id:'existing-child'}})).status,409);
    assert.equal((await db.prepare('SELECT revoked_at FROM invitations WHERE token_hash IS NOT NULL AND child_id=?').bind(unlinked.data.id).first()).revoked_at>0,true);
    assert.equal(staleInvite.status,201);
    assert.equal((await call('/api/me',{cookie:registered.cookie})).status,200);
    const homes = await call("/api/home", { cookie: registered.cookie });
    const musclePath="/apps/muscle-bank/";
    assert.equal((await call(musclePath)).status,303);
    assert.equal((await call(musclePath+"app.js")).status,303);
    assert.equal((await call("/api/muscle-bank/state")).status,401);
    assert.equal((await call(musclePath,{cookie:registered.cookie})).status,403);
    assert.equal((await call("/api/muscle-bank/state",{cookie:registered.cookie})).status,403);
    assert.ok(!homes.data.some(app=>app.id==='muscle-bank'));
    assert.equal((await call("/api/home",{cookie:admin.cookie})).data.find(app=>app.id==='muscle-bank').path,musclePath);
    const shell=await call(musclePath,{cookie:admin.cookie});
    assert.equal(shell.status,200);
    assert.equal(shell.headers.get("Cache-Control"),"private, no-store");
    assert.match(shell.headers.get("Content-Security-Policy"),/img-src 'self' data:/);
    assert.equal((await call(musclePath+"unlisted.txt",{cookie:admin.cookie})).status,404);
    assert.equal((await call("/api/muscle-bank/state",{cookie:admin.cookie})).data.state,null);
    const muscleState=initialState();
    muscleState.records.push({id:"test-record",exerciseId:"test-exercise",name:"腹ねじねじ",dose:"30秒",points:2,day:"2026-10-02",createdAt:"2026-10-02T00:00:00Z"});
    const photo="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jL1kAAAAASUVORK5CYII=";
    muscleState.changes.push({id:"photo",day:"2026-10-02",memo:"前より楽",waist:"",weight:"",image:photo});
    const putMuscle=(data,revision,cookie=admin.cookie,origin="https://home.test")=>call("/api/muscle-bank/state",{method:"PUT",body:data,cookie,origin,extraHeaders:{"If-Match":String(revision)}});
    assert.equal((await putMuscle(muscleState,0,admin.cookie,"https://evil.test")).status,403);
    assert.equal((await putMuscle(muscleState,0,registered.cookie)).status,403);
    assert.equal((await putMuscle(muscleState,0)).status,200);
    const saved=await call("/api/muscle-bank/state",{cookie:admin.cookie});
    assert.equal(saved.data.revision,1);
    assert.equal(saved.data.state.records[0].points,2);
    assert.equal(saved.data.state.changes[0].image,photo);
    assert.equal((await putMuscle(muscleState,0)).status,409);
    assert.equal((await putMuscle({...muscleState,fund:{...muscleState.fund,balance:-1}},1)).status,400);
    const stored=await db.prepare("SELECT state_json FROM muscle_bank_states WHERE owner_id='bootstrap-admin'").first();
    assert.ok(!stored.state_json.includes('data:image/'));
    const objects=await bucket.list({prefix:"muscle-bank/owners/bootstrap-admin/"});
    assert.equal(objects.objects.length,1);
    assert.equal((await call("/media/"+objects.objects[0].key,{cookie:registered.cookie})).status,404);
    await call("/api/home/muscle-bank",{method:"PUT",cookie:admin.cookie,body:{visible:false}});
    assert.equal((await call("/api/home",{cookie:admin.cookie})).data.find(app=>app.id==='muscle-bank').visible,0);
    assert.equal((await call("/api/muscle-bank/state",{cookie:admin.cookie})).status,200);
    assert.equal((await call("/api/home/muscle-bank",{method:"PUT",cookie:registered.cookie,body:{visible:true}})).status,403);
    await db.prepare("DELETE FROM personal_app_access WHERE user_id='bootstrap-admin' AND app_id='muscle-bank'").run();
    assert.equal((await call(musclePath,{cookie:admin.cookie})).status,403);
    assert.equal((await call("/api/muscle-bank/state",{cookie:admin.cookie})).status,403);
    await db.prepare("INSERT INTO personal_app_access VALUES ('bootstrap-admin','muscle-bank')").run();
    assert.equal(homes.data.length, 7);
    assert.ok(homes.data.filter(a=>!["kidney","calendar"].includes(a.id)).every(a=>a.status==="planned"));
    assert.equal(
      (
        await call("/api/home/album", {
          method: "PUT",
          cookie: registered.cookie,
          body: { visible: false },
        })
      ).status,
      200,
    );
    assert.equal(
      (await call("/api/home", { cookie: registered.cookie })).data.find(
        (a) => a.id === "album",
      ).visible,
      0,
    );
    assert.equal(
      (await call("/api/home", { cookie: admin.cookie })).data.find(
        (a) => a.id === "album",
      ).visible,
      1,
    );
    await db
      .prepare(
        "INSERT INTO groups VALUES ('group-b','家庭B','household','bootstrap-admin',0)",
      )
      .run();
    await db
      .prepare(
        "INSERT INTO memberships VALUES ('group-b','bootstrap-admin','owner')",
      )
      .run();
    await db.prepare("INSERT INTO group_apps VALUES ('group-b','album')").run();
    const codeB = await invite("group-b");
    const userB = await call("/api/register", {
      method: "POST",
      body: {
        invitation: codeB.data.invitation,
        login_name: "user_b",
        display_name: "人B",
        password: "another-password-123",
      },
    });
    assert.equal(userB.status, 201);
    const scope='?household='+groupA;
    const meal={id:'meal-a',day:'2026-10-04',meal:'朝',items:[{id:'rice',name:'ごはん',portion:'1杯',qty:1,values:{salt:0,protein:4,potassium:30,phosphorus:40,energy:230}}]};
    assert.equal((await call('/api/kidney')).status,401);
    assert.equal((await call('/apps/kidney/app.js')).status,303);
    assert.equal((await call('/apps/kidney/',{cookie:registered.cookie})).status,200);
    assert.equal((await call('/api/kidney'+scope+'&day=2026-10-04',{cookie:userB.cookie})).status,403);
    assert.equal((await call('/api/kidney/meals'+scope,{method:'POST',cookie:registered.cookie,origin:'https://evil.test',body:meal})).status,403);
    const posted=await Promise.all([
      call('/api/kidney/meals'+scope,{method:'POST',cookie:registered.cookie,body:meal}),
      call('/api/kidney/meals'+scope,{method:'POST',cookie:admin.cookie,body:{...meal,id:'meal-b',meal:'昼'}})
    ]);
    assert.ok(posted.every(r=>r.status===201));
    assert.equal((await call('/api/kidney/meals'+scope,{method:'POST',cookie:registered.cookie,body:meal})).status,200);
    const family=await call('/api/kidney'+scope+'&day=2026-10-04',{cookie:registered.cookie});
    assert.equal(family.data.records.length,2);
    assert.equal(family.data.records.find(r=>r.id==='meal-b').editable,false);
    assert.equal(family.data.records.find(r=>r.id==='meal-a').items[0].values.energy,230);
    assert.equal((await call('/api/kidney/meals/meal-b'+scope,{method:'DELETE',cookie:registered.cookie,body:{revision:1}})).status,403);
    assert.equal((await call('/api/kidney/meals/meal-a'+scope,{method:'PUT',cookie:registered.cookie,body:{revision:1,items:[{...meal.items[0],qty:2}]}})).status,200);
    assert.equal((await call('/api/kidney/meals/meal-a'+scope,{method:'PUT',cookie:admin.cookie,body:{revision:1,items:meal.items}})).status,409);
    assert.equal((await call('/api/kidney/meals/meal-a'+scope,{method:'DELETE',cookie:admin.cookie,body:{revision:2}})).status,200);
    assert.equal((await call('/api/kidney'+scope+'&day=2026-10-03',{cookie:registered.cookie})).data.records.length,0);
    assert.equal((await call('/api/kidney'+scope+'&day=2026-10-04',{cookie:admin.cookie})).data.records.length,1);
    const targets=Object.fromEntries(['salt','protein','potassium','phosphorus','energy'].map(k=>[k,{max:10,visible:true}]));
    assert.equal((await call('/api/kidney/settings'+scope,{method:'PUT',cookie:registered.cookie,body:{settings:targets,revision:0}})).status,403);
    assert.equal((await call('/api/kidney/settings'+scope,{method:'PUT',cookie:admin.cookie,body:{settings:targets,revision:0}})).status,200);
    assert.equal((await call('/api/kidney/settings'+scope,{method:'PUT',cookie:admin.cookie,body:{settings:targets,revision:0}})).status,409);
    assert.equal((await call('/api/kidney/settings'+scope,{method:'PUT',cookie:admin.cookie,body:{settings:targets,revision:1}})).status,200);
    assert.equal((await call('/api/kidney'+scope+'&day=2026-10-04',{cookie:registered.cookie})).data.revision,2);
    assert.equal((await call('/api/home/preset',{method:'PUT',cookie:registered.cookie,body:{preset:'grandpa'}})).status,200);
    assert.deepEqual((await call('/api/home',{cookie:registered.cookie})).data.filter(a=>a.visible).map(a=>a.id).sort(),['calendar','kidney']);
    assert.ok((await call('/api/home',{cookie:admin.cookie})).data.filter(a=>a.visible).length>2);
    assert.equal((await call('/apps/calendar',{cookie:registered.cookie})).headers.get('Location'),'https://cetus.fun/kanriapp/calendar.html');
    const otherId=(await call("/api/me",{cookie:userB.cookie})).data.user.id;
    await db.prepare("UPDATE users SET platform_role='operator' WHERE id=?").bind(otherId).run();
    await db.prepare("INSERT INTO group_apps VALUES ('group-b','muscle-bank')").run();
    assert.equal((await call("/api/muscle-bank/state?owner_id=bootstrap-admin",{cookie:userB.cookie,extraHeaders:{"X-User-ID":"bootstrap-admin"}})).status,403);
    assert.ok(!(await call("/api/home",{cookie:userB.cookie})).data.some(app=>app.id==='muscle-bank'));
    await db.prepare("INSERT INTO personal_app_access VALUES (?,'muscle-bank')").bind(otherId).run();
    assert.equal((await call("/api/muscle-bank/state?owner_id=bootstrap-admin",{cookie:userB.cookie})).data.state,null);
    await db.prepare("DELETE FROM personal_app_access WHERE user_id=?").bind(otherId).run();
    await db.prepare("UPDATE users SET platform_role='user' WHERE id=?").bind(otherId).run();

    await db
      .prepare(
        "INSERT INTO resources VALUES ('album-a','album',NULL,?,'album','非公開アルバム')",
      )
      .bind(groupA)
      .run();
    await db
      .prepare(
        "INSERT INTO private_files VALUES ('private-image','album-a','private/object','image/png','private.png')",
      )
      .run();
    await bucket.put("private/object", "image-fixture");
    assert.equal(
      (await call("/media/private-image", { cookie: registered.cookie }))
        .status,
      200,
    );
    assert.equal(
      (await call("/media/private-image", { cookie: userB.cookie })).status,
      404,
    );
    await db
      .prepare(
        "INSERT INTO resource_grants VALUES ('share','album-a',NULL,'group-b','read','bootstrap-admin',NULL,NULL,NULL)",
      )
      .run();
    assert.equal(
      (await call("/media/private-image", { cookie: userB.cookie })).status,
      404,
    );
    await db
      .prepare(
        "UPDATE resource_grants SET accepted_at=1,accepted_by=? WHERE id='share'",
      )
      .bind((await call("/api/me", { cookie: userB.cookie })).data.user.id)
      .run();
    const image = await call("/media/private-image", { cookie: userB.cookie });
    assert.equal(image.status, 200);
    assert.equal(image.headers.get("Cache-Control"), "private, no-store");
    await db
      .prepare("UPDATE resource_grants SET revoked_at=2 WHERE id='share'")
      .run();
    assert.equal(
      (await call("/media/private-image", { cookie: userB.cookie })).status,
      404,
    );
    const second = await call("/api/login", {
      method: "POST",
      body: {
        login_name: "child_a",
        password: "child-password-123",
        device_name: "別の端末",
      },
    });
    assert.equal(second.status, 200);
    const sessions = await call("/api/sessions", { cookie: registered.cookie });
    assert.equal(sessions.data.sessions.length, 2);
    assert.equal(
      (
        await call("/api/sessions/" + sessions.data.current, {
          method: "DELETE",
          cookie: userB.cookie,
        })
      ).status,
      200,
    );
    assert.equal(
      (await call("/api/me", { cookie: registered.cookie })).status,
      200,
    );
    await call("/api/sessions/" + sessions.data.current, {
      method: "DELETE",
      cookie: second.cookie,
    });
    assert.equal(
      (await call("/api/me", { cookie: registered.cookie })).status,
      401,
    );
    assert.equal(
      (await call("/media/private-image", { cookie: registered.cookie }))
        .status,
      401,
    );
    assert.equal(
      (await call("/api/me", { cookie: second.cookie })).status,
      200,
    );
    const expired = await invite(groupA);
    await db
      .prepare("UPDATE invitations SET expires_at=0 WHERE id=?")
      .bind(expired.data.id)
      .run();
    assert.equal(
      (
        await call("/api/register", {
          method: "POST",
          body: {
            ...registration,
            invitation: expired.data.invitation,
            login_name: "expired",
          },
        })
      ).status,
      403,
    );
    for (let i = 0; i < 13; i++) {
      const attempt = await call("/api/login", {
        method: "POST",
        ip: "198.51.100.8",
        body: { login_name: "no_user", password: "wrong-password" },
      });
      assert.equal(attempt.status, i < 12 ? 401 : 429);
    }
    await call("/api/logout", {
      method: "POST",
      cookie: second.cookie,
      body: {},
    });
    assert.equal(
      (await call("/api/me", { cookie: second.cookie })).status,
      401,
    );
  } finally {
    await mf.dispose();
  }
});
