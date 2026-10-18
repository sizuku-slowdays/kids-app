const root = document.querySelector("#root");
const el = (tag, text, cls) => {
  const n = document.createElement(tag);
  if (text) n.textContent = text;
  if (cls) n.className = cls;
  return n;
};
let me, apps;
const existingApps = {
  album: ['https://cetus.fun/wagaya/album/', '写真・動画やゲームの思い出'],
  timetable: ['https://cetus.fun/wagaya/timetable.html', '4年生・2年生の時間割'],
  notification: ['https://cetus.fun/kanriapp/notification-center.html', '家族のお知らせを確認'],
  learning: ['https://cetus.fun/wagaya/keisan/', '計算・ことばの練習'],
};
const descriptions = {
  'school-prep': '宿題と持ち物を、夜と朝に確認しよう',
  'good-deeds': '自分のいいことを記録して、ポイントをためよう',
  'daily-kanji': '1日3文字。よみ・いみ・書きじゅんをたしかめよう',
  'dining-prices': '人数を選んで、コース料金を比較',
  calendar: '家族みんなの予定を共有',
  kidney: 'じいちゃんの食事を確認',
  'kidney-grandma': 'ばあちゃんの食事を確認',
  passbook: 'おこづかい・ポイント・残高',
  'muscle-bank': '思い立ったらすぐ運動',
  'play-agreement': '外遊びの約束を確認',
};
function appCard(app, featured = false) {
  const target = app.status === 'ready' && app.path ? app.path : existingApps[app.id]?.[0];
  const card = el(target ? 'a' : 'div', null, featured ? 'home-card hero-card' : 'home-card list-card');
  if (target) {
    const url = new URL(target, location.origin);
    if (url.origin === location.origin && url.pathname.startsWith('/apps/')) card.href = url.pathname + url.search;
    else if (url.origin === 'https://cetus.fun') card.href = url.href;
  }
  const copy = el('span', null, 'card-copy');
  copy.append(el('strong', app.name), el('small', target ? (descriptions[app.id] || existingApps[app.id]?.[1] || 'ひらく') : '準備中'));
  card.append(el('span', app.icon, 'card-icon'), copy, el('span', target ? '›' : '', 'card-arrow'));
  return card;
}
function appSection(kicker, title, cls) {
  const section = el('section', null, 'home-section');
  section.append(el('p', kicker, 'section-kicker'), el('h2', title));
  const grid = el('div', null, cls);
  section.append(grid);
  root.append(section);
  return grid;
}
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
    el("div", new Intl.DateTimeFormat('ja-JP', {timeZone:'Asia/Tokyo',month:'long',day:'numeric',weekday:'short'}).format(new Date()), "eyebrow"),
    el("h1", "わが家"),
    el("p", me.user.display_name + " さん", "muted"),
  );
  header.append(title, button("⚙️ 設定", settings, "quiet"));
  root.append(header);
  const visibleApps=apps.filter(a=>a.visible);
  const legacyHome=me.groups.some(g=>g.kind==="household"&&g.workspace_mode==="legacy");
  const isMamaHome=me.groups.some(g=>g.kind==="household"&&g.workspace_mode==="legacy"&&["owner","admin"].includes(g.role));
  document.body.classList.toggle("mama-home",isMamaHome);
  if(isMamaHome){
    const quick=appSection("家計簿","すぐ入力・確認","money-quick-grid");
    for(const app of [
      {id:"kakeibo-index",name:"家計簿メニュー",icon:"💰",path:"https://cetus.fun/kanriapp/kakeibo-index.html",status:"ready"},
      {id:"kakeibo-input",name:"すぐ入力",icon:"✍️",path:"https://cetus.fun/kanriapp/kakeibo-input.html",status:"ready"},
    ]) quick.append(appCard(app));
  }
  const favoriteApps=visibleApps.filter(a=>a.featured);
  const learningApps=visibleApps.filter(a=>a.id==='daily-kanji'&&!a.featured);
  const otherApps=visibleApps.filter(a=>!a.featured&&a.id!=='daily-kanji');
  const simple=visibleApps.length===2&&favoriteApps.length===2&&visibleApps.some(a=>a.id==="calendar")&&visibleApps.some(a=>["kidney","kidney-grandma"].includes(a.id));
  if (visibleApps.length) {
    if(learningApps.length){
      const learning = appSection('まいにち少しずつ', 'まなぶ', 'home-app-list');
      learningApps.forEach(app => learning.append(appCard(app)));
    }
    if(favoriteApps.length){
    const featured = appSection('すぐ開く', simple ? '毎日使うアプリ' : 'よく使うアプリ', simple ? 'hero-grid grandpa-home' : 'hero-grid');
    favoriteApps.forEach(app => featured.append(appCard(app, true)));
    }
    if (!simple) {
      if(otherApps.length){
      const grid = appSection('一覧', 'アプリ', 'home-app-list');
      otherApps.forEach(app => grid.append(appCard(app)));
      }
      if(legacyHome){
      const links = appSection('いつもの', 'からだパワー・お薬タイマー', 'home-app-list');
      for (const app of [
        {id:'karada',name:'からだパワー',icon:'🌈',path:'https://cetus.fun/karada_power/',status:'ready'},
        {id:'medicine',name:'いっぷんお薬タイマー',icon:'💊',path:'https://cetus.fun/kids-app/medicine-game.html',status:'ready'},
      ]) links.append(appCard(app));
      }
    }
  }
  if (!visibleApps.length)
    root.append(el("p", "設定から、使うアプリを追加できます。", "muted"));
  const previousHome = el("a", null, "previous-home");
  previousHome.href = "https://cetus.fun/kids-app/";
  previousHome.append(
    el("span", "🎮", "icon"),
    el("strong", "キッズアプリ一覧"),
    el("small", "›"),
  );
  root.append(previousHome);
}
function settings() {
  root.replaceChildren();
  const header = el("header");
  header.append(el("h1", "設定"), button("HOMEへ", home, "quiet"));
  root.append(header,button("ファミリー・共有グループ",()=>{location.href="/groups";},"quiet"));
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
    root.append(button("じいちゃん用：2つだけにする",async()=>{
      try{await api("/api/home/preset","PUT",{preset:"grandpa"});await home();}catch(e){showError(e);}
    },"quiet"));
  }
  if(apps.some(a=>a.id==="kidney-grandma")&&apps.some(a=>a.id==="calendar")){
    root.append(button("ばあちゃん用：2つだけにする",async()=>{
      try{await api("/api/home/preset","PUT",{preset:"grandma"});await home();}catch(e){showError(e);}
    },"quiet"),el("p","選んだ人のHOMEだけ、カレンダーと本人の食事チェックを表示します。あとから自由に戻せます。","muted"));
  }

  root.append(el("p", "「よく使う」にチェックすると上に表示します。↑ ↓ で順番を変更できます。", "muted"));
  const appSettingsList=el("div");root.append(appSettingsList);
  let orderSaving=false;
  function renderAppSettings(){
  appSettingsList.replaceChildren();
  for (const [index,app] of apps.entries()) {
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
    const moves=el("div",null,"app-order-controls");
    for(const [direction,text] of [[-1,"↑"],[1,"↓"]]){
      const move=button(text,async()=>{
        if(orderSaving)return;
        const previous=[...apps],next=index+direction;
        [apps[index],apps[next]]=[apps[next],apps[index]];
        orderSaving=true;renderAppSettings();
        try{await api("/api/home/order","PUT",{app_ids:apps.map(a=>a.id)});}
        catch(e){apps=previous;showError(e);}
        finally{orderSaving=false;renderAppSettings();}
      },"quiet");
      move.setAttribute("aria-label",app.name+(direction<0?"を上へ":"を下へ"));
      move.disabled=orderSaving||index+direction<0||index+direction>=apps.length;
      moves.append(move);
    }
    const options=el("div",null,"app-preference-options"),visibleLabel=el("label"),favoriteLabel=el("label"),favorite=el("input");
    visibleLabel.append(input,document.createTextNode("表示"));
    favorite.type="checkbox";favorite.checked=Boolean(app.featured);
    favorite.setAttribute("aria-label",app.name+"をよく使うアプリにする");
    favorite.disabled=orderSaving;
    favorite.onchange=async()=>{
      if(orderSaving)return;
      const previous=app.featured;app.featured=favorite.checked?1:0;
      orderSaving=true;renderAppSettings();
      try{await api("/api/home/favorites","PUT",{app_ids:apps.filter(a=>a.featured).map(a=>a.id)});}
      catch(e){app.featured=previous;showError(e);}
      finally{orderSaving=false;renderAppSettings();}
    };
    favoriteLabel.append(favorite,document.createTextNode("よく使う"));options.append(visibleLabel,favoriteLabel);
    input.disabled=orderSaving;
    row.classList.add("app-settings-row");row.append(label,moves,options);
    appSettingsList.append(row);
  }
  }
  renderAppSettings();
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
    el("h2", "アプリの更新"),
    button("🔄 最新版に更新", async (event) => {
      const update = event.currentTarget;
      update.disabled = true;
      update.textContent = "更新しています…";
      try {
        for (const path of ["/app.js", "/style.css"]) {
          const response = await fetch(path, {cache: "reload", credentials: "same-origin"});
          if (!response.ok) throw new Error("更新できませんでした。もう一度お試しください。");
          await response.text();
        }
        location.replace("/?updated=" + Date.now());
      } catch (e) {
        showError(e);
        update.disabled = false;
        update.textContent = "🔄 最新版に更新";
      }
    }, "quiet"),
    el("p", "最新の画面を読み直します。記録やログインはそのままです。", "muted"),
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
document.addEventListener("visibilitychange", () => {
  if(document.visibilityState === "visible" && me && root.querySelector("h1")?.textContent === "わが家")
    home().catch(showError);
});
addEventListener("pageshow", (event) => {
  if (event.persisted) location.reload();
});
if (location.pathname === "/join") joinFamily().catch(showError);
else if(location.pathname === "/groups") familyGroups().catch(showError);
else if (["/login", "/setup", "/register"].includes(location.pathname)) authScreen();
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





