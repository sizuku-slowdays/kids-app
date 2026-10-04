const root = document.querySelector("#root");
const el = (tag, text, cls) => {
  const n = document.createElement(tag);
  if (text) n.textContent = text;
  if (cls) n.className = cls;
  return n;
};
let me, apps;
async function api(path, method = "GET", body) {
  const res = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 401 && !["/api/login", "/api/me"].includes(path))
      location.replace("/login");
    throw new Error(data.error || "接続できません");
  }
  return data;
}
function field(form, key, label, type = "text", autocomplete) {
  const id = "field-" + key;
  form.append(el("label", label));
  const input = el("input");
  input.id = id;
  input.name = key;
  input.type = type;
  input.required = true;
  if (autocomplete) input.autocomplete = autocomplete;
  form.lastChild.htmlFor = id;
  form.append(input);
  return input;
}
function button(text, action, cls = "") {
  const b = el("button", text, cls);
  b.type = "button";
  b.addEventListener("click", action);
  return b;
}
function authScreen() {
  const mode = location.pathname;
  root.replaceChildren(el("div", "WELCOME", "eyebrow"), el("h1", "HOME"));
  const panel = el("section", null, "panel"),
    form = el("form");
  panel.append(
    el(
      "h2",
      mode === "/setup"
        ? "最初のHOMEをつくる"
        : mode === "/register"
          ? "招待からはじめる"
          : "おかえりなさい",
    ),
  );
  if (mode === "/setup") {
    field(form, "secret", "初期設定コード", "password");
    field(form, "household_name", "家庭の名前");
  }
  if (mode === "/register") field(form, "invitation", "招待コード", "password");
  field(form, "login_name", "ログインID", "text", "username");
  if (mode !== "/login") field(form, "display_name", "表示する名前");
  field(
    form,
    "password",
    "パスワード",
    "password",
    mode === "/login" ? "current-password" : "new-password",
  );
  const device = field(form, "device_name", "この端末の名前");
  device.value = /iPhone/.test(navigator.userAgent)
    ? "iPhone"
    : /iPad/.test(navigator.userAgent)
      ? "iPad"
      : "この端末";
  if (mode !== "/login")
    form.append(
      el(
        "p",
        "パスワードは10文字以上。名前はログイン後だけ表示します。",
        "muted",
      ),
    );
  const submit = el("button", mode === "/login" ? "ログイン" : "HOMEをひらく");
  submit.type = "submit";
  const error = el("p", null, "error");
  error.setAttribute("role", "alert");
  form.append(submit, error);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submit.disabled = true;
    error.textContent = "";
    try {
      const data = Object.fromEntries(new FormData(form));
      await api(
        mode === "/setup"
          ? "/api/bootstrap"
          : mode === "/register"
            ? "/api/register"
            : "/api/login",
        "POST",
        data,
      );
      location.replace("/");
    } catch (e) {
      error.textContent = e.message;
    } finally {
      submit.disabled = false;
    }
  });
  panel.append(form);
  root.append(panel);
  const nav = el("nav");
  for (const [href, label] of [
    ["/login", "ログイン"],
    ["/register", "招待を受けた方"],
    ["/setup", "最初の設定"],
  ]) {
    if (href === mode) continue;
    const a = el("a", label);
    a.href = href;
    nav.append(a);
  }
  root.append(nav);
}
async function home() {
  me = await api("/api/me");
  apps = await api("/api/home");
  root.replaceChildren();
  const header = el("header"),
    title = el("div");
  title.append(
    el("div", "MY HOME", "eyebrow"),
    el("h1", "HOME"),
    el("p", me.user.display_name + " さん", "muted"),
  );
  header.append(title, button("設定", settings, "quiet"));
  root.append(header);
  const visibleApps=apps.filter(a=>a.visible);
  const simple=visibleApps.length===2&&visibleApps.every(a=>["calendar","kidney"].includes(a.id));
  const grid = el("section", null, simple?"grid grandpa-home":"grid");
  for (const app of apps.filter((a) => a.visible)) {
    const card = el(
      app.status === "ready" && app.path ? "a" : "div",
      null,
      "card",
    );
    if (card.tagName === "A") {
      const url = new URL(app.path, location.origin);
      if (url.origin === location.origin && url.pathname.startsWith("/apps/"))
        card.href = url.pathname + url.search;
      else card.removeAttribute("href");
    }
    card.append(
      el("span", app.icon, "icon"),
      el("strong", app.name),
      el("small", app.status === "planned" ? "準備中" : app.id==="calendar"?"いつものカレンダーへ":"ひらく"),
    );
    grid.append(card);
  }
  root.append(grid);
  if (!grid.childElementCount)
    root.append(el("p", "設定から、使うアプリを追加できます。", "muted"));
  const households = me.groups.filter((g) => g.kind === "household");
  if (households.length)
    root.append(el("p", households.map((g) => g.name).join("・"), "muted"));
}
function settings() {
  root.replaceChildren();
  const header = el("header");
  header.append(el("h1", "設定"), button("HOMEへ", home, "quiet"));
  root.append(header);
  const inviteGroups=me.groups.filter(g=>["owner","admin"].includes(g.role)&&(g.kind==="household"||me.user.platform_role==="operator"));
  if (inviteGroups.length) {
    root.append(el("h2", "大人の家族を招待"),el("p","おじいちゃん・おばあちゃんはこちら。子どもの登録は不要です。","muted"));
    const select = el("select");
    for (const group of inviteGroups) {
      const option = el("option", group.name);
      option.value = group.id;
      select.append(option);
    }
    select.setAttribute("aria-label","招待する家庭・グループ");
    select.hidden=inviteGroups.length===1;
    root.append(select);
    const invitationBox=el("div");root.append(invitationBox);
    root.append(
      button("大人用の招待コードを作る", async () => {
        try {
          const result = await api("/api/invitations", "POST", {
            group_id: select.value,
          });
          const box = el("div", null, "panel");
          box.append(
            el("p", "招待を受けた人が、登録ページでこのコード・ログインID・パスワードを入力します。1人・1回限り、7日間有効です。", "muted"),
            Object.assign(el("a","招待の登録ページを開く"),{href:"/register",target:"_blank",rel:"noopener"}),
            el("p", result.invitation, "token"),
            button(
              "コピー",
              async () => {
                await navigator.clipboard.writeText(result.invitation);
              },
              "quiet",
            ),
            button(
              "この招待を取り消す",
              async () => {
                await api("/api/invitations/" + result.id, "DELETE");
                box.remove();
              },
              "danger",
            ),
          );
          invitationBox.replaceChildren(box);
        } catch (e) {
          showError(e);
        }
      }),
    );
  }
  root.append(el("h2", "HOMEに置くアプリ"));
  if(apps.some(a=>a.id==="kidney")&&apps.some(a=>a.id==="calendar")){
    root.append(button("おじいちゃん向け：2つだけにする",async()=>{
      try{await api("/api/home/preset","PUT",{preset:"grandpa"});await home();}catch(e){showError(e);}
    },"quiet"),el("p","このアカウントのHOMEだけ、カレンダーと食事チェックを表示します。あとから自由に戻せます。","muted"));
  }

  for (const app of apps) {
    const row = el("div", null, "row"),
      label = el("label", app.name),
      input = el("input");
    input.type = "checkbox";
    input.id = "app-" + app.id;
    input.checked = Boolean(app.visible);
    label.htmlFor = input.id;
    input.addEventListener("change", async () => {
      input.disabled = true;
      try {
        await api("/api/home/" + app.id, "PUT", { visible: input.checked });
        app.visible = input.checked ? 1 : 0;
      } catch (e) {
        input.checked = !input.checked;
        showError(e);
      } finally {
        input.disabled = false;
      }
    });
    row.append(label, input);
    root.append(row);
  }
  if (
    me.groups.some(
      (g) => g.kind === "household" && ["owner", "admin"].includes(g.role),
    )
  )
    root.append(
      el("h2", "家庭の子ども"),
      button("登録・招待", children, "quiet"),
    );
  root.append(
    el("h2", "ログインしている端末"),
    button("端末を確認する", sessions, "quiet"),
  );
  root.append(
    el("h2", "この端末"),
    button(
      "ログアウト",
      async () => {
        await api("/api/logout", "POST", {});
        location.replace("/login");
      },
      "danger",
    ),
  );
}
function showError(e) {
  const p = el("p", e.message, "error");
  p.setAttribute("role", "alert");
  root.append(p);
}
async function children() {
  try {
    const [list, accounts] = await Promise.all([api("/api/children"), api("/api/children/accounts")]);
    root.replaceChildren(
      el("h1", "家庭の子ども"),
      button("設定へ", settings, "quiet"),
    );
    const form = el("form"),
      select = el("select");
    select.name = "household_id";
    for (const group of me.groups.filter(
      (g) => g.kind === "household" && ["owner", "admin"].includes(g.role),
    )) {
      const option = el("option", group.name);
      option.value = group.id;
      select.append(option);
    }
    form.append(select);
    field(form, "display_name", "子どもの名前");
    const submit = el("button", "子どもを登録");
    submit.type = "submit";
    form.append(submit);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      submit.disabled = true;
      try {
        await api(
          "/api/children",
          "POST",
          Object.fromEntries(new FormData(form)),
        );
        await children();
      } catch (e) {
        showError(e);
        submit.disabled = false;
      }
    });
    root.append(form);
    for (const child of list) {
      const row = el("div", null, "row");
      row.append(el("strong", child.display_name));
      if (child.user_id) {
        row.append(el("span", "アカウント登録済み（ID: " + child.login_name + "）", "muted"));
        const targets = list.filter(c => c.household_id === child.household_id && !c.user_id);
        if (targets.length) row.append(button("連携先を修正", () => {
          root.replaceChildren(el("h1", "アカウントの連携先を修正"), button("戻る", children, "quiet"));
          root.append(el("p", "ID「" + child.login_name + "」の現在の連携先：" + child.display_name), el("p", "ID・パスワードは変わりません。変更後、このアカウントはログインし直してください。", "muted"));
          const picker = el("select");
          picker.setAttribute("aria-label", "正しい子どものプロフィール");
          const blank = el("option", "正しい子どもを選ぶ"); blank.value = ""; picker.append(blank);
          for (const target of targets) { const o = el("option", target.display_name); o.value = target.id; picker.append(o); }
          const save = button("選んだ子どもへ結び直す", async () => {
            const target = targets.find(c => c.id === picker.value);
            if (!target || !confirm("ID「" + child.login_name + "」を「" + child.display_name + "」から「" + target.display_name + "」へ結び直しますか？")) return;
            save.disabled = true;
            try {
              await api("/api/children/move-account", "POST", {source_child_id:child.id,target_child_id:target.id,user_id:child.user_id});
              await children();
              root.append(el("p", "連携先を変更しました。対象の携帯では同じID・パスワードでログインし直してください。", "muted"));
            } catch (e) { showError(e); save.disabled = false; }
          });
          save.disabled = true; picker.onchange = () => { save.disabled = !picker.value; };
          root.append(picker, save);
        }, "quiet"));
      }
      else if (me.groups.some(g=>g.id===child.household_id&&["owner","admin"].includes(g.role)))
        row.append(
          button(
            "招待コード",
            async () => {
              try {
                const result = await api("/api/invitations", "POST", {
                  group_id: child.household_id,
                  child_id: child.id,
                });
                root.append(
                  el("p", child.display_name + " さん用（7日間有効）", "muted"),
                  el("p", result.invitation, "token"),
                );
              } catch (e) {
                showError(e);
              }
            },
            "quiet",
          ),
        );
      if (!child.user_id) {
        const candidates = accounts.filter(a => a.household_id === child.household_id);
        if (candidates.length) {
          const picker = el("select");
          picker.setAttribute("aria-label", child.display_name + "の登録済みアカウント");
          const placeholder = el("option", "登録済みアカウントを選ぶ");
          placeholder.value = "";
          picker.append(placeholder);
          for (const a of candidates) {
            const option = el("option", a.display_name + "（ID: " + a.login_name + "）");
            option.value = a.id;
            picker.append(option);
          }
          const link = button("このアカウントと連携", async () => {
            const account = candidates.find(a => a.id === picker.value);
            if (!account) return;
            if (!confirm(child.display_name + " と「" + account.display_name + "（ID: " + account.login_name + "）」を連携します。本人のアカウントで間違いありませんか？")) return;
            link.disabled = true;
            try {
              await api("/api/children/" + encodeURIComponent(child.id) + "/account", "PUT", {user_id: account.id});
              await children();
            } catch (e) { showError(e); link.disabled = false; }
          }, "quiet");
          link.disabled = true;
          picker.onchange = () => { link.disabled = !picker.value; };
          row.append(picker, link);
        }
      }
      root.append(row);
    }
  } catch (e) {
    showError(e);
  }
}
async function sessions() {
  try {
    const data = await api("/api/sessions");
    root.replaceChildren();
    root.append(el("h1", "端末"), button("設定へ", settings, "quiet"));
    for (const s of data.sessions) {
      const row = el("div", null, "row"),
        text = el("div");
      text.append(
        el(
          "strong",
          s.device_name + (s.id === data.current ? "（この端末）" : ""),
        ),
        el(
          "p",
          "ログイン：" + new Date(s.created_at * 1000).toLocaleString("ja-JP"),
          "date",
        ),
      );
      row.append(
        text,
        button(
          "無効にする",
          async () => {
            if (!confirm(s.device_name + " のログインを無効にしますか？"))
              return;
            await api("/api/sessions/" + s.id, "DELETE");
            if (s.id === data.current) location.replace("/login");
            else await sessions();
          },
          "danger",
        ),
      );
      root.append(row);
    }
  } catch (e) {
    showError(e);
  }
}
addEventListener("pageshow", (event) => {
  if (event.persisted) location.reload();
});
if (["/login", "/setup", "/register"].includes(location.pathname)) authScreen();
else
  home().catch((e) => {
    if (e.message === "ログインしてください") location.replace("/login");
    else {
      root.replaceChildren(
        el("p", "HOMEに接続できませんでした。", "error"),
        button("もう一度", () => location.reload(), "quiet"),
      );
    }
  });
