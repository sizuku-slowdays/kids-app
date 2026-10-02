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
  const grid = el("section", null, "grid");
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
      el("small", app.status === "planned" ? "準備中" : "ひらく"),
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
  root.append(el("h2", "HOMEに置くアプリ"));
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
  if (me.user.platform_role === "operator") {
    root.append(el("h2", "家族を招待する"));
    const select = el("select");
    for (const group of me.groups.filter((g) =>
      ["owner", "admin"].includes(g.role),
    )) {
      const option = el("option", group.name);
      option.value = group.id;
      select.append(option);
    }
    root.append(select);
    root.append(
      button("1人分の招待コードを作る", async () => {
        try {
          const result = await api("/api/invitations", "POST", {
            group_id: select.value,
          });
          const box = el("div", null, "panel");
          box.append(
            el("p", "このコードは1人・1回限り、7日間有効です。", "muted"),
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
          root.append(box);
        } catch (e) {
          showError(e);
        }
      }),
    );
  }
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
    const list = await api("/api/children");
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
      if (child.user_id) row.append(el("span", "アカウント登録済み", "muted"));
      else if (me.user.platform_role === "operator")
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