// Invitation tokens stay in the URL fragment, never in query strings or analytics.
async function joinFamily(){
 root.classList.add('family-screen');
 const token=location.hash.slice(1);
 root.replaceChildren(el('h1','招待から参加'));
 if(!/^[0-9a-f]{64}$/.test(token)){root.append(el('p','招待URLを確認してください。','error'));return;}
 const details=await api('/api/families/preview','POST',{invitation:token});
 const labels={create_family:'新しいファミリーを作成',join_family:'招待されたファミリーへ参加',join_sharing:'共有グループへ参加'};
 root.append(el('h2',labels[details.purpose]),el('p','参加しただけで、通帳や他の家庭の個人情報が公開されることはありません。','muted'));
 let signedIn=null;try{signedIn=await api('/api/me');}catch{}
 const familyInput=form=>details.purpose==='create_family'?field(form,'household_name','新しいファミリー名'):null;
 const finish=()=>location.replace('/groups');
 if(signedIn){
  const target=await api('/api/families/inspect','POST',{invitation:token});
  if(target.group)root.append(el('p','参加先：'+target.group.name));
  root.append(el('p',signedIn.user.display_name+' さんとして参加します。'));
  const form=el('form'),name=familyInput(form),confirm=field(form,'confirmed','この招待で参加します','checkbox');
  form.append(el('button','参加する'));form.addEventListener('submit',async e=>{e.preventDefault();const b=form.querySelector('button');b.disabled=true;try{await api('/api/families/accept','POST',{invitation:token,household_name:name?.value,confirmed:confirm.checked});finish();}catch(error){showError(error);}finally{b.disabled=false;}});root.append(form);return;
 }
 const loginPanel=el('section',null,'panel'),login=el('form');loginPanel.append(el('h2','アカウントをお持ちの方'),login);
 const loginId=field(login,'login_name','ログインID','text','username'),loginPassword=field(login,'password','パスワード','password','current-password');
 login.append(el('button','ログインして参加内容を確認'));login.addEventListener('submit',async e=>{e.preventDefault();try{await api('/api/login','POST',{login_name:loginId.value,password:loginPassword.value,device_name:'この端末'});await joinFamily();}catch(error){showError(error);}});root.append(loginPanel);
 const panel=el('section',null,'panel'),form=el('form');panel.append(el('h2','初めて利用する方'),form);
 const name=field(form,'display_name','表示する名前'),id=field(form,'login_name','ログインID（英数字・_・-、3〜40文字）','text','username'),password=field(form,'password','パスワード（10文字以上）','password','new-password'),family=familyInput(form),confirm=field(form,'confirmed','招待を受けてアカウントを作成します','checkbox');
 form.append(el('button','登録して参加する'));form.addEventListener('submit',async e=>{e.preventDefault();const b=form.querySelector('button');b.disabled=true;try{await api('/api/register-family','POST',{invitation:token,display_name:name.value,login_name:id.value,password:password.value,household_name:family?.value,confirmed:confirm.checked,device_name:'この端末'});finish();}catch(error){showError(error);}finally{b.disabled=false;}});root.append(panel);
}
async function familyGroups(){
 root.classList.add('family-screen');
 const state=await api('/api/families');
 root.replaceChildren(el('h1','ファミリー・共有グループ'),button('HOMEへ',()=>{location.href='/';},'quiet'));
 if(!state.ready)root.append(el('p','準備中です。カレンダーの複数家庭対応を確認するまで、新しい招待・参加・グループ作成を停止しています。現在のご家族はこれまで通り利用できます。','muted'));
 const inviteBox=el('section',null,'panel');
 async function issue(purpose,group_id){try{const result=await api('/api/families/invitations','POST',{purpose,group_id});const url=new URL('/join',location.origin);url.hash=result.token;inviteBox.replaceChildren(el('h2','招待URL'),el('p','1回だけ利用できます。有効期限は7日です。URLはこの画面を閉じる前に控えてください。','muted'));const value=el('input');value.value=url.href;value.readOnly=true;value.setAttribute('aria-label','招待URL');inviteBox.append(value,button('コピー',async()=>{try{await navigator.clipboard.writeText(value.value);}catch{value.focus();value.select();}}));root.prepend(inviteBox);}catch(error){showError(error);}}
 if(state.can_create_family_invite){const b=button('新しいファミリー作成用の招待URL',()=>issue('create_family'));b.disabled=!state.ready;root.append(b);}
 for(const g of state.groups){
  const info=await api('/api/families/groups/'+encodeURIComponent(g.id)),panel=el('section',null,'panel');
  panel.append(el('h2',g.name),el('p',g.kind==='household'?'ファミリー':'共有グループ','muted'));
  const list=el('ul');for(const member of info.members)list.append(el('li',member.display_name+(member.role==='owner'?'（管理者）':member.role==='admin'?'（共同管理者）':'')));panel.append(list);
  if(info.can_manage){const b=button('メンバーを招待する',()=>issue(g.kind==='household'?'join_family':'join_sharing',g.id));b.disabled=!state.ready;panel.append(b);
   if(g.workspace_mode==='restricted'){
    const form=el('form');form.append(el('h3','利用するアプリ'));const labels={calendar:'カレンダー',notification:'通知','family-tree':'家系図','daily-kanji':'まいにち漢字3文字','good-deeds':'いいことポイント','school-prep':'学校準備','dining-prices':'外食料金'};
    for(const app of info.app_choices){const label=el('label'),box=el('input');box.type='checkbox';box.value=app;box.checked=info.app_ids.includes(app);box.disabled=!state.ready;label.append(box,document.createTextNode(labels[app]||app));form.append(label);}
    const save=el('button','利用アプリを保存');save.disabled=!state.ready;form.append(save);form.addEventListener('submit',async e=>{e.preventDefault();save.disabled=true;try{await api('/api/families/groups/'+encodeURIComponent(g.id)+'/apps','PUT',{app_ids:[...form.querySelectorAll('input:checked')].map(n=>n.value)});await familyGroups();}catch(error){showError(error);save.disabled=false;}});panel.append(form);
   }
  }else if(g.kind==='sharing'){
   const leave=button('この共有グループから脱退',async()=>{if(!confirm('この共有グループから脱退しますか？再参加には新しい招待が必要です。'))return;try{await api('/api/families/groups/'+encodeURIComponent(g.id)+'/leave','POST',{});await familyGroups();}catch(error){showError(error);}},'quiet');leave.disabled=!state.ready;panel.append(leave);
  }
  root.append(panel);
 }
 if(state.groups.some(g=>g.kind==='household'&&['owner','admin'].includes(g.role))){const form=el('form'),name=field(form,'name','新しい共有グループ名'),b=el('button','共有グループを作成');b.disabled=!state.ready;form.append(b);form.addEventListener('submit',async e=>{e.preventDefault();b.disabled=true;try{await api('/api/families/groups','POST',{name:name.value,kind:'sharing'});await familyGroups();}catch(error){showError(error);b.disabled=false;}});root.append(form);}
 const invites=await api('/api/families/invitations');
 if(invites.length){const panel=el('section',null,'panel');panel.append(el('h2','発行した招待'));for(const i of invites){const row=el('div'),ended=i.revoked_at||i.use_count>=i.use_limit||i.expires_at<=Date.now()/1000;row.append(el('p',(i.purpose==='create_family'?'新しい家庭':i.purpose==='join_family'?'家庭への参加':'共有グループへの参加')+'：'+(i.revoked_at?'取り消し済み':i.use_count>=i.use_limit?'使用済み':i.expires_at<=Date.now()/1000?'期限切れ':'未使用')));if(!ended){const b=button('招待を取り消す',async()=>{try{await api('/api/families/invitations/'+encodeURIComponent(i.id),'DELETE');await familyGroups();}catch(error){showError(error);}},'quiet');b.disabled=!state.ready;row.append(b);}panel.append(row);}root.append(panel);}
}
